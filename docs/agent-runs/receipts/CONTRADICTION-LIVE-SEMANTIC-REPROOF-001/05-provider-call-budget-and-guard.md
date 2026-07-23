# 05 — Provider-call budget and guard

## Dual authorisation

1. `CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED=YES` (exact; unique to CEQR-019)
2. `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1` (underlying live proof runner)

One missing or incorrect guard stops before any provider construction.

## Budget

| Pin | Value |
|---|---|
| Provider | openai |
| Adjudicator model | gpt-4o-mini |
| Referee model | gpt-4o-mini |
| Schema | contradiction-adjudication-schema-v3 |
| Timeout | 45000 ms |
| Retry count | 0 |
| Maximum provider-call budget | 6 |

No automatic retries. Harness records exact adjudicator and referee call counts.

## Schema rejection policy

If the provider transport rejects schema-v3 before adjudicating any case, stop
safely and classify as `HOLD_PROVIDER_SCHEMA_REJECTED`. Do not weaken the schema.
