# 10 — Tests and validation

## Focused CEQR-012

- 28 passed / 0 failed

## CEQR-011 + AI SDK runner options + CEQR-012

- 80 passed / 0 failed (3 files)

## Related suites

- 292 passed / 0 failed (8 files)

## Full Vitest

| Metric | Baseline | This slice |
|---|---|---|
| Failed files | 5 | 5 |
| Passed files | 316 | 317 |
| Failed tests | 7 | 7 |
| Passed tests | 4298 | 4326 (+28 CEQR-012) |
| Failure set expanded | — | **NO** |

## Other gates

- `npx tsc --noEmit` — pass
- changed-file ESLint — pass
- `git diff --check` — pass
- production build (env loaded) — pass
- secret / personal-identifier scans — pass
- live provider run — **not executed**
