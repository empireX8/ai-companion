# 05 — Non-bypass and failure boundaries

## Semantic non-upgrade

Object-specific adjudication owns ContradictionNode semantic eligibility.

- Class B/C/D never invoke the CN referee path.
- Class B/C/D + fake PASS cannot produce semantic selection.
- Model abstention / validation failure → referee call count 0.

## Deterministic non-bypass

- Invalid spans → referee not invoked.
- Inconsistent Class A flags → referee not invoked.
- Cross-session sources excluded before adjudication (model + referee count 0).
- Empty / incomplete provenance → no selection; referee not used to invent pairs.
- Multiple Class A → ambiguity abstention; referee PASS cannot choose a winner.
- Fan-out prohibited.

## Failure handling

`runObjectivityRefereeSafely`:

- throw → `executionState=failed`, not `not_run`, not PASS
- async reject → same
- malformed evaluation → `invalid_evaluation`
- continuation blocked
- semantic Class A may remain inspectable; persistence still null/false/undefined
- no deterministic semantic fallback

## Persistence boundary (unchanged)

- `persistenceDecision: null`
- `persistenceAuthorised: false`
- `persistable: false`
- `createCandidate: undefined`
- no DetectedContradiction from referee
- no materialisation call
- no ContradictionNode create/update
