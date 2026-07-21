# 13 — Account database nonmutation

## Gate script

`readonly-account-gate.mjs`

Labels:

- `contradiction-duplicate-prevention-before`
- `contradiction-duplicate-prevention-after`

## Pre-slice / post-slice Kay baseline

| Field | Before | After |
| ----- | ------ | ----- |
| matchesExpected | true | true |
| contradictionNodeTotal | 25 | 25 |
| evidenceSpans | 5941 | 5941 |
| completePairDuplicateGroups | 0 | 0 |
| complete_exact_dual_side | 0 | 0 |
| legacy_incomplete | 25 | 25 |
| invalid_partial | 0 | 0 |
| node IDs | unchanged | unchanged |
| span FK rows | unchanged | unchanged |

## Contract

- Gate is read-only (counts / finds / raw SELECT groups only).
- Schema migration DDL was applied after preflight; account row DML did not occur.
- Existing 25 contradiction nodes remain untouched.
- No fixture rows remain committed to the account database.

## Artifacts

- `account-gate-contradiction-duplicate-prevention-before.json`
- `account-gate-contradiction-duplicate-prevention-after.json`
- `account-gate-before-after-compare.json`
- `duplicate-preflight.json`
