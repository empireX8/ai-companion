# 03 — Target referee contract

## Interface version

`OBJECTIVITY_REFEREE_INTERFACE_VERSION = "objectivity-referee-interface-v1"`

Independent of contradiction prompt/schema versions.

## Outcomes (exact)

- PASS
- PASS_WITH_LOWER_CONFIDENCE
- ROUTE_TO_DIFFERENT_OBJECT_TYPE
- REQUEST_MORE_EVIDENCE
- ABSTAIN

## Execution states (exact)

- `not_run`
- `completed`
- `failed`
- `invalid_evaluation`

## Result type

`ObjectivityRefereeResult` preserves:

- interfaceVersion
- executionState
- outcome (null unless completed)
- rationale
- proposedObjectType / proposedConfidence
- adjustedConfidence
- routedObjectType
- validationErrors
- continuationAllowed
- errorMessage

## Meaning of PASS

PASS = may continue to a later deterministic persistence gate.

PASS ≠ persist now.

PASS ≠ persistenceAuthorised.

PASS ≠ createCandidate.
