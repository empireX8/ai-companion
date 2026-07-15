# 01 — Grounding and reality-tracking contract

**Run:** DESKTOP-EXPLORE-GROUNDING-MOVEMENT-ASSAULT-001
**Source of truth:** `lib/explore-grounding-contract.ts`
**Version constant:** `explore-grounding-v1` (`EXPLORE_GROUNDING_CONTRACT_VERSION`)

## Payload shape (`ExploreGroundingPayload`)

| Field | Type / notes |
|---|---|
| `version` | Must equal `explore-grounding-v1` |
| `status` | `grounded` \| `ungrounded` \| `insufficient_evidence` |
| `conversationId` | Explore session id |
| `assistantMessageId` | Assistant `Message.id` |
| `userMessageId` | Triggering user `Message.id` |
| `sources[]` | Owned grounding sources with epistemic + claim support |
| `claims[]` | Derived claim texts with epistemic status + `sourceIds` |
| `movementProposal` | Proposal state bound to this reply |

### Source (`ExploreGroundingSource`)

- `sourceId`, `sourceType` / `sourceFamily`, `userId`, `title`, `extract`
- `retrievalReason`
- `claimSupport`: `verifies` \| `infers` \| `context` \| `insufficient`
- `epistemicStatus`: `VERIFIED` \| `INFERRED` \| `UNVERIFIED` \| `PENDING_EVIDENCE`

### Allowed source families

`journal_entry` · `pattern_claim` · `pattern_claim_evidence` · `usermap_conclusion` · `reference_item` · `message` · `session`

### Movement proposal nested object

| Field | Meaning |
|---|---|
| `status` | `proposed` \| `published` \| `rejected` \| `insufficient_evidence` \| `none` |
| `proposalId` | `ExploreMovementProposal.id` while proposed |
| `modelUpdateId` | Canonical published `ModelUpdate.id` set on publish |
| `beforeSummary` / `afterSummary` / `rationale` | Reviewable prior/next/rationale copy |

## UI labels (contract constants)

| Constant | Copy |
|---|---|
| `EXPLORE_PROPOSED_MOVEMENT_LABEL` | `PROPOSED MODEL MOVEMENT` |
| `EXPLORE_PUBLISHED_MOVEMENT_LABEL` | `PUBLISHED MODEL UPDATE` |
| `EXPLORE_REJECTED_MOVEMENT_LABEL` | `REJECTED / DISMISSED PROPOSAL` |
| `EXPLORE_NO_MOVEMENT_LABEL` | `NO MOVEMENT — INSUFFICIENT EVIDENCE` |
| `EXPLORE_GROUNDING_EMPTY_COPY` | `No linked evidence for this reply yet.` |
| `EXPLORE_GROUNDING_INSUFFICIENT_COPY` | `Evidence was retrieved but is insufficient to ground model movement.` |
| `EXPLORE_REFERENCE_GROUNDING_FORBIDDEN_COPY` | `Reference grounding is not used in live Explore chat.` |

## Reality-tracking rules (implemented)

1. **No publish on orchestration.** `orchestrateExploreReplyGrounding` may create an `internal_only` proposal; it never calls `publishModelUpdateCandidate`.
2. **Mixed epistemic gate for movement.** `payloadHasVerifiedAndInferred` requires both `VERIFIED` and `INFERRED` sources before proposal creation.
3. **Owned evidence only.** Retrieval filters candidates to `userId` match; cross-user objects never select.
4. **Empty / insufficient honesty.** `emptyExploreGroundingPayload` yields `ungrounded` or `insufficient_evidence` with `movementProposal.status` of `none` / `insufficient_evidence`.
5. **Separate proposal storage.** `createExploreMovementProposal` writes a separate `ExploreMovementProposal` row; publish links that proposal to a `ModelUpdate`.
6. **Validation.** `isExploreGroundingPayload` gate used on list/detail/publish updates so malformed JSON is not treated as live grounding.

## Retrieval classification (`explore-grounding-retrieval.ts`)

| Overlap density | `claimSupport` | `epistemicStatus` |
|---|---|---|
| Dense (≥3 extract tokens or ≥4 overall) | `verifies` | `VERIFIED` |
| Moderate (≥2) | `infers` | `INFERRED` |
| Weak | `insufficient` (filtered out of selection) | `PENDING_EVIDENCE` at classify step |

Selection prefers a mixed VERIFIED (prefer journal) + INFERRED pair, max 4 sources. When all dense hits classify as VERIFIED, an alternate family may be re-labeled INFERRED so the movement gate can still require mixed support.

## Orchestration (`explore-grounding-orchestrator.ts`)

1. Collect owned candidates → select sources.
2. No sources → `ungrounded` (no candidates) or `insufficient_evidence` (candidates existed but none selected).
3. Sources present → build claims; set `status: grounded`.
4. If insufficient mixed evidence (or no user-visible map conclusion) → no proposal; movement status `insufficient_evidence`.
5. If sufficient → `createExploreMovementProposal` against latest user-visible `UserMapConclusion`; movement status `proposed` and a separate `ExploreMovementProposal` row is stored.

## Schema persistence

`Message.groundingPayload Json?` — written via `persistExploreGroundingPayload` (scoped `updateMany` by `messageId` + `userId`).
`ExploreMovementProposal` — written via `createExploreMovementProposal`; later updated by publish / reject flows.
