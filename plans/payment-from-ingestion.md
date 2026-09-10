# Plan: New Payment from Ingestion (`/payments/new?ingestion_id={guid}`)

Record a loan payment from an ingestion record (parsed notification from the
Notification Ingester), mirroring `plans/loan-from-ingestion.md`. Two entry points:

1. **`/payments/new?ingestion_id={guid}`** — inline form page (no dialog), admin-guarded,
   auto-populated from the ingestion; navigates back to `/admin` after submit/cancel.
2. **"Import from Ingestion"** — button on the payment form (next to *AI Scan*) opening a
   picker of `Pending` ingestions; selecting one prefills the same fields.

Much of the backend already exists: `Payment.FinanceIngestionId` (`Models/Payment.cs:37-38`),
`POST payments` binds the full `Payment` model so `financeIngestionId` passes through
(`Controllers/PaymentController.cs:27`), and the sync hook + worker already confirm
ingestions from a payment's `FinanceIngestionId` (`Data/Cosmos/AppDbContext.cs:87,96`;
`Services/FinanceSyncProcessor.cs:129-135`).

## Key Design Decisions (proposed)

- **Inline form page, not a dialog** — same as `/loans/new`.
- **Payment form refactor**: extract the form body out of `components/dialogs/PaymentDialog.tsx`
  into a new `components/dialogs/PaymentForm.tsx` (same directory — note: `PaymentDialog.tsx`
  lives in `components/dialogs/`, not `components/payments/`); the dialog becomes a thin wrapper
  (same pattern as the `LoanForm` extraction from `LoanDialog`). No behavior change.
- **Submit via `POST payments` with `financeIngestionId`**, NOT via
  `POST finance/ingestions/{id}/process`. Rationale: mirrors the loan flow, works when
  finance links are absent (ingestion simply stays `Pending` until links exist), and
  keeps one payment-creation path. The existing `ProcessIngestion` endpoint
  (`FinanceController.cs:211-270`) stays as-is for `FinanceSettingsTab`'s dialog.
  - Note: `LoanRepo.RecordPayment` does not copy `FinanceIngestionId` onto the journal
    entry, but the sync hook recovers it via the linked payment lookup
    (`AppDbContext.cs:87`) — no backend change required.
- **Auto-select loan = resolve client first, then loan** (exact matches only, no fuzzy
  guessing). Reuse the three-tier `resolveClientId` logic from `LoanForm.tsx:169-186`:
  1. **Account number**: `ingestionRecipientAccountNumber` → `getBankAccountByAccountId`
     (handles masked/last-digit matching, `BankAccountRepo.GetByAccountId:24`) → userId.
  2. **Account name**: `ingestionRecipientAccountName` → `getBankAccountByName`
     (`BankAccountController.cs:43-62`) → userId. If 404, fall back to normalized
     name-match of `ingestionRecipientAccountName` against the loaded users list
     (same as `LoanForm.tsx:179-183` — this is the effective "client name" tier).
  Then loan selection from the resolved client's `Active` loans:
  - exactly one active loan → preselect it;
  - zero or many → leave loan blank for manual selection (show resolved client as a hint).
  - **Before** running the client-resolution tiers, try `ingestionLoanReference`
    (`finance.ts:337-341`) as a direct loan match: search loaded active loans for
    `l.alternateId === ref || l.id === ref`; if found, preselect that loan and derive
    `userId` from `l.clientId` immediately without running the three tiers.
- **Destination account**: preselect the finance-linked asset account matching the
  notification's receiving account if one can be resolved via existing bank-account
  lookups; otherwise fall back to the app's default asset account behavior (blank).
- **Description field**: `PaymentDialog` currently has **no description input**. A `description`
  TextField must be **added** to `PaymentForm` (the backend `Payment` model already has
  `Description`), so the ingestion note can be prefilled and the user can edit it.

## Field Mapping (ingestion → payment form)

| Payment field | Source (fallback order) |
|---|---|
| `amount` | `ingestionAmount` (`ai_parsed.amount` → `amount` abs) |
| `date` | `ingestionDate` (`ai_parsed.date` → `date` → `createdAt` → `YYYY-MM-DD`) |
| `description` | `ingestionNote` (`ai_parsed.notes`/`summary` → reference) |
| `loanId` (+ derived `userId`) | loan reference → resolved client's single active loan (see decisions) |
| `destinationAcctId` | resolved receiving account → blank |
| `financeIngestionId` (new on TS type) | `ingestion.id` |

---

## Backend (`backend/Ar.Loans.Api`)

**No changes required.** Verified existing surface:

