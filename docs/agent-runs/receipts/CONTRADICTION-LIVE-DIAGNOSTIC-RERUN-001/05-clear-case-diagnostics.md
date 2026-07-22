# 05 — Clear case diagnostics

## Case ID

`clear_contradiction_candidate`

## Synthetic meaning (summary only)

Side A: speaker does not drink alcohol. Side B: speaker drank beers last night.

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
| validationErrorCodes | `fabricated_quote`, `clear_contradiction_requires_valid_spans`, `validation_failed` |
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
| Latency ms | 5562 |

## Result class (evidence-supported)

**A. exact-evidence failure** — primary codes are evidence-span failures under
deterministic validation. Structured transport parse succeeded enough to reach
validation (not class D).
