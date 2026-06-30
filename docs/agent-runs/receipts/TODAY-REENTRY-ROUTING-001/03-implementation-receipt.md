# Implementation Receipt

## Summary

Today now routes to the live What Changed report, valid re-entry actions are enabled again, and now rows only hand off to Inspector when no valid route output exists.

## Code changes

- `lib/orvek-v0/today-workbench-routes.ts`
  - Added a separate Today re-entry route allowlist alongside the integrated-shell allowlist.
  - Promoted `/what-changed` into the integrated-shell set.
  - Added `resolveTodayNowRowTarget()` so row routing stays route-first with Inspector fallback.
- `lib/orvek-adapters/today.ts`
  - Switched Today action and hero link gating from integrated-shell-only to the broader Today re-entry allowlist.
  - Marked the Today full report CTA as available on `/what-changed`.
  - Left quick check-ins honestly unavailable instead of pointing at blocked `/check-ins`.
- `components/orvek-v0/pages/today.tsx`
  - Rewired production primary actions to use the Today re-entry allowlist.
  - Rewired now rows to navigate to live route outputs before opening Inspector.
- `components/orvek-workbench/views/V0TodayView.tsx`
  - Gated dormant quick check-in chips to an unavailable state for consistency with the repaired Today route contract.
- `lib/__tests__/today-workbench-routes.test.ts`
  - Added regression coverage for route allowlists, full report availability, route-first now-row behavior, and blocked quick check-ins.
- `lib/__tests__/orvek-ux-integration.test.ts`
  - Updated the Today What Changed integration description to reflect the live report route.
- `lib/__tests__/today-surface.test.ts`
  - Updated the Today report fallback test description to reflect live-route plus fallback support.

## No-change confirmation

- No schema changes
- No middleware changes
- No generation logic changes
- No broad visual styling changes