- `POST payments` accepts `financeIngestionId` in the body (`PaymentController.cs:22-35`).
- Ingestion confirmation lifecycle already wired for payments
  (`AppDbContext.cs:87,96` → `FinanceSyncProcessor.ProcessCreateAsync:82-136` →
  `ConfirmIngestionAsync`). Requires `LoanReceivables` + destination account to be
  finance-linked; otherwise the payment syncs without confirmation (same as today).
- `GET finance/ingestions` / `GET finance/ingestions/{id}` proxies exist
  (`FinanceController.cs:170-203`).
- Bank-account lookups exist: `GET bankaccounts?accountId=` and `GET bankaccounts/by-name`
  (`BankAccountController.cs:23-62`).

Optional (only if smoke test shows a gap): copy `FinanceIngestionId` onto the payment
entry in `LoanRepo.RecordPayment` (`LoanRepo.cs:177-189`) for robustness — not needed
given the linked-payment lookup in the sync hook.

---

## Frontend (`frontend/src`)

### 1. Types — `@types/types.ts`

- Extend `Payment` (line 106) with `financeIngestionId?: string` (and `fileId?: string`
  to match the backend model, already sent by AI Scan).

### 2. Payment form extraction + ingestion support

- **New `components/payments/PaymentForm.tsx`** (location per existing conventions —
  loans form lives in `components/loans/LoanForm.tsx`): form body extracted from
  `PaymentDialog.tsx` (state + loan/amount/date/destination fields + AI Scan).
  Props: `initialLoanId`, `initialUserId`, `ingestionId?`, embedded-mode flag,
  submit/cancel callbacks. `PaymentDialog.tsx` becomes a thin dialog wrapper;
  its three usage sites (`AdminDashboard.tsx:273-277,331-341`,
  `GuarantorDashboard.tsx:90-94,135-145`, `LoanManageDialog.tsx:271-275`) unchanged.
- **Ingestion prefill** (when `ingestionId` present): fetch via `useIngestion`
  (`finance.ts:202-206`), apply mapping table above using existing helpers
  (`ingestionAmount/Date/Note/LoanReference/RecipientAccount*`), lazy-initializer +
  `key` remount pattern (as in `LoanForm.tsx:166-231` / `IngestionProcessDialog`);
  show an "Imported from ingestion" summary banner.
- **Client/loan auto-select**: port `resolveClientId` from `LoanForm.tsx:169-186`
  (consider hoisting it to a shared util, e.g. `utils/ingestionMatch.ts`, used by both
  forms); then apply the loan-selection rule from Key Decisions.
- **"Import from Ingestion" button** in the form header (next to *AI Scan*): picker
  listing `Pending` ingestions (`useIngestions('Pending')`), selecting one applies the
  same prefill (reuse/extract the picker from `LoanForm.tsx:642+` if practical).
- **Submit**: include `financeIngestionId` in the `Payment` payload (per ingestion use);
  keep existing `useCreatePayment` + date validation (`PaymentDialog.tsx:111-123`).

### 3. Route + page

- **New `pages/NewPaymentPage.tsx`**: inline `PaymentForm`; reads `?ingestion_id=` via
  `URLSearchParams` (pattern: `NewLoanPage.tsx:9`); after submit/cancel → `/admin`.
- **`router.tsx`**: register `/payments/new` admin-guarded, copying the `newLoanRoute`
  pattern (lines 94-103) and adding to `routeTree` (106-115).

---

## Execution Order

1. Frontend: `Payment` type extension (1)
2. Frontend: PaymentForm extraction from PaymentDialog — no behavior change (2a)
3. Frontend: shared client-match util + ingestion prefill + Import picker (2b)
4. Frontend: `/payments/new` page + route (3)

(Backend: none, unless smoke testing reveals a gap.)

## Verification

- `npm run build` + lint (frontend); backend untouched (`dotnet build` sanity only if
  the optional `RecordPayment` change is made)
- Existing `PaymentDialog` call sites behave identically after extraction
- Manual smoke: open `/payments/new?ingestion_id=<sample id>`, confirm prefill
  (amount/date/note/loan/destination), record payment, verify ingestion goes
  `Pending → Confirmed` after the sync worker runs (with finance links present) and
  stays `Pending` without links

## Risks / Notes

- Ingestion confirmation only fires when both `LoanReceivables` and the destination
  account are finance-linked (existing entry-sync constraint).
- Duplicate-confirmation guard: the same ingestion could be processed twice (here and
  via `FinanceSettingsTab`'s `ProcessIngestion` dialog). Mitigation: the ingestion
  picker lists only `Pending` records; backend `ConfirmIngestionAsync` is idempotent by
  status transition. Flag for review — no dedupe on `financeIngestionId` exists today.
- `recipient_account_number` is often empty in transfer notifications; name matching is
  the primary path (same as loans).
- Client resolution maps to a *user*, but payments attach to a *loan* — ambiguous when a
  client has multiple active loans; plan is to leave the loan unselected in that case.
