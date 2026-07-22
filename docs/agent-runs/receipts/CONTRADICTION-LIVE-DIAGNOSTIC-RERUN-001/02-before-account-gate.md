# 02 — Before account gate

## Script

Landed read-only gate:

`docs/agent-runs/receipts/CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001/readonly-account-gate.mjs`

Output copied to this slice as `account-gate-before.json` with CEQR-013 metadata labels.

## Mode

Read-only. `mutationsPerformed: false`.

## Identity

`userId: "[REDACTED_ACCOUNT_ID]"` — real account identifier never written to receipts.

## Observed aggregates

| Metric | Expected | Observed |
|--------|----------|----------|
| Contradiction nodes | 25 | 25 |
| Candidates | 25 | 25 |
| Evidence spans | 5941 | 5941 |
| Complete dual-side | 0 | 0 |
| Partial | 0 | 0 |
| Legacy incomplete | 25 | 25 |
| Duplicate complete-pair groups | 0 | 0 |

## Result

`matchesExpected: true`

Provider call authorised (no `HOLD_ACCOUNT_GATE_MISMATCH`).
