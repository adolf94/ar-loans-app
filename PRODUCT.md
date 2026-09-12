# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Redesign MVP: single static HTML file with client-side navigation (no build step). The production app (React + Vite + MUI in `frontend/`) is NOT to be modified in this effort — the MVP is a design showcase for a future shadcn/Tailwind migration.

## Users

- **Admin (lender operator):** runs the loan book daily — issues loans, records payments, manages users, watches portfolio health. High-frequency, task-focused.
- **Borrower (Client):** checks their own loans, repayment progress, and statements. Read-only by product decision (confirmed: no self-service apply). Often checking from a phone.
- **Guarantor (sometimes a lending-cooperative member):** backstops loans, may issue loans with themselves as guarantor, records payments, watches their exposure.

## Product Purpose

LendFlow manages small personal/lending-circles loans: issue a loan with an interest rule, track a ledger of disbursements, payments, interest and penalties, and keep books that can sync to an external double-entry Finance API. Success = the operator issues/records in seconds and the borrower instantly understands what they owe and when.

## Positioning

AI-assisted loan book for informal/lending-circle lending in the Philippines: notification ingestion (SMS/Telegram receipts scanned into ledger entries) plus QRPh-aware payment capture — things a spreadsheet or generic lending SaaS doesn't do.

## Operating Context

- Philippine market; currency is PHP shown with a "P" prefix (e.g. `P 12,500`).
- Roles enforced via OIDC roles `api://ar-loans-api/admin` and `api://ar-loans-api/guarantor`; login via OIDC authority auth.adolfrey.com, plus Telegram-distributed magic links (`/m`).
- Data syncs to a 3rd-party Finance API (double-entry bookkeeping) with a pending "ingestion" inbox for booking notifications as loans/payments/entries.
- Domain vocabulary: Loan, Payment, InterestRule, Guarantor, Manual Entry, Ledger, Balance Sheet, Ingestion.

## Capabilities and Constraints

- Loan model: principal, monthly interest %, term, grace period, late penalty, interest base (principal/balance/principalBalance), status `Pending | Active | Paid | Defaulted | Archived`, amortization schedule.
- Ledger transaction types: Disbursement, Payment, Interest, Penalty.
- Admin screens: portfolio KPIs (loan receivables, liquid asset, realized/accrued interest), AI portfolio insights, loan table, system users, ledger, balance sheet, interest rules, finance integration, Telegram messages.
- Borrower screens: active loans, repayment progress bars, transaction ledger, forthcoming payments/amortization, printable client statement.
- Guarantor screens: cash on hand, interest stats, guaranteed loans, consolidated ledger, balance sheet.
- Payment has no status field. Forms create loans directly as Active (no admin approval step in current product).

## Brand Commitments

- Name: **LendFlow** (keep).

## Evidence on Hand

- Full production codebase: `frontend/` (React+MUI), `backend/` (Azure Functions API), `plans/`, `finance_app_3rd_party.md`. No logo/asset files; no real user data may be fabricated as real.

## Product Principles

- The money story is always legible: every screen answers "what do I hold, what do they owe, what happened" at a glance.
- Ease of use is the product's promise — record a payment in seconds, understand a loan without training.
- Trust through precision: exact amounts, dates, statuses — never vague.
- Mobile-friendly for borrowers; dense-but-scannable for admins.

## Accessibility & Inclusion

- Borrowers may be non-technical, mobile-first users; plain language and large legible numbers matter.
