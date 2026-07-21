# 08 — Tests and validation results

**Slice:** CONTRADICTION-CONFIDENCE-CALIBRATION-001 / CEQR-006

## Focused new policy tests

```bash
npx vitest run lib/__tests__/contradiction-confidence-calibration.test.ts
```

Result: **PASS** — 1 file, 42 tests.

Coverage includes:

- valid PASS
- optional PASS adjustment (lower / equal / increase / malformed)
- PASS_WITH_LOWER_CONFIDENCE (including above-to-below floor crossing)
- blocking referee states/outcomes
- mandatory referee validation / continuation evidence (omitted / null / undefined / false / malformed / non-empty)
- invalid numeric confidence
- semantic gates
- threshold boundaries via the single public entry point (below / equal / above)
- anti-regression against type/marker/overlap smuggling
- non-persistence source scan; band mapper not exported
- below-floor successful evaluation with `continuationReady: false`

## Related suites

```bash
npx vitest run \
  lib/__tests__/contradiction-adjudication-contract.test.ts \
  lib/__tests__/objectivity-referee-interface-contract.test.ts \
  lib/__tests__/contradiction-source.test.ts \
  lib/__tests__/contradiction-dual-side-lineage.test.ts \
  lib/__tests__/contradiction-detection.test.ts \
  lib/__tests__/contradiction-materialization.test.ts
```

Result: **PASS** — 6 files, 175 tests.

Same-session selection coverage lives in `contradiction-source.test.ts` (included above).

## TypeScript

```bash
npx tsc --noEmit
```

Result: **PASS**

## Production build

```bash
npm run build
```

Result: **PASS**

## Full suite

```bash
npx vitest run
```

| Metric | CEQR-005 baseline | This slice (post-review) | Delta |
| ------ | ----------------: | -----------------------: | ----: |
| Failed files | 5 | 5 | 0 |
| Failed tests | 7 | 7 | 0 |
| Passed files | 306 | 307 | +1 |
| Passed tests | 4066 | 4108 | +42 |
| Total tests | 4073 | 4115 | +42 |

Exact failed files/tests match the established baseline (5 files / 7 tests).

## Classification

**PASS_WITH_KNOWN_BASELINE_FAILURES**

## Review correction semantics

- Successful evaluation is distinct from candidate-floor continuation
- Below-floor recommendations are inspectable but not continuation-ready
- Validated referee continuation evidence is mandatory
- Missing referee validation state fails closed
- One authoritative public calibration entry point
- Persistence remains blocked
- Production readiness remains **NO**
