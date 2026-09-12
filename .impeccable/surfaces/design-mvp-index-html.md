---
version: 1
slug: "design-mvp-index-html"
primary_target: "design-mvp/index.html"
related_targets: []
---

## Scope & mode

- Target: `/workspaces/ar-loans-app/design-mvp/index.html` — a single static HTML MVP showing the whole redesigned LendFlow end-to-end (login/entry, Admin ledger bay, loan manage + record payment, Borrower portal, Guarantor portal). Client-side navigation only; no backend. Sits beside the production `frontend/` untouched.
- Mode: **Operate** — visitors complete tasks; scanability, states, and the real usage scene outrank expression. Three surfaces share the one world: Admin (dense, task-first), Borrower (mobile-first, reassuringly simple), Guarantor (exposure-first).

## Audience & jobs

- Admin: issue loans, record payments, book ingested notifications, watch portfolio health. Daily, high-frequency.
- Borrower: understand at a glance what they owe, what's paid, when the next payment falls. Read-only (product decision). Often on a phone.
- Guarantor: see exposure and the loans they backstop.

## Constraints (product truth)

- Currency PHP, "P" prefix; PH context. Loan statuses Pending | Active | Paid | Defaulted | Archived. Ledger types Disbursement | Payment | Interest | Penalty. No borrower apply flow. Keep the name LendFlow. Demo data is synthetic and labeled as such.

## Chosen direction — The Safelight Bay

- World: a printing darkroom under amber safelight. Amber wash is the room; money "develops" through fixed stations (received → issued → active → due → paid) — irreversible past marked points; a loan emerges from dark toward fixed as it gets repaid. Wet-print silver for imagery/figures, grease-pencil marks for working notes, segmented timer digits for today's batch, enamel tray white at edges.
- Palette: amber ground over deep darkroom dark; silver/paper tones for print surfaces; status colors survive as service-state grammar (named + marked, never color alone).
- Signature: the develop reveal — progress renders as one continuous emergence (blur/contrast from ghost to fixed), orchestrated once, not scattered.
- Memorable moment: the borrower's drying line — their loans hanging as prints, each fixed at the rate it's repaid.

## Unresolved decisions

- Exact dark/light balance of the amber ground (must pass contrast for dense admin tables) — resolved during build within the world.

## Direction contract

THESIS: The loan book is a printing darkroom under amber safelight — every loan is a print developing through fixed, irreversible stations (received → issued → active → due → paid), and the room's light tells you where each loan stands. It refuses the category default: white cards on gray with a KPI-hero row.

OWN-WORLD: Amber safelight wash over deep darkroom dark; photo-paper white print surfaces with wet-print silver figures; grease-pencil working notes; segmented timer digits for the day's batch; enamel tray-white edges; status = service-state grammar, each state named AND marked AND colored so color is never the sole signal.

STORY: The visitor believes this loan book is under control — money develops on schedule, nothing hides. The admin issues and records in seconds (timer-batch + one-panel payment record); the borrower sees their loans hanging on a drying line, emerging toward fixed at the rate they repay; the guarantor sees exposure as contact sheets they backstop.

FIRST VIEWPORT: Admin ledger bay at 1440: left station rail (Bay, Portfolio, Inbox, Ledger, Users) in dark enamel; main room holds a ruled statement-header strip with the four money figures inline (receivables, liquid asset, realized, accrued), then the timer-batch panel (today's due payments with segmented readout) beside the portfolio table where every loan row carries a developing print thumbnail whose emergence maps to % repaid, stage stamps at the row's right edge; primary action "Record payment" sits in the timer panel as a darkroom timer key, amber-filled.

FORM: The Safelight Bay, dealt leader of the bolder re-roll (round 1, register bolder, seed key 4dc530e0) — fused challenger-turned-leader; product supplies every fact, darkroom supplies the grammar.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
