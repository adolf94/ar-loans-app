---
name: LendFlow — The Safelight Bay
description: Loan-book-as-darkroom — amber safelight over a printing bay where every loan is a print developing toward fixed.
colors:
  bay: "#150d07"
  bay2: "#1f1409"
  tray: "#271a0e"
  trayedge: "#3a2817"
  amber: "#ffb224"
  amberdeep: "#b97a15"
  safelight: "#f4a63a"
  paper: "#f6efe2"
  paperdim: "#e2d7c1"
  silver: "#cfc4b2"
  silverdim: "#9a8c74"
  ink: "#2b2015"
  inksoft: "#6f5c43"
  good: "#5fd98d"
  bad: "#f87171"
  line: "#3a2a18"
  linestrong: "#4d3620"
  readout: "#ffc247"
  vignette: "rgba(5,2,0,.5)"
typography:
  display:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.18em"
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    letterSpacing: "0.05em"
  hand:
    fontFamily: "Caveat, cursive"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  print: "6px"
  tray: "10px"
  chip: "4px"
  clip-top: "7px"
  clip-bottom: "3px"
  rope: "2px"
  scrollbar: "8px"
  focus: "4px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "6px"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.silverdim}"
    rounded: "6px"
    padding: "8px 12px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "6px"
    padding: "10px 20px"
  input-field:
    backgroundColor: "{colors.bay}"
    textColor: "{colors.paper}"
    rounded: "6px"
    padding: "10px 12px"
  tray-panel:
    backgroundColor: "{colors.bay2}"
    textColor: "{colors.silver}"
    rounded: "{rounded.tray}"
  stage-stamp:
    backgroundColor: "transparent"
    textColor: "{colors.amber}"
    rounded: "4px"
    padding: "4px 8px"
  print-thumbnail:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "4px"
    size: "40px"
  toast:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "6px"
    padding: "14px 20px"
---

# Design System: LendFlow — The Safelight Bay

## Overview

**Creative North Star: "The Safelight Bay"**

LendFlow's redesign is a printing darkroom under amber safelight. The room is dark — deep bay blacks washed with an amber glow from above — and every loan is a photographic print developing through fixed, irreversible stations: received → issued → active → due → paid. A loan emerges from blur toward fixed at exactly the rate it's repaid; a fully paid loan is "fixed", and a pending loan sits "in the bath". Chrome is darkroom enamel; content is photographic paper. Money figures are wet-print silver or segmented timer digits; working notes are grease-pencil. The system refuses the category default of white cards on gray with a KPI-hero row: figures live in a ruled statement-header strip inline, never as cards.

The room must always answer the operator's question — where does each print stand — without a single color-only signal. Every status is a stamp: named, bordered, and colored at once. Density stays honest (this is a working bay, not a showroom), but the atmosphere carries trust: nothing hides in this light.

**Key Characteristics:**
- Amber safelight wash over layered darkroom-dark bays; photographic paper appears only as content artifacts (print cards, statement, toast).
- All money figures and IDs in IBM Plex Mono with tabular numerals; Barlow carries UI and prose.
- Status grammar = stamps: every state named AND marked AND colored; dashed borders mark provisional states.
- The develop reveal: content enters with a blur/brightness/contrast emergence, staggered, honoring reduced motion.
- Print thumbnails whose blur/brightness map to % repaid; the borrower's loans hang on a rope/clip drying line.
- Grease-pencil (Caveat) reserved strictly for annotations — never data, never UI copy.

## Colors

The palette is a darkroom: near-black warm bays lit by one amber safelight, with photographic paper and silver tones reserved for money surfaces, plus two service colors that survive from the old system only as stamp grammar. Narrow intentional exception: the printed statement stylesheet (`@media print`) leaves the safelight entirely — white sheet, ink-black text — because paper output is physical paper, not the room.

