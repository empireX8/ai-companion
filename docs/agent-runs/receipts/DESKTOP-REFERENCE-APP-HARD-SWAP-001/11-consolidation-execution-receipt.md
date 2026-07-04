# 11 Consolidation Execution Receipt

## Consolidated Branch

- Branch: `desktop-reference-app-hard-swap-consolidated-001`
- Base branch: `origin/staging`
- Base SHA: `9369161ce7035d517be110f735e4240517d5ac4d`

## Replay

Replayed commits, in order:

1. `e6c88f6` - Hard swap production desktop to reference workbench
2. `5c56ba0` - Quarantine old desktop shell UI
3. `5206235` - Add Today workbench intent metadata
4. `ffe04aa` - Consume Today workbench intent metadata
5. `9f1074e` - Bridge Today production data without changing reference parity
6. `60e8ec5` - Document desktop hard-swap stack audit
7. `6b9e867` - Plan desktop hard-swap stack consolidation

## Conflicts

- No cherry-pick conflicts occurred.
- No manual conflict resolution was required.
- No stash was popped.

## Checks

Checks run:

- `npx tsc --noEmit`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `git diff --check`
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts`

Results:

- Pending at receipt creation time.

## Preserved Expectations

- Delta Log is preserved.
- Continue from what changed preserves the reference path.
- Evidence Pointer opens Inspector.
- The accepted reference UI remains protected.
- Non-Today surfaces still use the temporary reference/mock baseline.
- `createMockOrvekDataApi` remains in use for unwired surfaces.
- The stack is not production-ready yet.

## Merge Guidance

- Do not merge until the product-owner visual check passes.
- Do not create a PR yet.
- Do not close #81-#84 yet.

