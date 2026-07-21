# 11 — Tests and validation

## Focused

```bash
npx vitest run \
  lib/__tests__/contradiction-repaired-persistence.test.ts \
  lib/__tests__/contradiction-persistence-plan.test.ts \
  lib/__tests__/contradiction-duplicate-prevention-schema.test.ts
```

Includes CEQR-007 review correction: empty-state EvidenceSpan race proof
(`concurrent same-plan invocations from empty spans recover exact node after EvidenceSpan P2002`)
via specialized `makeSpanRaceFakeDb()` harness (does not weaken the pre-seeded node-race test).

## Related

```bash
npx vitest run \
  lib/__tests__/contradiction-dual-side-lineage.test.ts \
  lib/__tests__/contradiction-confidence-calibration.test.ts \
  lib/__tests__/contradiction-adjudication-contract.test.ts \
  lib/__tests__/objectivity-referee-interface-contract.test.ts \
  lib/__tests__/contradiction-source.test.ts \
  lib/__tests__/contradiction-materialization.test.ts \
  lib/__tests__/contradiction-detection.test.ts
```

## Tooling

- `npx prisma format`
- `npx prisma validate`
- `npx prisma migrate status`
- `npx tsc --noEmit`
- ESLint on changed TS files only
- `npm run build`
- Full suite `npx vitest run`
- `git diff --check`
- Prohibited-path scan
- Account before/after gate

## Test authoring rule

Do not use CommonJS `require(` in test files. ESM imports only.

## Results

See `12-tests-and-validation-results.md` and `validation-summary.json`.
