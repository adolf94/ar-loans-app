# Plan: Finance App Integration

Integration of the external Finance API (spec: `/finance_app_3rd_party.md`) into the Ar.Loans app.

## Goals / Features

1. **Account linking** — link loan_app ledger accounts (assets) to finance_app accounts, managed in a settings UI. Show both balances (loan_app + finance_app).
2. **Interest income linking** — link Interest Income and Accrued Interest (incl. Late Penalty) accounts to finance_app accounts, in the same settings UI.
3. **Ingestion-driven transactions** — select a pending ingestion (notification) from the finance_app ingester in the UI; auto-populate a payment dialog from the ingestion values.
4. **Async dual creation** — on ingestion processing, create the transaction in both loan_app and finance_app; tag the ingestion `Pending` → `Confirmed`. Auto-created in the backend.
5. **Automatic mirroring** — mirror local journal entries to the finance app in near real-time, event-driven (no polling; the app is not always-on).

## Key Design Decisions (settled)

- **Entry mapping**: loan_app `Entry` (DebitId/CreditId/Amount, debit-positive) maps 1:1 to a finance `Transaction` with two `LedgerEntry` lines: debit account `+amount`, credit account `-amount`.
- **Auth**: backend acts via `client_credentials` against the same authority (`https://auth.adolfrey.com/api`) using existing `AuthorityService`, scopes under `api://finance-app-api/`: `accounts:read`, `transactions:create`, `transactions:read:self`, `ingestions:read`, and **`transactions:delete:self`** (live on the finance API — exposes `DELETE /api/transactions/{id}`, restricted to `CreatedBy == {sub}`; `204` on success, `404` when not found or not created by us).
- **Reversals = DELETE first**: when a synced local entry is deleted, delete the finance transaction (via `transactions:delete:self`); `404` is treated as an idempotent success. Fall back to a reversal transaction only if delete returns `401/403` or a transient/network error (kept as a safety net behind the `UseDeleteForReversal` toggle).
- **Async sync = Azure Storage Queue + `[QueueTrigger]` function** (event-driven; wakes instances from scale-to-zero; built-in retries + poison queue). **No pollers, no timers, no in-process background workers** (app is not always-on).
- **Sync scope**: mirror every entry where *both* debit and credit accounts are linked. Note: `RebalanceInterestRealizations` deletes+recreates interest-realization entries on each payment → mirrored as delete+recreate on the finance side (accepted churn).
- **Ingestion processing = loan payment**: selecting a pending ingestion opens the payment dialog pre-populated from the ingestion (amount, date, note/reference; used to suggest loan + destination account).
- **Finance userId**: derived from the logged-in admin user's identity (same authority) and stored with the links/settings.
- **Ingestion reads**: backend proxies the ingester read routes, forwarding the user's bearer token (ingestions are scoped to `{sub}`; client_credentials cannot list a user's ingestions).
- **Prerequisite (out of band)**: the finance app must grant the loan app's client identity visibility of the user's accounts.

---

## Backend (`backend/Ar.Loans.Api`)

### 1. Config — `Utilities/AppConfig.cs` + `local.settings.json`

Add `FinanceConfiguration` (mirrors `ArGoConfiguration`):

- `BaseUrl` — Finance API base (`<API_BASE_URL>/api`)
- `IngesterBaseUrl` — Notification Ingester base (`<INGESTER_BASE_URL>`)
- `Scope` — `api://finance-app-api/transactions:create api://finance-app-api/transactions:read:self api://finance-app-api/accounts:read api://finance-app-api/ingestions:read api://finance-app-api/transactions:delete:self`
- `UseDeleteForReversal` (bool, default true; the `transactions:delete:self` scope is live so DELETE is the primary reversal path, with reversal transactions kept only as a fallback)

### 2. `Services/FinanceService.cs` — typed `HttpClient` (pattern: `ArGoService.cs:12`)

