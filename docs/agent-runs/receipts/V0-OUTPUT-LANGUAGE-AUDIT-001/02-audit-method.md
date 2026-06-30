# Audit Method

- Searched the visible v0 routes and their wrappers with `rg`, then opened the relevant files with `nl -ba` for line-accurate review.
- Checked production and reference text in:
  - `components/orvek-v0/pages/decisions.tsx`
  - `app/(root)/(routes)/journal-chat/page.tsx`
  - `components/orvek-v0/pages/what-changed.tsx`
  - `components/orvek-v0/pages/today.tsx`
  - `components/orvek-workbench/OrvekDecisionsPage.tsx`
  - `components/orvek-workbench/OrvekWhatChangedPage.tsx`
  - `components/orvek-workbench/OrvekTodayPage.tsx`
  - `lib/what-changed-surface.ts`
  - `lib/today-reentry.ts`
  - `components/orvek-v0/pages/explore.tsx`
  - `components/orvek-v0/pages/timeline.tsx`
  - `components/orvek-v0/pages/map.tsx`
  - `components/watch-for/WatchForItemCard.tsx`
  - `components/command/CommandPalette.tsx`
  - the route pages for `/actions`, `/what-changed`, and `/watch-for`
- Sampled related tests that lock surface wording or route expectations, especially the Today and What Changed suites.
- Classification scale used:
  - BLOCKER: trust-rule violation or fake authority / verdict language
  - HIGH: wrong product mental model or noun misuse
  - MEDIUM: output grammar missing or incomplete
  - LOW: copy polish only
  - ACCEPTABLE: contract-aligned or outside the visible intelligence layer
- No source edits were made during the audit.

