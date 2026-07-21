# 08 — Live execution results (corrected)

> Prior receipt `live-execution-receipt.SUPERSEDED-pre-correction.json` is
> **superseded**. It claimed PASS using adjudicator evidence-output mutation
> (offset realignment / blank-qualification fill / full-text fallback). That
> behaviour has been removed.

Source: `live-execution-receipt.json` (sanitized, post-correction, single run)

## Summary

| Field | Value |
|---|---|
| Ran | true |
| Provider | openai |
| Adjudicator model | gpt-4o-mini |
| Referee model | gpt-4o-mini |
| Independence | separate_call_same_provider_same_model |
| maxRetries | 0 |
| native timeoutMs | 45000 |
| providerAttemptCountExact | true |
| evidenceOutputMutated | false |
| unsafeMutationDetected | false |
| Classification | **HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED** |

## Call counts (exact provider attempts)

| Role | Count |
|---|---|
| Adjudicator | 3 |
| Referee | 0 |
| Total | 3 / max 8 |

## Case A — clear contradiction candidate

| Field | Value |
|---|---|
| Status | failed_safely |
| Failure | adjudication_failed |
| Write | false |
| Referee calls | 0 |
| Harness nodes/spans | 0 / 0 |

Unmodified provider structured output did not pass landed evidence/consistency
gates. No evidence rewriting was applied.

## Case B — compatible contextual

| Field | Value |
|---|---|
| Status | failed_safely |
| Failure | adjudication_failed |
| Write | false |
| Strict compatibleCaseNoWrite | false |

Not a clean semantic no-match; provider output failed adjudication validation.

## Case C — ambiguous / insufficient (optional)

| Field | Value |
|---|---|
| Status | failed_safely |
| Write | false |
| ambiguousCaseNoWrite | true (no write; not a provider_failed status) |

## PASS predicate (not met)

PASS requires all of:

- clearContradictionWriteProven
- compatibleCaseNoWrite (strict semantic no-write path)
- total attempts ≤ budget
- no unsafe mutation

Observed: clear write not proven; compatible strict no-write false → HOLD.
