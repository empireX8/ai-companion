# 13 — Tests and validation

## Constraint

No second live provider run during validation. Observed: **no second live run**.

## Focused suites

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| CEQR-013 receipt/invariants | 1 | 7 | PASS |
| CEQR-012 semantic compatibility | 1 | 28 | PASS |
| CEQR-011 provider/referee | 1 | 49 | PASS |
| AI SDK runner options | 1 | 3 | PASS |
| **Combined focused** | **4** | **87** | **PASS** |

## Related suites

10 files / **324** passed / 0 failed (CEQR-010 natural-entry, adjudication,
objectivity referee, confidence, repaired persistence, dual-source
presentation, evidence, source, dual-side lineage, persistence plan).

## Full Vitest

| Metric | Baseline | This slice |
|--------|----------|------------|
| Failed files | 5 | 5 |
| Passed files | 317 | 318 (+1 CEQR-013) |
| Failed tests | 7 | 7 |
| Passed tests | 4326 | 4333 (+7 CEQR-013) |
| Failure set expanded | — | **NO** |

## Other gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | pass |
| Changed-file ESLint | pass |
| Production build (env loaded) | pass |
| `git diff --check` / whitespace | pass |
| Secret pattern scan | pass |
| Personal-identifier scan | pass |
| Prohibited route/import wiring scan | pass |
