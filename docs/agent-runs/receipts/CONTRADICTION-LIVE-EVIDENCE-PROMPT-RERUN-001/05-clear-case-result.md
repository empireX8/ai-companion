# 05 — Clear case result

## Case ID

`clear_contradiction_candidate`

## Expected semantic direction (not forced)

- clear contradiction candidate
- valid Side A / Side B exact evidence
- Class A eligibility
- referee reached
- any persistence injected/in-memory only

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
| validationErrorCodes | `fabricated_quote`, `clear_contradiction_requires_valid_spans`, `validation_failed` |
| Deterministic evidence validation passed | **NO** |
| Exact evidence claims valid | **NO** |
| Side A exact quote matched | UNKNOWN (`null`) |
| Side A offsets matched | UNKNOWN (`null`) |
| Side B exact quote matched | UNKNOWN (`null`) |
| Side B offsets matched | UNKNOWN (`null`) |
| evidenceFailureSide | `unknown` |
| Class A selection | NO |
| Adjudicator attempts | 1 |
| Referee reached | NO |
| Writer invoked | NO |
| Injected harness write count | 0 |
| Unsafe mutation | NO |
| Latency ms | 4927 |

## CEQR-013 recurrence

| Code | Recurs? |
|------|---------|
| `fabricated_quote` | **YES** |
| `source_id_mismatch` | NO (not in this case's codes) |
