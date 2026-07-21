# 04 — Live referee adapter

## Module

`lib/contradiction-live-provider-adapters.ts` → `createStructuredModelObjectivityReferee`

## Construction

Separate from the adjudicator:

1. Distinct `openai(refereeModelId)` language model instance
2. Distinct `createAiSdkStructuredModelRunner` instance
3. OpenAI-strict referee transport schema
4. Timeout + shared call-budget wrappers (referee role)
5. `createStructuredModelObjectivityReferee({ modelRunner: refereeRunner })`

## Contract

- Uses dedicated prompt version `objectivity-referee-live-prompt-v1`
- Receives only `ObjectivityRefereeInput` fields
- Output normalised then validated by landed `objectivityRefereeModelResultSchema`
- Execution still goes through `runObjectivityRefereeSafely` inside adjudication

## Independence properties

- Separate runner instance (even when model id matches adjudicator)
- Separate provider call
- Separate prompt/schema contract
- No hidden shared conversation state
- Adjudicator success cannot substitute for referee execution
- Missing / invalid / failed referee blocks persistence

## Fail closed

- Runner failure throws → `runObjectivityRefereeSafely` → `executionState: failed`
- Malformed / invalid evaluation → `invalid_evaluation` / no continuation
- Never auto-PASS
