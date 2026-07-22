# 06 — Compatible case diagnostics

## Case ID

`compatible_contextual`

## Synthetic meaning (summary only)

Side A: avoid coffee in the evening. Side B: drink coffee in the morning.

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
| validationErrorCodes | `fabricated_quote`, `validation_failed` |
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
| Latency ms | 3453 |

## Result class (evidence-supported)

**A. exact-evidence failure** — `fabricated_quote` under deterministic
validation. Compatible abstention / semantic acceptance was not reached
(not class E).
