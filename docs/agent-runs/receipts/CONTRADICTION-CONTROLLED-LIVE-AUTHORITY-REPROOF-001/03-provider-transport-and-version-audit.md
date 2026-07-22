# 03 — Provider transport and version audit

## Current runtime identities

| Identity | Exact value |
|----------|-------------|
| Kernel contract | `orvek-intelligence-kernel-v1` |
| Transport schema | `contradiction-adjudication-schema-v2` |
| Prompt | `contradiction-adjudication-prompt-v3` |
| Live addendum | `contradiction-live-adjudicator-prompt-addendum-v3` |
| Provider | `openai` |
| Adjudicator model | `gpt-4o-mini` |
| Referee model | `gpt-4o-mini` |
| maxRetries | `0` |
| timeoutMs | `45000` |
| max provider attempts | `8` |
| Opt-in env | `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF` |

## Transport evidence shape

`evidenceSpanSelectionSchema` keys: `startOffset`, `endOffset` only.

OpenAI strict live schema mirrors transport offsets-only evidence.

Domain post-binding still uses `ExactEvidenceClaim` (`sourceId` + `exactQuote` + offsets).

## Binding

- `bindExactEvidenceClaimFromOffsets` / `bindDualSideEvidenceClaims` in `lib/orvek-intelligence-kernel/evidence-validation.ts`
- Invoked from `adjudicateContradiction` after transport parse
- Forged provider `sourceId` / `exactQuote` ignored (not consulted)

## Harness reuse decision

**Narrow reuse.** CEQR-017 wraps `runContradictionLiveProviderRefereeProof` with
identical `LIVE_SYNTHETIC_CASES`, writing receipts to this directory via
`scripts/run-contradiction-controlled-live-authority-reproof.ts`.
