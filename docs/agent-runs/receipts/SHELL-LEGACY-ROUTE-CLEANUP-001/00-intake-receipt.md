# Intake Receipt - Shell Legacy Route Cleanup

**Date:** 2026-06-30  
**Branch:** `shell-legacy-route-cleanup-001`

## Intent

Repair the highest-risk visible v0 shell interactions that still pointed at blocked legacy public routes or dead output spaces.

## In scope

- Top bar `Import`
- Command palette route exposure
- Journal Chat `Open patterns`
- Your Map legacy context and memory links
- Your Map and Watch For `Active Questions` links
- Decisions `Add outcome` honesty

## Out of scope

- Schema changes
- Middleware changes, unless a route policy bug is proven
- Generation logic changes
- Broad visual restyling
- Explore composer wiring
- Today full report wiring

## Verification plan

- `git diff --check`
- `npx tsc --noEmit`
- `npx playwright test scripts/v0-route-smoke.playwright.ts`
- `npm run build`
- `bash scripts/verify-mindlab.sh`
