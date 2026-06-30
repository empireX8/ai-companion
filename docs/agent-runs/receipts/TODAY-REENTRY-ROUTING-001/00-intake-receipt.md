# Intake Receipt

**Date:** 2026-06-30  
**Branch:** `today-reentry-routing-001`  
**Base branch:** `staging`

## Task

Repair the remaining `V0-UX-FLOW-001` Today findings:

- `today-report-link-reentry`
- `today-reentry-allowlist-reconcile`
- `today-now-row-routing`

## Goal

Today report links, re-entry actions, and now-row routing must send users to the correct v0 route or Inspector output space, or remain honestly unavailable.

## In scope

- `components/orvek-v0/pages/today.tsx`
- `lib/orvek-adapters/today.ts`
- `lib/orvek-v0/today-workbench-routes.ts`
- Today routing tests
- Receipt updates for this slice and the parent `V0-UX-FLOW-001` record

## Out of scope

- Generation logic changes
- Schema changes
- Middleware changes
- Broad visual restyling
- Explore / Map / Timeline repair work outside shared Today helpers
- Legacy route reactivation or deletion of old components

## Verification target

- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run lib/**tests**/shell-legacy-route-cleanup.test.ts lib/**tests**/explore-composer-wireup.test.ts`
- `npx playwright test scripts/v0-route-smoke.playwright.ts`
- `npm run build`
- `bash scripts/verify-mindlab.sh`
