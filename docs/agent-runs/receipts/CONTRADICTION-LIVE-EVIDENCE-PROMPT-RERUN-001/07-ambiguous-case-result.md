# 07 — Ambiguous case result

## Case ID

`ambiguous_insufficient`

## Expected semantic direction (not forced)

- insufficient or ambiguous evidence
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
| validationErrorCodes | `source_id_mismatch`, `validation_failed` |
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
| Latency ms | 4816 |

## CEQR-013 recurrence

| Code | Recurs? |
|------|---------|
| `fabricated_quote` | NO (not in this case's codes) |
| `source_id_mismatch` | **YES** |

## Note

Ambiguous abstention was **not** obtained as a clean semantic outcome because
evidence authority (`source_id_mismatch`) failed first.
