# 06 — Provider budget and timeout policy

## Pre-live policy (retained)

| Policy | Exact value | Source |
|--------|-------------|--------|
| maxRetries | 0 | `CONTRADICTION_LIVE_MAX_RETRIES` |
| timeoutMs | 45000 | `CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS` |
| maxTotalCalls | 8 | `CONTRADICTION_LIVE_MAX_TOTAL_CALLS` |
| suggested per-case | 2 | `CONTRADICTION_LIVE_MAX_CALLS_PER_CASE` |
| One runner invocation | one provider attempt | maxRetries=0 |

## Actual completed Phase-2 result

| Metric | Value |
|--------|-------|
| Orchestrator invocations | **1** |
| adjudicatorCallCount | **3** |
| refereeCallCount | **0** |
| total / liveProviderAttempts | **3** |
| maxRetries | 0 |
| timeoutMs | 45000 |
| maxTotalCalls (budget) | 8 |
| Second live run | **not performed; not permitted** |

CEQR-017 must never be re-run. Failed cases were not manually retried.
Unattempted referee calls remained 0.
