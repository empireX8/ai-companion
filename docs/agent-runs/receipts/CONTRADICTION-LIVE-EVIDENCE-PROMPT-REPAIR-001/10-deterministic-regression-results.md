# 10 — Deterministic regression results

## Focused CEQR-014

`lib/__tests__/contradiction-live-evidence-prompt-repair.test.ts` — 12 passed

## Focused CEQR-014 + CEQR-013 + CEQR-012 + CEQR-011

4 files / 96 tests PASS

## Related suites (injected runners only; no live provider)

| Suite | Result |
|-------|--------|
| CEQR-013 diagnostic receipt/invariant | PASS (7) |
| CEQR-012 semantic compatibility | PASS (28) |
| CEQR-011 provider/referee | PASS (49) |
| AI SDK runner-option | PASS (3) |
| CEQR-010 controlled natural-entry | PASS (35) |
| Adjudication contract | PASS (47) |
| Confidence calibration | PASS (42) |
| Contradiction evidence | PASS (10) |
| Repaired persistence | PASS (31) |
| Persistence plan | PASS (30) |
| Objectivity referee interface | PASS (28) |

Related total: **12 files / 322 tests PASS**

## Full Vitest

| Metric | CEQR-013 baseline | CEQR-014 result |
|--------|-------------------|-----------------|
| Failing files | 5 | 5 |
| Failing tests | 7 | 7 |
| Passing files | 318 | 319 |
| Passing tests | 4333 | 4345 |

Known failure set expanded: **NO**

Passing delta (+1 file / +12 tests) explained by new CEQR-014 focused suite.

Failing files unchanged:

- `lib/__tests__/canonical-fixture-composition-gate.test.ts`
- `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
- `lib/__tests__/orvek-adapters.test.ts`
- `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
- `lib/__tests__/today-production-movement-depth.test.ts`

## Live provider

No live provider invoked by any test in this slice.
Live provider attempts this slice: **0**
