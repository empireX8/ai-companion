# 03 — Live adjudicator adapter (corrected)

## Module

`lib/contradiction-live-provider-adapters.ts`

## Construction

`createOpenAiContradictionLiveAdapters` builds:

1. `openai(adjudicatorModelId)` language model
2. `createAiSdkStructuredModelRunner({ providerId: "openai", modelId, temperature: 0, maxRetries: 0, timeoutMs })`
3. OpenAI-strict transport schema wrapper (`contradictionModelResultOpenAiStrictSchema`)
4. Live evidence/consistency **prompt addendum only** (`wrapAdjudicatorRunnerForLiveEvidence`)
5. AbortSignal secondary timeout wrapper
6. Shared call-budget wrapper (adjudicator role)

## Evidence-output mutation status

**None.** The live adjudicator wrapper returns the provider result object unchanged.

Removed (forbidden):

- `realignExactClaim`
- `normalizeBlankQualification`
- any mutation of `propositionA/B.qualifications` or `evidenceClaimA/B`

The landed contradiction adjudicator remains the sole authority for source IDs,
exact quotes, offsets, and non-blank proposition fields.

## Fail-closed behaviours

- Missing `OPENAI_API_KEY` → controlled config failure
- Provider exception / malformed structured output → fail-closed
- Abort / native timeout → `model_timeout`
- Call budget exhaustion → controlled failure
- Invalid evidence / blank qualifications → landed validation fails; no referee; no write
