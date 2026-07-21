# 09 — Account / database nonmutation

**Slice:** CONTRADICTION-CONFIDENCE-CALIBRATION-001 / CEQR-006

## Gate script

`docs/agent-runs/receipts/CONTRADICTION-CONFIDENCE-CALIBRATION-001/readonly-account-gate.mjs`

Labels used:

- `--label ceqr-006-before`
- `--label ceqr-006-after`

## Expected invariants (Kay)

| Check | Expected |
| ----- | -------: |
| Pending import total | 53 |
| Pending ReferenceItems | 28 |
| Pending ContradictionNodes | 25 |
| Open genuine import CNs | 0 |
| Chicken-burger active RI | 1 |
| Selected RI status | active |
| PatternClaims | 7 |
| ModelUpdates | 1 |
| UnderstandingEvidenceLinks | 50 |

## Results

| Label | matchesExpected | mutationsPerformed |
| ----- | --------------: | -----------------: |
| ceqr-006-before | true | false |
| ceqr-006-after | true | false |

Observed CN status group both runs: `{ "candidate": 25 }` only.

## Existing 25

- All remain legacy/pre-repair candidates
- Null Side A / Side B span lineage unchanged
- None accepted / rejected / reclassified / backfilled / mutated

## Explicit statements

- This is not empirical calibration
- Model-reported confidence is not a probability estimate
- Successful evaluation is distinct from candidate-floor continuation
- Below-floor recommendations are inspectable but not continuation-ready
- Validated referee continuation evidence is mandatory
- Missing referee validation state fails closed
- There is one authoritative public calibration entry point
- Existing 25 were untouched
- No persistence was enabled
- No provider was invoked
- No database writes occurred
- Production readiness remains **NO**
