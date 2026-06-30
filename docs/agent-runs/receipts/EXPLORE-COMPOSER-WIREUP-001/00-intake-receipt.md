# Intake Receipt

**Date:** 2026-06-30  
**Branch:** `explore-composer-wireup-001`  
**Base branch:** `staging`

## Task

Repair the remaining `V0-UX-FLOW-001` finding `explore-composer-wireup`.

## Goal

Explore composer `Ask` and quick prompt actions must target the real Explore chat/log output space instead of incorrectly routing users into Inspector movement.

## In scope

- `components/orvek-v0/pages/explore.tsx`
- `components/orvek-workbench/OrvekExplorePage.tsx`
- `components/orvek-workbench/useOrvekExploreChat.ts`
- Explore wiring tests
- Receipt updates for this slice and the parent `V0-UX-FLOW-001` record

## Out of scope

- Generation logic changes
- Schema changes
- Middleware changes
- Broad Explore redesign or visual restyling
- Today repair slices except receipt updates listing what remains
- Legacy route reactivation or deletion of old components

## Verification target

- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run lib/**tests**/shell-legacy-route-cleanup.test.ts`
- `npx playwright test scripts/v0-route-smoke.playwright.ts`
- `npm run build`
- `bash scripts/verify-mindlab.sh`
