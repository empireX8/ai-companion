# 06 — Compatible case result

## Case ID

`compatible_contextual`

## Expected semantic direction (not forced)

- compatible contextual distinction
- not Class A
- no referee
- no write

## FACT (recorded)

| Field | Value |
|-------|-------|
| Provider execution status | `failed_safely` |
| Structured object returned | YES (parse reached deterministic validation) |
| Parse status | `invalid` (`parseValidationOutcome`) |
| Selection / proofOutcome | `failed_safely` |
| failureCode | `adjudication_failed` |
| gateStoppedAt | `selection` |
| earliestGate | `deterministic_validation` |
| validationErrorCodes | `fabricated_quote`, `validation_failed` |
| Deterministic evidence validation passed | **NO** |
| Exact evidence claims valid | **NO** |
| Side A exact quote matched | UNKNOWN (`null`) |
| Side A offsets matched | UNKNOWN (`null`) |
| Side B exact quote matched | UNKNOWN (`null`) |
| Side B offsets matched | UNKNOWN (`null`) |
| evidenceFailureSide | `unknown` |
| Became Class A | NO |
| Adjudicator attempts | 1 |
| Referee reached | NO |
| Writer invoked | NO |
| Injected harness write count | 0 |
| Unsafe mutation | NO |
| Latency ms | 3857 |

## CEQR-013 recurrence

| Code | Recurs? |
|------|---------|
| `fabricated_quote` | **YES** |
| `source_id_mismatch` | NO (not in this case's codes) |

## Note

Compatible abstention / non-Class-A semantic outcome was **not** obtained as a
clean semantic result because evidence authority failed first.
