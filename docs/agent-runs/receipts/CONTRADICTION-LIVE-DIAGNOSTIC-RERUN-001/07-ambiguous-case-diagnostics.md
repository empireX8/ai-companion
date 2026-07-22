# 07 — Ambiguous case diagnostics

## Case ID

`ambiguous_insufficient`

## Synthetic meaning (summary only)

Side A: might go running later. Side B: sometimes thinks about exercise.

## FACT (recorded)

| Field | Value |
|-------|-------|
| Provider execution status | `failed_safely` |
| Structured object returned | YES (parse reached deterministic validation) |
| Parse status | `invalid` (`parseValidationOutcome`) |
| Selection outcome / proofOutcome | `failed_safely` |
| failureCode | `adjudication_failed` |
| gateStoppedAt | `selection` |
| earliestGate | `deterministic_validation` |
| validationErrorCodes | `source_id_mismatch`, `validation_failed` |
| failingFieldPaths | `evidenceClaim` |
| evidenceFailureSide | `unknown` |
| sideAExactQuoteMatched | `null` |
| sideAOffsetsMatched | `null` |
| sideBExactQuoteMatched | `null` |
| sideBOffsetsMatched | `null` |
| Adjudicator attempts | 1 |
| Referee reached | NO |
| Referee outcome | n/a |
| Writer invoked | NO |
| Persistence outcome | no write (`writeExecuted: false`) |
| Unsafe mutation detected | NO |
| Latency ms | 5397 |

## Result class (evidence-supported)

**A. exact-evidence failure** — `source_id_mismatch` under deterministic
validation. Ambiguous abstention was not obtained as a clean semantic outcome
because evidence authority failed first.
