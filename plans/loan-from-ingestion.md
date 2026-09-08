# Plan: New Loan from Ingestion (`/loans/new?ingestion_id={guid}`)

Create a loan from an ingestion record (parsed notification from the Notification
Ingester). Two entry points:

1. **`/loans/new?ingestion_id={guid}`** — inline form page (no dialog), admin-guarded,
   auto-populated from the ingestion; navigates back to `/admin` after submit/cancel.
2. **"Import from Ingestion"** — button on the loan form itself (next to *Scan Receipt*)
   opening a picker of `Pending` ingestions; selecting one prefills the same fields.

Spec: `/finance_app_3rd_party.md` (Ingestion Reads section). Sample record shape:
flat fields plus `ai_parsed` (amount, date, notes, summary, vendor,
`recipient_account_number`, `recipient_account_name`, ...) and `raw_payload`.

## Key Design Decisions (settled)

- **Inline form page, not a dialog**: `/loans/new` renders the loan form directly.
- **Client auto-select = three-tier exact match** (no fuzzy guessing), in priority
  order (all name matches normalized: uppercase, punctuation stripped):
  1. **Account number**: `ai_parsed.recipient_account_number` → existing
     `GET /bankaccounts?accountId=` (`getBankAccountByAccountId`) → `UserAccount.userId`.
     **Reuse existing matching logic** — `BankAccountRepo.GetByAccountId`
     (`BankAccountRepo.cs:24-48`) already handles masked/partial numbers: masked
     segments (`*`/`.`) are stripped and stored accounts are matched via
     `EndsWith(lastDigits)`, preferring exact matches first. No backend change
     needed for this tier (ambiguous last-4 collisions resolve to the single best
     candidate — exact > lexicographic).
  2. **Account name** (fallback): `ai_parsed.recipient_account_name` → exact match on
     the client's bank-account name via a new backend lookup
     (`GET /bankaccounts/by-name?name=...`) → `UserAccount.userId`
  3. **Client name** (fallback): exact match on loans-app user `name` (users are
     already loaded in the form)
  - No match (or ambiguous) → client left blank for manual selection.
    `User.financeUserId` / AccountLink-based mapping were evaluated and
    **rejected** (`AccountLink.FinanceUserId` is the admin's OIDC uid, not the client's).
- **Ingestion confirmation reuses the payment lifecycle**: tag the loan's principal
  disbursement entry with `FinanceIngestionId`; the existing sync hook + worker
  create the finance transaction with `ingestionId` and confirm the ingestion
  (`Pending → Confirmed`) — identical to ingestion payments.
- **Loan form refactor**: extract the form body out of `LoanDialog.tsx` into a shared
  `LoanForm` component; the dialog becomes a thin wrapper. No behavior change.

## Field Mapping (ingestion → loan form)

| Loan field | Source (fallback order) |
|---|---|
| `principal` | `ai_parsed.amount` → `amount` (abs) |
| `date` | `ai_parsed.date` → `date` → `createdAt` (→ `YYYY-MM-DD`) |
| `alternateId` | derived from `raw_payload.notif_id` / `ai_parsed.reference_number` |
| `clientId` | account number → account name → client name (exact matches, see decisions) |
| `financeIngestionId` (new) | `ingestion.id` |

Template/interest defaults still come from the selected client's default rule.

---

## Backend (`backend/Ar.Loans.Api`)

### 1. Single-ingestion proxy — `Controllers/FinanceController.cs`

- `[Function("GetIngestion")]` at `GET finance/ingestions/{ingestionId}`
  (mirror `GetIngestions`, lines 156–173: admin-guard, finance-enabled check,
  caller bearer-token passthrough) → existing
  `FinanceService.GetIngestionAsync` (`Services/FinanceService.cs:211`).

### 2. Ingestion-tagged loan entries (confirmation lifecycle)

- **`Models/Entry.cs`**: add `FinanceIngestionId (string?)`.
- **`Models/Loan.cs`**: add optional `FinanceIngestionId` (sent by frontend in `POST /loans`).
- **`Data/Cosmos/LoanRepo.cs` `CreateLoan`** (principal entry created at lines 38–50):
  copy `loan.FinanceIngestionId` onto the principal disbursement entry.
