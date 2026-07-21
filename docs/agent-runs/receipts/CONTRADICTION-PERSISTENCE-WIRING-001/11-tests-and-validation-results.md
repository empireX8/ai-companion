# 11 — Tests and validation results

## Focused persistence tests (post semantic-authority correction)

```text
npx vitest run lib/__tests__/contradiction-persistence-plan.test.ts \
  lib/__tests__/contradiction-repaired-persistence.test.ts
```

- Test files: 2 passed
- Tests: **52 passed**
- Result: **PASS**

## Related CEQR / anti-regression tests

```text
npx vitest run \
  lib/__tests__/contradiction-source.test.ts \
  lib/__tests__/contradiction-dual-side-lineage.test.ts \
  lib/__tests__/contradiction-confidence-calibration.test.ts \
  lib/__tests__/contradiction-adjudication-contract.test.ts \
  lib/__tests__/objectivity-referee-interface-contract.test.ts \
  lib/__tests__/contradiction-materialization.test.ts \
  lib/__tests__/contradiction-detection.test.ts
```

- Test files: 7 passed
- Tests: 217 passed
- Result: **PASS**

## Prisma / TypeScript / Build

- `npx prisma validate` — **PASS**
- `npx prisma generate` — skipped (schema unchanged)
- `npx tsc --noEmit` — **PASS**
- `npm run build` — **PASS**

## Full suite

- Test files: 5 failed | 309 passed (314)
- Tests: 7 failed | **4160** passed (4167)
- Classification: **PASS_WITH_KNOWN_BASELINE_FAILURES**

### Baseline delta vs pre-correction state

| Metric | Pre-correction | After correction | Delta |
| ------ | -------------- | ---------------- | ----- |
| Failed files | 5 | 5 | 0 |
| Failed tests | 7 | 7 | 0 |
| Passed files | 309 | 309 | 0 |
| Passed tests | 4151 | 4160 | +9 |

## Account gates

- before/after both `matchesExpected: true`
- complete exact dual-side = 0; invalid partial = 0; existing 25 untouched

## Prohibited-path scan / `git diff --check`

**PASS**
