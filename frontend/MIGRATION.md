# LendFlow frontend migration — MUI → Tailwind (Safelight Bay)

All MUI (`@mui/material`, `@mui/icons-material`, `@emotion/*`, `material-ui-confirm`) is being replaced with Tailwind v4 utilities + the shared primitives in `src/components/ui.tsx`. Business logic, repositories, hooks, TanStack Query/Router, lucide-react icons stay as-is.

## Rules for every migrated file

1. **Keep every prop, hook call, query/mutation, handler, and data flow identical.** Only the presentation layer changes. No new features, no removed features.
2. Delete every `@mui/*`, `@emotion/*`, and `material-ui-confirm` import. Use primitives from `../components/ui` (or `./ui` / correct relative path) and plain HTML + Tailwind classes. lucide-react stays for icons (stroke 1.7).
3. World: **The Safelight Bay** — reference rendering: `design-mvp/index.html` at the repo root. Dark warm ground (body is styled globally in `index.css` — never paint a page background light). Panels: `border border-linestrong rounded-tray bg-bay2/70`. Money on paper surfaces: `.papergrain text-ink rounded-print`.
4. Palette (no other colors): bay `#150d07`, bay2 `#1f1409`, tray `#271a0e`, amber `#ffb224`, amberdeep `#b97a15`, safelight `#f4a63a`, paper `#f6efe2`, silver `#cfc4b2`, silverdim `#9a8c74`, ink `#2b2015`, inksoft `#6f5c43`, good `#5fd98d`, bad `#f87171`, line `#3a2a18`, linestrong `#4d3620`. Tailwind names: `bg-bay2`, `text-silverdim`, `border-linestrong`, etc.
5. Type: Barlow (UI), IBM Plex Mono via `font-mono` (figures, IDs, dates, stamps, readouts, always with `.tnum` when numeric), Caveat via `.hand` ONLY for occasional grease-pencil notes (sparingly).
6. Status = stamp grammar, never color alone: use `<Stamp tone dashed rotate>`; loan statuses map: Active→amber, Paid→good rotate −2, Overdue→bad dashed rotate 2 (+days), Defaulted→bad solid, Pending→silver dashed, Archived→silver.
7. Currency renders as `"P " + amount.toLocaleString()`.
8. Micro-labels: `text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim`. Never below 11px for functional text.
9. No gradient text, no zero-offset glows, no colored left-borders on cards, no nested cards (rows inside a panel are separated by `divide-y divide-line/70`, not their own bordered cards). Section spacing: `space-y-2.5` for row lists, `space-y-6`/`gap-6` between groups. Headings: `text-paper font-semibold text-xl tracking-tight`.
10. Motion: entrance uses class `dev` (optionally `style={{ animationDelay: i * 70 + 'ms' }}`); success flash `pulse-fix`. Do not add other animations.
11. Tables: plain `<table>` with `min-w-[640px]` inside `overflow-x-auto` wrapper; header row `text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong`; body `divide-y divide-line/70`, rows `hover:bg-tray/50 transition-colors`; amounts right-aligned `text-right font-mono font-bold text-paper tnum`.
12. Forms: `Input`/`Select`/`Textarea`/`Checkbox` primitives with `label` prop; errors as red text naming the problem + recovery; submit button label names the action.
13. Dialogs: use `<Dialog open onClose title actions>` (dark) or `paper` prop for print-like content. Never nest a Dialog in a Dialog.
14. Toasts: `const toast = useToast(); toast("message")` or `toast("message", "error")`. Confirmations: `const confirm = useConfirm(); if (await confirm({ title, description })) { ... }`.
15. Loading states: `Skeleton`/`Spinner`/`LinearProgress`; empty states: dashed-border tray panel with a short sentence.
16. Currency helper: define locally `const P = (n:number) => "P " + n.toLocaleString()` (or reuse from an existing util).

## Primitives API (`src/components/ui.tsx`)

- `Button({variant='amber'|'ink'|'ghost'|'outline'|'danger', size='sm'|'md'|'lg', startIcon, endIcon, loading, fullWidth, ...btnProps})`
- `IconButton({label, ...btnProps})`
- `Input({label, error, ...inputProps})`, `Textarea`, `Select({label, options:[{value,label,disabled}], ...selectProps})`, `Checkbox({label, ...})`
- `Panel({pad=true, ...div})` (dark tray card), `Paper` (photo-paper surface), `Divider`
- `Spinner({size})`, `Skeleton({className})`, `ProgressBar({value, tone:'amber'|'good'|'bad'})`, `LinearProgress`
- `Stamp({tone:'amber'|'good'|'bad'|'safelight'|'silver'|'paper', dashed, solid, rotate, children})`
- `Tabs({value, onChange, items:[{value,label,badge?}]})`
- `Dialog({open, onClose, title, children, actions, width?, paper?})`
- `Menu({trigger, items:[{label, onClick, divider?}], align})`
- `ToastProvider`/`useToast()`, `ConfirmProvider`/`useConfirm()` (already mounted in App)
- `Avatar({name})`, `SectionTitle({children, action})`, `Figure({value, label, tone})`