- **`AppDbContext.SaveChangesAsync` hook** (payload build at lines 87–96):
  `IngestionId = entry.FinanceIngestionId ?? linkedPayment?.FinanceIngestionId`.
- Result: `FinanceSyncProcessor.ProcessCreateAsync` (lines 100–135) creates the
  finance transaction tagged with `ingestionId`, then calls
  `ConfirmIngestionAsync` → ingestion `Pending → Confirmed`. Requires
  `LoanReceivables` + source account to be linked (existing constraint; otherwise
  the entry syncs without ingestion confirmation, same as today).

### 3. Bank-account name lookup — `Controllers/BankAccountController.cs`

- `[Function("GetByBankAccountName")]` at `GET bankaccounts/by-name?name=...`
  (admin-guard): normalize (uppercase, strip non-alphanumerics) server-side,
  exact match on `UserAccount.Name`, return the matching `UserAccount` or `404`.
- Note: the account-number tier needs no new logic — the existing
  `GET bankaccounts` route already supports masked/last-digits matching
  (`BankAccountRepo.GetByAccountId`).

---

## Frontend (`frontend/src`)

### 4. `repositories/finance.ts`

- **`useIngestion(id, enabled)`** — query key `[FINANCE_INGESTIONS, 'detail', id]`,
  `GET /finance/ingestions/{id}`, gated by `isFinanceEnabled()`.
- **Helper updates** (`ingestionAmount` / `ingestionDate` / `ingestionNote`):
  fall back to `ai_parsed.*` and `raw_payload` when flat fields are absent
  (shape stays loose — `IngestionRecord` already has an index signature).

### 5. Loan form extraction + ingestion support

- **New `components/loans/LoanForm.tsx`**: form body (state + all fields) extracted
  from `LoanDialog.tsx` (lines 46–483). Props: `initiallyOpen`/embedded mode,
  `fixedGuarantorId`, `ingestionId?`, submit/cancel callbacks.
  `LoanDialog.tsx` becomes a thin dialog wrapper around it.
- **Ingestion prefill** (when `ingestionId` present): fetch via `useIngestion`,
  apply mapping table above (lazy-initializer + `key` remount pattern from
  `IngestionProcessDialog`, `FinanceSettingsTab.tsx:134–140, 289–296`); show an
  "Imported from ingestion" summary banner.
- **"Import from Ingestion" button** in the form header (next to *Scan Receipt*):
  picker listing `Pending` ingestions (`useIngestions()`), selecting one applies
  the same prefill.
- **Submit**: include `financeIngestionId` in the `Loan` payload (per ingestion use).

### 6. Route + page

- **New `pages/NewLoanPage.tsx`**: inline `LoanForm`; reads `?ingestion_id=` via
  `URLSearchParams(window.location.search)` (pattern: `MagicLinkPage.tsx:15`);
  after submit/cancel → navigate to `/admin`.
- **`router.tsx`**: register `/loans/new` (admin-guarded like `/admin`).

---

## Execution Order

1. Backend: ingestion proxy route (1)
2. Backend: `FinanceIngestionId` on Entry/Loan + repo/hook changes (2)
3. Backend: bank-account by-name lookup (3)
4. Frontend: `useIngestion` + helper updates (4)
5. Frontend: LoanForm extraction + ingestion prefill/Import picker (5)
6. Frontend: `/loans/new` page + route (6)

## Verification

- `dotnet build` (backend) / backend tests (`Ar.Loans.Api.Tests`) for the sync hook change
- `npm run build` + lint (frontend)
- Manual smoke: open `/loans/new?ingestion_id=<sample id>`, confirm prefill,
  issue loan, verify ingestion goes `Pending → Confirmed` after the sync worker runs

## Risks / Notes

- Ingestion confirmation only fires when both `LoanReceivables` and the loan's
  source account are finance-linked; otherwise the ingestion stays `Pending`
  (consistent with existing entry-sync behavior).
- `recipient_account_number` is often empty in transfer notifications (see sample);
  name matching is the primary path.
- Ingestion record shape is not fully contracted; helpers stay best-effort with
  `ai_parsed` fallbacks.
