# 07 — Test and validation results

## Focused suites

| Suite | Result |
|-------|--------|
| `lib/__tests__/contradiction-source.test.ts` | PASS (31) |
| `lib/__tests__/contradiction-detection.test.ts` | PASS (18) |
| `lib/__tests__/contradiction-adjudication-contract.test.ts` | PASS (47) |
| `lib/__tests__/contradiction-backfill.test.ts` | PASS (1) |

Contract coverage includes:

- cross-session exclusion (model call count = 0)
- source completeness fail-closed paths
- zero / one / ambiguous selection
- highest-overlap failure without forced-one
- marker-only → zero selection
- partial-compliance Class B → zero selection
- true same-session Class A semantic selection (non-persistable)
- same-message exact sources
- validation / model failure
- referee not_run / ABSTAIN / fake PASS cannot authorise persistence
- live/import session wiring assertions
- materialisation boundary (no selection → materialise wiring)

## Related path tests

| Suite | Result |
|-------|--------|
| `lib/__tests__/import-archive.test.ts` | PASS |
| `lib/__tests__/native-memory-reference-route.test.ts` | PASS |

## TypeScript / build / full suite

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Full suite | 5 failed files / 7 failed tests — exact CEQR-003 baseline match; 3990 passed |

See `validation-summary.json`.