### Primary
- **Safelight Amber** (#ffb224): The room's single light source. Primary actions ("Record payment", "Issue a loan", "Book as payment"), the active station in the rail, key due-today dots, money-due figures, focus rings, selection, and the caret. On paper surfaces it deepens to **Developed Amber** (#b97a15) for progress fills and clip/rope hardware.

### Secondary
- **Fix Glow** (#f4a63a): The softer second amber for accrued interest, guarantor identity, and stamp variation — amber one step toward red, used when the first amber would crowd.
- **Developed Amber** (#b97a15): Amber fixed into hardware — border hovers, range-slider accent, clip borders, borrower-side progress fill. Amber's "on paper" voice.

### Tertiary
- **Fixed Green** (#5fd98d): Service-good only — realized interest, released loans, Payment ledger kind, Paid/Released stamps. Never decorative.
- **Fog Red** (#f87171): Service-bad only — Overdue/Defaulted stamps, penalty kind, at-risk exposure, form errors. Always paired with a text name.

### Neutral
- **Darkroom Bay** (#150d07): Page ground; the room itself.
- **Bay Shadow** (#1f1409): Sidebar enamel, panel wash, scrollbar track.
- **Enamel Tray** (#271a0e): Active nav state, clip bodies, hover washes.
- **Tray Edge** (#3a2817): Avatar discs, hairline borders on the strongest panel.
- **Photo Paper** (#f6efe2): Headings, names, primary figures on dark; the papergrain surface itself.
- **Paper Fade** (#e2d7c1): Paper, one step aged — spare, currently for surface tints.
- **Wet-Print Silver** (#cfc4b2): Body text on dark; Disbursement figures.
- **Dried Silver** (#9a8c74): Secondary text, labels, IDs, metadata — the dried-out emulsion tone.
- **Marking Ink** (#2b2015): Ink on paper surfaces — statement text, primary-ink buttons, figures on prints.
- **Ink Wash** (#6f5c43): Secondary ink on paper — labels, muted rows.
- **Rule Line** (#3a2a18): Hairline borders, dividers, table rules, progress tracks.
- **Tray Border** (#4d3620): Strong panel borders — the enamel edge a tray casts.

### Named Rules
**The One Safelight Rule.** Amber is the only room light. It appears on ≤10% of any screen — actions, the active station, the day's figures. If everything glows, nothing develops.

**The Named, Marked, Colored Rule.** Every status exists as a stamp carrying a text name, a 2px border, and a color simultaneously. Color is never the sole signal of any state.

**The Dark-Room, Paper-Content Rule.** Darkroom chrome (bays, rails, panels) never carries long-form reading on white; papergrain surfaces never sit on the dark side of a border-line hierarchy. Ink on paper, silver on bay — never mixed.

## Typography

**Display Font:** Barlow (with system-ui fallback) — all UI, headings, prose
**Body Font:** Barlow (with system-ui fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace fallback) — figures, IDs, stamps, timer readouts, tabular numerals
**Hand Font:** Caveat (with cursive fallback) — grease-pencil annotations only

**Character:** Barlow is the workhorse: a slightly condensed, unpretentious grotesque that stays legible dense. IBM Plex Mono is the ledger voice — every peso, date, and ID set in fixed-width digits so columns never drift. Caveat is a person's hand on the prints, appearing only where a human annotation would.

### Hierarchy
- **Display** (Barlow 700, clamp(2.25rem–3rem), 1.05, tracking-tight): Door headlines and view titles ("The loan book that develops on schedule.").
- **Headline** (Barlow 700, 30px, 1.15, tracking-tight): Panel-view page titles ("Record a payment").
- **Title** (Barlow 600, 20–24px, 1.25, tracking-tight): Panel and section titles ("Today's batch", "On the line").
- **Body** (Barlow 400, 14–15px, 1.6): Prose, descriptions, table cells; silver (#cfc4b2) on dark, ink on paper.
- **Label** (IBM Plex Mono 500, 11px, 0.16–0.2em tracking, uppercase): Field labels, table headers, figure captions — the stamped-caption voice.
- **Figure** (IBM Plex Mono 700, varies, tabular-nums): All money, IDs, percentages, dates, the segmented readout (0.05em tracking, #ffc247 glow tone on dark).
- **Hand** (Caveat 500–600, 24–48px, rotated −2° to +2°): Grease-pencil notes, portfolio insights, borrower encouragement — never data.

### Named Rules
**The Monospace Ledger Rule.** Every money amount, ID, percentage, date, and tabular figure is IBM Plex Mono with `tabular-nums`. No exception in tables, stamps, or readouts.

**The Grease-Pencil Rule.** Caveat marks working notes and encouragement only. It never sets data, statuses, buttons, or anything a borrower must transcribe exactly.

## Layout

The room is a station layout. Admin is a fixed 240px station rail (Bay, Portfolio, Payment inbox, Ledger, Users) beside a main room capped at `max-w-6xl` with 20–32px side padding; panels pair a wide table column (≈1.55fr) with a narrow tray column (1fr). The statement-header strip is a ruled band (`border-y` in tray-border) laying the four money figures inline on a 2-col/4-col grid — figures first, captions beneath — explicitly not KPI cards.

Content rows sit in 10px vertical rhythm (`space-y-2.5`) as full-width tray panels (`px-4 py-3.5`) rather than table strips, each entering staggered ~70ms apart. Forms are single-column in a `max-w-xl` tray with a 2-col pair for short fields. Responsive: the rail collapses to a horizontal scroll strip under `lg`; figure grids drop 4→2 columns under `md`; row columns (progress meter) hide under `sm`. The borrower surface is mobile-first, one `max-w-lg` column; the guarantor works in `max-w-4xl`; the statement reads in `max-w-2xl`.

## Elevation & Depth

Depth is tonal and photographic, not shadowed. The room recedes in three flat bays — bay (#150d07) ground → bay2 (#1f1409) rails/panels → tray (#271a0e) hover/active — plus a fixed ambient glow (amber radial from above, dark vignette at the edges) and an SVG grain overlay over the whole room. Shadows appear only where physical paper casts them: prints on the drying line (0 10px 30px rgba(0,0,0,.5)), the statement sheet (0 18px 60px rgba(0,0,0,.6)), the toast (0 10px 40px rgba(0,0,0,.55)), print thumbnails (0 2px 6px), and the rope (0 2px 4px). Sticky headers use `backdrop-blur` over bay/85 instead of shadow.

### Shadow Vocabulary
- **Print drop** (`0 10px 30px rgba(0,0,0,.5)`): Drying-line prints — paper hanging off the line.
- **Statement sheet** (`0 18px 60px rgba(0,0,0,.6)`): The full statement modal, heaviest paper.
- **Toast** (`0 10px 40px rgba(0,0,0,.55)`): The confirmation slip delivered to the bottom of the room.
- **Thumb drop** (`0 2px 6px rgba(0,0,0,.45)` + inset ring): Row-level print thumbnails.
- **Rope shadow** (`0 2px 4px rgba(0,0,0,.5)`): The drying line itself, cast onto the wall.

### Named Rules
**The Physical-Paper Shadow Rule.** Shadows are cast only by paper artifacts — prints, statement, toast, thumbnails, rope. Panels, rails, and buttons are flat enamel; they separate by tone and border, never shadow.

## Shapes

Two radii carry the form language: **enamel trays** (10px, `--radius-tray`) for every dark panel, row, form, and table wrapper; **photographic paper** (6px, `--radius-print`) for print surfaces — borrower prints, statement, toast. Inner elements sharpen: inputs and buttons at 6px, print thumbnails and stamps at 4px. Stamps are the signature silhouette: 2px solid border in current color, 4px radius, tight 11px mono uppercase with wide (0.14em) tracking, occasionally hand-rotated (−3° to +2°) like a real rubber stamp. Dashed borders mean provisional — pending loans, overdue stamps, receipt-scan placeholders, empty-inbox states. Hardware is drawn, not imported: the drying line is a 3px gradient rope with 14×34px clips (rounded 7px top, 3px bottom, amberdeep border), and icons are 1.7-stroke inline SVGs that never fight the mono voice.

## Components

### Buttons
- **Shape:** Softly rounded (6px), no pill, no shadow.
- **Primary:** Safelight amber fill (#ffb224) with marking-ink text (#2b2015), Barlow semibold/bold 14–15px, `px-4 py-2.5`–`px-5 py-3`; hover lifts to photo paper (#f6efe2). This is the darkroom timer key — one per view.
- **Ink (on paper):** Marking ink fill (#2b2015) with paper text (#f6efe2); hover to ink wash (#6f5c43). Used only on papergrain surfaces.
- **Ghost:** Transparent with dried-silver text (#9a8c74), hover to amber or paper; cancel and back actions. Bordered quiet variant (line border, 6px) for demo/door switching.
- **Focus:** 2px amber outline, 2px offset, 4px radius — the safelight outlines whatever you're about to touch.

### Stage Stamps
- **Style:** Inline-flex, 2px solid currentColor border, 4px radius, IBM Plex Mono 11px semibold uppercase 0.14em tracking, `.28rem .5rem` padding.
- **Grammar:** Active = amber solid border; Paid = "Paid · fixed" green, rotated −3°; Overdue = dashed red border, rotated +2°, with days named; Defaulted = solid red border with red-tinted fill (rgba(248,113,113,.14)); Pending = dashed dried-silver "In the bath"; Released = green, rotated −2°. Tinted fill is reserved for Defaulted — the one state that stains the tray.

### Tray Panels
- **Shape:** 10px radius, bay2 (#1f1409) at 60–80% opacity, tray-border (#4d3620) 1px edge; header band separated by a rule line.
- **State:** Hover deepens to tray (#271a0e); interactive rows brighten their border to developed amber (#b97a15).

### Print Thumbnails
- **Style:** papergrain square (40px in rows), 4px radius, inset ink ring, initials set in IBM Plex Mono bold.
- **Behavior:** The subject's blur/brightness/contrast map to % repaid — Pending sits at blur(4px) brightness(.5) contrast(.75); Paid is `filter: none`; in-progress interpolates blur ≤1.5px, brightness .6→1, contrast .8→1. The row's emergence *is* the loan's emergence.

### Drying Line (borrower)
- **Style:** 3px rope (linestrong→ink gradient) spanning the column, 14×34px clips at the ends; each loan hangs below as a papergrain print (6px radius), rotated ±1°, print-drop shadowed.
- **Content:** Loan ID + rate in mono, outstanding balance at text-4xl ink, % paid, amberdeep progress fill, next-payment line, and the stage stamp — all ink-on-paper.

### Segmented Timer Readout
- **Style:** IBM Plex Mono 700, 0.05em tracking, #ffc247 on dark; the admin header shows today's date, payments due count, and pesos collected; the Today's batch panel shows the day's due total at 24px.
- **State:** It is the room's clock — reserved for the day's batch only; never used for balances or history.

### Statement-Header Strip
- **Style:** Ruled band (border-y tray-border) with figures inline: 18px bold Barlow values in wet-print silver (or fixed-green / fix-glow when the story is good/accruing), 11px mono uppercase captions beneath, 2-col → 4-col grid.
- **Rule:** These are figures in a ruled ledger strip, not cards — no boxes, no fills, no shadows.

### Inputs / Fields
- **Style:** Bay-black fill (#150d07), rule-line border (#3a2a18), 6px radius, paper text, dried-silver placeholder, `px-3 py-2.5`; amount fields at text-lg with tabular numerals.
- **Label:** 11px mono uppercase 0.16em tracking above, dried-silver.
- **Focus:** 2px amber outline, 2px offset (global `:focus-visible`); caret is amber.
- **Error:** Fog red text, `role="alert"`, plain-language copy ("Enter the amount that actually landed."). Disabled/provisional affordances use dashed tray-border boxes.

### Navigation (station rail)
- **Style:** 240px dark enamel rail (bay2/60), right rule line; items are Barlow medium 14px rows (`px-3 py-2.5`, 6px radius) with 16px 1.7-stroke SVG icons.
- **Active:** Enamel tray fill (#271a0e) + amber text + `aria-current="page"`. Inactive: silver text.
- **Badges:** Amber mono count chip (11px bold, ink text).
- **Mobile:** Rail becomes a horizontal scroll strip above the room; `lg` restores the column.

### Toasts
- **Style:** A papergrain slip (6px radius, marking-ink text, 14px semibold) bottom-center, fixed, with the confirmation check inlined as green-stroke SVG, print-drop shadow, `role="status"` + `aria-live="polite"`.
- **Behavior:** Enters with the fix-flash (expanding amber ring, 1.2s), auto-dismisses ~4.2s. Copy speaks the world ("…the print develops a step.").

## Do's and Don'ts

### Do:
- **Do** set every money figure, ID, date, and percentage in IBM Plex Mono with `tabular-nums` (`.tnum`).
- **Do** mark every loan status with a stamp that names it, borders it, and colors it — Paid · fixed (green, −3°), Overdue (dashed red, +2°), In the bath (dashed silver), Defaulted (red fill), Active (amber).
- **Do** keep chrome dark (bay/bay2/tray) and put long-form or readable content only on papergrain surfaces (#f6efe2).
- **Do** reserve amber (#ffb224) for primary actions, the active station, focus, selection, and today's-due emphasis; use developed amber (#b97a15) for amber hardware on paper.
- **Do** enter content with the develop reveal (blur 7px → 0, brightness .45 → 1, contrast .7 → 1, translateY 6px → 0, ~1s `cubic-bezier(.22,.9,.3,1)`, staggered 70–120ms) and disable it under `prefers-reduced-motion: reduce`.
- **Do** map print-thumbnail emergence to % repaid — the visual is the data.
- **Do** use dashed borders for provisional states (pending, likely-match inbox items, scan placeholder, empty states).

### Don't:
- **Don't** build KPI cards; money figures live in the ruled statement-header strip, inline.
- **Don't** signal any state with color alone — always name + mark + color.
- **Don't** use Caveat for data, statuses, buttons, or anything needing exact transcription.
- **Don't** shadow flat enamel panels, rails, or buttons; shadows belong only to paper artifacts and the rope.
- **Don't** introduce a second accent hue; the room has one safelight. Fog red and fixed green are service grammar, not decoration.
- **Don't** use the segmented timer voice for anything but the day's batch.
- **Don't** fabricate real borrower data or drop the "sample data only" disclosure on entry surfaces.
