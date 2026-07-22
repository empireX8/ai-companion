# 01 — Landed live failure evidence (CEQR-013)

## Classification retained

`PASS_LIVE_DIAGNOSTIC_ROOT_CAUSE_OBTAINED` (CEQR-013). Process exit code 4 is
not reinterpreted as CEQR-013 failure.

## Exact codes addressed by CEQR-014

| Case | Earliest gate | Codes |
|------|---------------|-------|
| `clear_contradiction_candidate` | `deterministic_validation` | `fabricated_quote`, `clear_contradiction_requires_valid_spans`, `validation_failed` |
| `compatible_contextual` | `deterministic_validation` | `fabricated_quote`, `validation_failed` |
| `ambiguous_insufficient` | `deterministic_validation` | `source_id_mismatch`, `validation_failed` |

## Proven failure class

Structured provider objects reached deterministic domain validation; evidence
claims failed exact evidence authority (`fabricated_quote`, `source_id_mismatch`).

Transport execution and top-level schema parsing were not the failure class.

## Safety facts retained from CEQR-013

- No provider-output mutation
- No runtime prompt change during CEQR-013
- Writer never invoked
- No injected harness write
- No real database mutation
- Account before/after: 25 ContradictionNodes, 25 candidates, 5941 EvidenceSpans,
  25 legacy incomplete-lineage rows
- Referee live execution unproven
- Production readiness NO

## Malformed strings

Exact malformed provider strings were intentionally not retained. This slice
does not claim which incorrect quote or identifier the model emitted.
