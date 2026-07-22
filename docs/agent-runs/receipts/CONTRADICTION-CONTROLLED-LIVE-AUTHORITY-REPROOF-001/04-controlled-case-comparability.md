# 04 — Controlled case comparability

## Fixture identity

CEQR-017 reuses `LIVE_SYNTHETIC_CASES` from
`lib/contradiction-live-provider-referee-proof.ts`.

## Byte-level comparison to CEQR-015

**Byte-identical: YES**

| Case ID | Side A | Side B | Reference |
|---------|--------|--------|-----------|
| clear_contradiction_candidate | I do not drink alcohol at all. | I drank several beers last night. | I do not drink alcohol at all. |
| compatible_contextual | I avoid coffee in the evening. | I drink coffee in the morning. | I avoid coffee in the evening. |
| ambiguous_insufficient | I might go running later if I feel up to it. | Sometimes I think about exercise. | I might go running later if I feel up to it. |

## Differences from CEQR-015 fixtures

None.

## Preserved comparability axes

- exact source fixture text
- ordered Side A / Side B roles
- session/message lineage patterns
- case labels
- provider/model selection (openai / gpt-4o-mini / gpt-4o-mini)
- temperature (provider default via landed adapters)
- retry policy (0)
- timeout (45000)
- provider-attempt accounting (max 8)
