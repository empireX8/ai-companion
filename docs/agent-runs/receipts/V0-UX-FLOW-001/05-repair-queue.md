# Repair Queue

## Core Spine Verdict
- [Capture/input] Journal Chat composer -> session + message creation: WIRED
  - Evidence: `app/(root)/(routes)/chat/_components/SurfaceChatShell.tsx`
  - Suggested repair slice: `none`
- [Receipt/data] Journal Chat send -> stored session messages and surfaced receipts: WIRED
  - Evidence: `app/(root)/(routes)/chat/_components/SurfaceChatShell.tsx`
  - Suggested repair slice: `none`
- [Object/model update] Today / What Changed model-update output -> What Changed report: WIRED
  - Evidence: `components/orvek-v0/pages/today.tsx`, `components/orvek-v0/pages/what-changed.tsx`
  - Suggested repair slice: `none`
- [Report/model movement] What Changed and Today movement cards -> Inspector movement: WIRED
  - Evidence: `components/orvek-v0/pages/today.tsx`, `components/orvek-v0/pages/what-changed.tsx`
  - Suggested repair slice: `none`
- [Inspector] Evidence / Context boundary for model_update: WIRED
  - Evidence: `components/inspector/panels/SelectedObjectEvidencePanel.tsx`, `lib/__tests__/inspector-surface-wiring.test.ts`
  - Suggested repair slice: `none`
- [Inspector] Mind Model Movement boundary for model_update: WIRED
  - Evidence: `components/inspector/panels/ModelMovementInspectorPanel.tsx`, `lib/__tests__/inspector-surface-wiring.test.ts`
  - Suggested repair slice: `none`
- [Report/movement] Re-entry action from report surfaces -> Today / Your Map / Timeline / Watch For: WIRED
  - Evidence: `components/orvek-v0/pages/what-changed.tsx`, `lib/what-changed-surface.ts`
  - Suggested repair slice: `none`
- [Related object links] Map / Watch For / inspector continuity links -> correct detail or inspector target: WIRED
  - Evidence: `components/your-map/YourMapDetailPane.tsx`, `components/watch-for/WatchForItemCard.tsx`, `components/watch-for/WatchForInspectorAction.tsx`
  - Suggested repair slice: `none`

## Repair Queue

### Critical Path Wiring
- `today-reentry-allowlist-reconcile`
- `today-now-row-routing`

### Inspector/Detail Routing
- `none`

### Empty-State Honesty
- `today-report-link-reentry`
- `decisions-entry-cta-copy`
- `explore-honest-cta-copy`
- `explore-fieldwork-cta-copy`

### Duplicate Navigation Cleanup
- `none`

### Data/API Mismatch
- `today-report-link-reentry`

### Later Visual Polish
- `none`

Completed in `shell-legacy-route-cleanup-001`:
- `shell-legacy-route-cleanup`
- `journal-chat-legacy-link-cleanup`
- `your-map-legacy-link-cleanup`
- `watch-for-footer-legacy-cleanup`
- `map-open-questions-link-cleanup`
- `your-map-footer-legacy-cleanup`
- `decisions-outcome-honesty`

Completed in `explore-composer-wireup-001`:
- `explore-composer-wireup`

Recommended next single repair slice:
- `today-report-link-reentry`

Reason:
- The core spine is mostly wired.
- The Explore wrong-target wiring is repaired.
- The next most visible remaining failure is the Today full-report dead end.
- Today re-entry allowlist and now-row routing remain separate follow-up slices.