Tokens via `AuthorityService.GetAccessTokenAsync(scope)`.

- `GetAccountsAsync(userId)` → `GET {BaseUrl}/owners/{userId}/accounts` (`accounts:read`)
- `GetAccountGroupsAsync(userId)` → `GET {BaseUrl}/owners/{userId}/account-group`
- `CreateTransactionAsync(userId, date, type, note, entries, ingestionId?)` → `POST {BaseUrl}/transactions` (`transactions:create`); returns created tx `id`
- `DeleteTransactionAsync(txId)` → `DELETE {BaseUrl}/transactions/{txId}` (`transactions:delete:self`)
- `GetIngestionsAsync(userToken, status, top)` / `GetIngestionAsync(userToken, id)` → ingester reads with **user-token passthrough** (`ingestions:read` / `user`)
- `ConfirmIngestionAsync(ingestionId, userId, transactionId)` → `POST {IngesterBaseUrl}/ingestions/{id}/confirm-status` (`transactions:create`, body includes `user_id`) → status `Confirmed`

Register in `Program.cs:58-60` alongside `AuthorityService`/`ArGoService`.

### 3. Models & storage (Cosmos EF Core, `EnsureCreated` — no migrations)

- **`AccountLink`** → container `AccountLinks`
  - `Id (Guid)`, `LoanAccountId (Guid)`, `FinanceAccountId (string)`, `FinanceUserId (string)`, `PartitionKey`
  - Covers assets AND income accounts (InterestIncome, AccruedInterest, LatePenaltyIncome)
- **`FinanceSyncItem`** → container `FinanceSyncQueue`
  - `Id (Guid)`, `Kind` (`Create` | `Reverse`), `EntryId (Guid)`, `Status` (`Pending` | `Processing` | `Completed` | `Failed`), `FinanceTransactionId (string?)`, payload (debit/credit account ids, amount, date, description), `Attempts`, `LastError`, timestamps, `PartitionKey`
- **`Entry` extensions** (`Models/Entry.cs`):
  - `FinanceTransactionId (string?)` — set once mirrored
  - `SkipFinanceSync (bool)` — set for entries created via ingestion processing (finance tx created explicitly there)
- Storage Queue client registered in `Program.cs` (reuses existing `AppConfig.AzureStorage` connection string; Azurite locally).

### 4. Enqueue hook — `AppDbContext.SaveChangesAsync` override

Catches all write paths (EntryRepo + LoanRepo disburse/pay/accrue/rebalance) without touching business logic:

- Added `Entry` where both `DebitId` and `CreditId` are linked and `!SkipFinanceSync` → persist `FinanceSyncItem(Create, Pending)` + push `{itemId}` to `finance-sync` storage queue
- Removed `Entry` that has a `FinanceTransactionId` → persist `FinanceSyncItem(Reverse, Pending)` + push to queue

### 5. `Functions/FinanceSyncQueueFunction.cs` — `[QueueTrigger("finance-sync")]`

- Loads the `FinanceSyncItem`, marks `Processing`
- **Create**: build finance `Transaction` (entries: linked debit `+amount`, linked credit `-amount`; date/note from entry; type heuristic `Transfer`/`Journal`) → `POST` → store returned id in `Entry.FinanceTransactionId` → `Completed`
- **Reverse**: if `UseDeleteForReversal` → `DELETE {FinanceTransactionId}`; on failure/unavailable → create reversal transaction (entries with flipped signs) → `Completed`
- Failure → item stays `Failed` with `LastError`/`Attempts`; QueueTrigger provides automatic retries (5 attempts) + poison queue
- Each invocation also opportunistically drains any other `Pending`/`Failed` items (covers rare queue-push failures) — no timer needed

### 6. `Controllers/FinanceController.cs` (admin role, pattern: existing controllers)

