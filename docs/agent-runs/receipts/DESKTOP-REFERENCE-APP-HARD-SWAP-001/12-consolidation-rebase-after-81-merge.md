# 12 Consolidation Rebase After #81 Merge

## Context

- `origin/staging` already contained PR #81 (`1668006`) before this update.
- PR #85 (`desktop-reference-app-hard-swap-consolidated-001` → `staging`) was stale because it was created before #81 landed on staging.
- Goal: rebase/replay onto current `origin/staging` carrying only the remaining accepted #82–#84 outcome.

## Approach

- Reset `desktop-reference-app-hard-swap-consolidated-001` to `origin/staging` (`1668006`).
- Cherry-picked only the remaining stack commits (skipped duplicate #81 hard-swap and quarantine commits already in staging).

Replayed commits, in order:

1. `a88f46b` → `50a235f` — Add Today workbench intent metadata (#82)
2. `82c6c3a` → `a910220` — Consume Today workbench intent metadata (#83)
3. `456e40f` → `8a5e018` — Bridge Today production data without changing reference parity (#84)
4. `9cb9db9` → `a0b81db` — Document desktop hard-swap stack audit
5. `fdb9165` → `b85aea7` — Plan desktop hard-swap stack consolidation
6. `e07bf1b` → `d49ed4e` — Document desktop hard-swap consolidation execution

Skipped (already in staging via #81):

- `5db9474` / `e6c88f6` — Hard swap production desktop to reference workbench
- `1690b8b` / `5c56ba0` — Quarantine old desktop shell UI

## Conflicts

- No cherry-pick conflicts occurred.
- No manual conflict resolution was required.
- No stash was popped.

## Checks

Checks run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts` — PASS (7 files, 60 tests)

## Preserved Expectations

- PR #85 now carries the remaining #82–#84 consolidated outcome on top of current staging.
- Delta Log is preserved.
- Continue from what changed preserves the reference path.
- Evidence Pointer opens Inspector.
- The accepted reference shell remains in place.
- Non-Today surfaces still use the temporary reference/mock baseline.
- `createMockOrvekDataApi` remains in use for unwired surfaces.
- The stack is not production-ready yet.

## Merge Guidance

- Visual check still required before merging #85.
- Do not merge into staging until product-owner sign-off.
- No new PR created; #85 remains the consolidation PR.
