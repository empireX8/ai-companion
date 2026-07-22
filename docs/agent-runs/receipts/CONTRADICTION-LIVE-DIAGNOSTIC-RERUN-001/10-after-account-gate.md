# 10 — After account gate

## Script

Same landed read-only gate as before:

`docs/agent-runs/receipts/CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001/readonly-account-gate.mjs`

## Observed aggregates (after)

| Metric | Observed |
|--------|----------|
| Contradiction nodes | 25 |
| Candidates | 25 |
| Evidence spans | 5941 |
| Complete dual-side | 0 |
| Partial | 0 |
| Legacy incomplete | 25 |
| Duplicate complete-pair groups | 0 |

## Before/after comparison

Exact match on all aggregate fields. `matchesExpected: true`.

## Mutation verdict

No unexpected database mutation. Not `FAIL_UNSAFE_TO_PROCEED`.
