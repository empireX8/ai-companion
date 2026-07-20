# 07 — Test and validation results

## Focused suites

| Suite | Result |
|-------|--------|
| `lib/__tests__/objectivity-referee-interface-contract.test.ts` | PASS (28) |
| `lib/__tests__/contradiction-adjudication-contract.test.ts` | PASS (47) |
| `lib/__tests__/contradiction-source.test.ts` | PASS (31) |

Matrix coverage includes outcomes 1–30 from the task brief (combined where coherent).

## TypeScript / build / full suite

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Full suite | 5 failed files / 7 failed tests — exact CEQR-004 baseline match; 305 passed files / 4018 passed tests |

See `validation-summary.json`.
