# Intake Receipt

**Date:** 2026-06-30  
**Branch:** `v0-output-language-repair-001`  
**Base branch:** `staging`

## Task

Repair the remaining `V0-OUTPUT-LANGUAGE-AUDIT-001` findings in the visible v0 language layer.

## Goal

Visible v0 output should match the locked Orvek contract for facts, movement, uncertainty, and Today/Re-entry grammar.

## In scope

- Decisions / Actions copy and wiring
- Journal Chat copy and wiring
- What Changed report grammar
- Today / Re-entry grammar
- Matching tests and receipts for this slice

## Out of scope

- Generation logic changes
- Schema changes
- Middleware changes
- Broad UI restyling
- Legacy route reactivation or deletion of old components
- Non-language product rewrites outside the visible v0 surfaces

## Verification target

- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run lib/__tests__/decisions-surface.test.ts lib/__tests__/shell-legacy-route-cleanup.test.ts lib/__tests__/today-reentry.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/what-changed-surface.test.ts`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `npm run build`