- `GET /finance/accounts` — finance accounts via `accounts:read` (for link picker)
- `GET /finance/account-links` — current links
- `POST /finance/account-links` — upsert link `{ loanAccountId, financeAccountId }` (stores `FinanceUserId` from `CurrentUser`)
- `DELETE /finance/account-links/{id}`
- `GET /finance/linked-balances` — pairs of `{ loanAccount, financeAccount?, loanBalance, financeBalance }` for the balance sheet
- `GET /finance/ingestions?status=` — proxy to ingester forwarding the caller's bearer token
- `POST /finance/ingestions/{id}/process` — body `{ loanId, destinationAccountId, amount, date, note? }`:
  1. create local payment (`LoanRepo.RecordPayment`) with `SkipFinanceSync`/pre-set `FinanceTransactionId`
  2. create finance transaction with `ingestionId`
  3. `confirm-status` → ingestion `Pending` → `Confirmed`

---

## Frontend (`frontend/src`)

### 7. `repositories/finance.ts`

React-query hooks (pattern: `repositories/interestRule.ts`, `account.ts`) for all `/finance/*` endpoints.

### 8. New "Finance" tab in `AdminDashboard.tsx` (pattern: `InterestRulesTab.tsx`)

- **Account links** section: table of loan accounts (assets + income/accrued) each with a finance-account dropdown (from `GET /finance/accounts`), save / unlink
- **Ingestions** section: list of pending ingestions (status filter); selecting one opens a payment dialog pre-populated from the ingestion (amount, date, note/reference; suggests loan + destination account); submit calls `POST /finance/ingestions/{id}/process`

### 9. `BalanceSheetTab.tsx`

For linked accounts, render the finance-app balance alongside the loan-app balance (from `GET /finance/linked-balances`).

### 10. On/off config flag (`frontend/public/config.js` → `window.webConfig.enableFinanceIntegration`)

- Master UI switch mirroring the backend `AppConfig__Finance__Enabled`. Read via `isFinanceEnabled()` in `repositories/finance.ts`.
- **The Finance settings tab is always visible** so links can be configured ahead of activation; account-link reads/writes and the finance-accounts dropdown are never gated by the flag.
- When disabled: the tab shows a "Disabled" chip + setup notice, and the live-only panels (Ingestions, Sync Queue) are hidden; the balance-sheet finance overlay query is skipped (`useLinkedBalances(isFinanceEnabled())`).
- When enabled: full behavior (linking + ingestion processing + sync viewer + dual balances).
- Backend counterpart hardened as a true kill-switch: `FinanceSyncProcessor.ProcessItemAsync` returns early (leaving items `Pending` for a later run) when `Finance.Enabled` is off, so a disabled integration never fails queued messages into the poison queue.

---

## Execution Order

1. Backend: config + `FinanceService` + models/containers + `FinanceController` (accounts, links CRUD, linked balances)
2. Backend: sync enqueue hook + `[QueueTrigger]` sync function (create / delete-first reversal)
3. Backend: ingestion proxy + process endpoint
4. Frontend: Finance settings tab (links + ingestion selection/processing)
5. Frontend: dual balances in `BalanceSheetTab`

## Verification

- `dotnet build` (backend)
- `npm run build` + lint (frontend)
- Local smoke test with Cosmos emulator + Azurite if available; no test infra exists in the repo

## Risks / Notes

- Finance API exposes no update to `transactions:create` callers; `transactions:delete:self` is now live (`DELETE /api/transactions/{id}`, `CreatedBy == {sub}` scoped, `204` success / `404` not-found-or-not-yours treated as idempotent success), so DELETE is the primary reversal path; reversal-transaction fallback remains for `401/403`/transient failures.
- No cross-system atomicity: local commit first; finance side is best-effort async via the durable queue with retries + poison queue.
- `accounts:read` via client_credentials only sees accounts granted visible to the app identity — onboarding step done out of band.
- Ingestion record shape (parsed notification fields) must be confirmed against the ingester API during implementation for the pre-population mapping.
