# 04 — Outcome validation and continuation policy

## Outcome-specific validation (`validateObjectivityRefereeEvaluation`)

| Outcome | Required | Forbidden / constraints |
|---------|----------|-------------------------|
| PASS | nonblank rationale | no automatic persistence |
| PASS_WITH_LOWER_CONFIDENCE | rationale + finite adjustedConfidence in [0,1] strictly &lt; proposed | equal/higher rejected |
| ROUTE_TO_DIFFERENT_OBJECT_TYPE | rationale + nonblank routedObjectType ≠ proposed (normalised) | same type rejected |
| REQUEST_MORE_EVIDENCE | nonblank rationale | continuation blocked |
| ABSTAIN | nonblank rationale | continuation blocked |

Unknown outcomes and blank rationales fail closed.

## Continuation policy (`refereeAllowsContinuation`)

| State / outcome | Continuation allowed |
|-----------------|----------------------|
| not_run | NO |
| failed | NO |
| invalid_evaluation | NO |
| PASS | YES |
| PASS_WITH_LOWER_CONFIDENCE | YES |
| ROUTE_TO_DIFFERENT_OBJECT_TYPE | NO |
| REQUEST_MORE_EVIDENCE | NO |
| ABSTAIN | NO |

Named **continuation / gate eligibility**, never `persistable` or `persistenceAuthorised`.

The referee interface alone cannot authorise persistence.
