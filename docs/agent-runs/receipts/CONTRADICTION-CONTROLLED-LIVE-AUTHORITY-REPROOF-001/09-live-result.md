# 09 — Live result

## Status

**EXECUTED — one authorised Phase-2 orchestrator invocation**

## Classification

`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`

## Process / runtime

| Field | Value |
|-------|-------|
| liveExecuted | true |
| liveProviderAttempts | 3 |
| adjudicatorCallCount | 3 |
| refereeCallCount | 0 |
| liveRunnerInvocationCount | 1 |
| exitCode | 4 |
| runtimeIdentitiesMatched | true |
| providerId | openai |
| adjudicatorModelId | gpt-4o-mini |
| refereeModelId | gpt-4o-mini |
| schemaVersion | contradiction-adjudication-schema-v2 |
| promptVersion | contradiction-adjudication-prompt-v3 |
| liveAddendumVersion | contradiction-live-adjudicator-prompt-addendum-v3 |
| maxRetries | 0 |
| timeoutMs | 45000 |
| maxTotalCalls | 8 |
| unsafeMutationDetected | false |
| realAccountMutated | false |
| productionReady | false |

## Account gates

| Field | Value |
|-------|-------|
| beforeAccountGateExecuted | true |
| beforeAccountGateMatched | true |
| afterAccountGateExecuted | true |
| afterAccountGateMatched | true |
| accountAggregatesUnchanged | true |
| accountGateError | null |

## Case summary

| Case | Outcome |
|------|---------|
| clear_contradiction_candidate | failed_safely at deterministic_validation (internal_inconsistency: clear_contradiction + changedBeliefOverTime) |
| compatible_contextual | no_candidate — validation passed; Class C compatible_states |
| ambiguous_insufficient | no_candidate — model abstained |

## Authority delta (CEQR-015 codes)

| Code | Case | Class |
|------|------|-------|
| fabricated_quote | clear_contradiction_candidate | INCONCLUSIVE |
| fabricated_quote | compatible_contextual | RESOLVED |
| source_id_mismatch | ambiguous_insufficient | INCONCLUSIVE |

Canonical machine facts: `live-execution-receipt.json` (do not rewrite).
