# 01 — Current surface audit

## Schema

`ContradictionNode` already has nullable ordered FKs:

- `sideASourceSpanId`
- `sideBSourceSpanId`

Unique identity: `(userId, sideASourceSpanId, sideBSourceSpanId)` (CEQR-007).

## Hazard retained but not reused as dual-source authority

`app/api/contradiction/[id]/route.ts` still enriches legacy `ContradictionEvidence` with a first-`EvidenceSpan`-per-`messageId` `spanId` for the evidence bag.

Dual-source presentation does **not** use that heuristic. Exact Side A/B sources resolve only from ordered span FKs via `lib/contradiction-dual-source-presentation.ts`.

## Surfaces audited

| Surface | Pre-slice behaviour |
| --- | --- |
| List `/api/contradiction` | Returned span FKs; no verified excerpts |
| Detail `/api/contradiction/[id]` | Propositions + evidence bag; first-span heuristic for evidence.spanId |
| Inspector `/api/inspector/contradictions/[id]` | Propositions + counts; status allowlist excludes `candidate` |
| Candidates page | Side A/B proposition text only |
| `ContradictionsInspectorPanel` | Truncated Side A/B propositions |
| `SelectedObjectEvidencePanel` Contradiction panel | Side A/B propositions only |

## Hash utility reused

`hashExactQuoteSlice` from `lib/contradiction-dual-side-lineage.ts` (SHA-256 of exact quote slice).
