# 01 — Current interface and call-path trace

## Pre-patch foundation (at `e608750`)

```
lib/orvek-intelligence-kernel/objectivity-referee.ts
  ObjectivityReferee interface (injectable)
  five outcomes
  defaultRefereeStatus() → not_run
  no production implementation

lib/contradiction-adjudicator.ts
  schema parse → semantic consistency → exact dual-span validation
  only then (if semantic valid) invoke optional objectivityReferee.evaluate
  store outcome string only on refereeStatus
  discard full evaluation locally
  no try/catch around referee

lib/contradiction-same-session-selection.ts
  Class A eligibility ignores referee
  persistable / persistenceAuthorised remain false
```

## Post-patch call path

```
adjudicateContradiction
  → model structured result
  → schema parse
  → semantic consistency gates
  → exact dual-span validation
  → if invalid / abstain / model fail: referee not_run (call count 0)
  → if Class A clear_contradiction + injected referee:
       runObjectivityRefereeSafely
         → catch throw/reject → executionState=failed
         → validateObjectivityRefereeEvaluation
         → completed | invalid_evaluation
  → preserve full ObjectivityRefereeResult on adjudication.referee
  → refereeStatus summary string for audit compatibility
  → persistenceDecision null; createCandidate undefined

selectSameSessionContradictionPair
  → eligibility = Class A only (referee cannot upgrade B/C/D)
  → ambiguity abstention ignores referee ranking
  → refereeContinuationAllowed surfaced; persistable remains false
```

## Production wiring

No production referee implementation.
No provider call.
No materialisation path consumes referee continuation as persistence.
