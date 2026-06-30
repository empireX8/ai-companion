# Current State Check

## Observed mismatches

- Today still treated `/what-changed` as non-integrated even though the route already renders through `OrvekWhatChangedView` and `OrvekV0PageShell`.
- Today primary re-entry actions to `/what-changed`, `/journal-chat`, and `/watch-for` were disabled by the shared-shell allowlist instead of using the real visible v0 target set.
- Today now rows opened Inspector first whenever a selection existed, which incorrectly hijacked fieldwork, decisions, and timeline rows away from their intended route output spaces.
- Today full report remained a deferred text block instead of linking to the live `/what-changed` report surface.

## Source evidence

- `components/orvek-v0/pages/today.tsx`
- `lib/orvek-adapters/today.ts`
- `lib/orvek-v0/today-workbench-routes.ts`
- `app/(root)/(routes)/what-changed/page.tsx`
- `components/orvek-workbench/OrvekWhatChangedPage.tsx`
- `lib/__tests__/today-workbench-routes.test.ts`

## Shared cleanup noted during inspection

- The dormant `V0TodayView` quick check-in chips still carried blocked `/check-ins` hrefs.
- The mounted production Today page does not render those chips, but the stale component was gated to an honest unavailable state while the Today route helper was being repaired.
