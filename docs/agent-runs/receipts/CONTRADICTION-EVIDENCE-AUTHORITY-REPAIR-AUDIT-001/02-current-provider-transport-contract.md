# 02 — Provider transport contract (after CEQR-016)

## Before (schema-v1)
`evidenceClaimA` / `evidenceClaimB` required:
- `sourceId` (model-authored)
- `exactQuote` (model-authored)
- `startOffset` / `endOffset` (model-authored)

## After (schema-v2)
Transport evidence selections require ONLY:
- `startOffset`
- `endOffset`

Provider-authored `sourceId` / `exactQuote` keys are not part of the transport contract. If present on raw objects, Zod strips them and binding never consults them.

## Version identities
- Schema: `contradiction-adjudication-schema-v2` (historical v1 retained)
- Prompt: `contradiction-adjudication-prompt-v3` (historical v2 retained)
- Live addendum: `contradiction-live-adjudicator-prompt-addendum-v3` (historical v1/v2 retained)

## OpenAI strict transport
`contradictionModelResultOpenAiStrictSchema` derives from the offsets-only transport schema.
