# Checkpoint 5/6 — Verification and Regressions

**Regression checkpoint result:** **PASS WITH RISKS**

---

## Targeted assault tests

| Suite | Result |
|---|---|
| `model-movement-report-contract.test.ts` | 7 / 7 |
| `today-movement-depth-route.test.ts` | 6 / 6 |
| `today-production-movement-depth.test.ts` | 4 / 4 |
| `model-movement-rationale-encoding.test.ts` | 5 / 5 |
| `today-movement-report-parity.test.ts` | 9 / 9 |
| `what-changed-reality-report.test.ts` | pass |
| `orvek-adapters.test.ts` | pass (incl. new depth case) |
| `today-workbench-routes.test.ts` | 17 / 17 |
| `phase2t-candidate-publish-helper.test.ts` | pass |
| `orvek-structural-fidelity.test.ts` | pass |

---

## `bash scripts/verify-mindlab.sh`

| Check | Result |
|---|---|
| `git diff --check` | **PASS** |
| `tsc --noEmit` | **PASS** (after final test-mock typing closeout) |
| `vitest run` | **FAIL** (7 pre-existing baseline only) |
| `npm run build` | **PASS** |
| Trust language | **PASS** |
| Legacy surfaces | **PASS** |

**Summary:** 5 PASS / 1 FAIL — Vitest only; assault-introduced TS2345 test-mock error repaired.

**Independent re-verify after product repair:** PASS WITH RISKS; only blocking finding was the test-mock TypeScript error (now fixed). Browser/overlay risks remain.

---

## Full Vitest denominator

| Metric | Baseline (`bb00df1`) | After assault |
|---|---|---|
| Failed | 7 | 7 |
| Passed | 3711 | 3734 (+23 new tests after repair) |
| Total | 3718 | 3741 |

**Conclusion:** No new failures introduced; seven failures reproduce on clean staging.

---

## Scope inspection (uncommitted diff)

**In scope:** movement/report contract, snapshot materialization, depth API, Today/Timeline/hybrid/overlay integration, targeted tests, runtime fixture script, receipts.

**Out of scope (not touched):** Map, Decisions, Explore, Investigations layouts; schema; reference zip data; global production flag.

---

## Checkpoint verdict

**PASS WITH RISKS** — verification green except known baseline Vitest failures.
