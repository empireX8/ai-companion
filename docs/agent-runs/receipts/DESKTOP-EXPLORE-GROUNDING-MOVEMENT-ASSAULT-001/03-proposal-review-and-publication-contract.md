# 03 — Proposal, review, and publication contract

**Run:** DESKTOP-EXPLORE-GROUNDING-MOVEMENT-ASSAULT-001
**Source:** `lib/explore-movement-proposal.ts` + publish/reject routes

## Storage model

| Stage | Storage | Visibility / meaning |
|---|---|---|
| **Proposed** | `ExploreMovementProposal` row | `status=proposed`, proposal exists before any published `ModelUpdate` |
| **Published** | Same proposal row + `ModelUpdate` row | After `publishExploreMovementProposal` → user-visible meaningful update and `modelUpdateId` is set |
| **Rejected** | Same proposal row mutated | Stays internal; `status=rejected`; `modelUpdateId` stays null |

**Invariant:** `proposalId !== modelUpdateId`. `proposalId` is `ExploreMovementProposal.id`; `modelUpdateId` is the canonical published `ModelUpdate.id`.

## Markers in `internalNotes`

| Marker | Meaning |
|---|---|
| `exploreMovementProposal:v1` | Open Explore proposal (`EXPLORE_PROPOSAL_MARKER`) |
| `exploreMovementProposal:rejected` | Rejected (`EXPLORE_PROPOSAL_REJECTED_MARKER`) |

Notes also encode conversation/assistant/user message ids and rationale via `encodeMovementRationaleInInternalNotes`.

## Create (`createExploreMovementProposal`)

Creates an `ExploreMovementProposal` row with:

- `userId`, `conversationId`, `assistantMessageId`, `userMessageId`
- `affectedObjectType/Id`: target user-visible map conclusion
- `beforeSummary` / `afterSummary` / `rationale` / `userFacingSummary`
- `sourcesJson` with evidence and support metadata for:
  - session (conversation)
  - assistant message (supports)
  - user message (context)
  - each owned grounding source (mapped type; `usermap_conclusion` sources skipped for direct link mapping)

Does **not** publish a `ModelUpdate`.

## Publish (`publishExploreMovementProposal` → route)

`POST /api/explore/sessions/[id]/movement-proposals/[proposalId]/publish`

| Outcome | HTTP | Notes |
|---|---|---|
| Success | 200 `{ ok, status: "published", modelUpdateId, idempotent }` | Calls `publishModelUpdateCandidate` |
| Already published | 200 `idempotent: true` | Same id, no duplicate visible update |
| Unauth | 404 in the assault run | Clerk `auth.protect` masked the unauthenticated request |
| Session missing / not owned / not `explore_chat` | 404 | |
| Proposal missing / not owned | 404 | |
| Rejected proposal | 409 | |
| Missing evidence links | 409 | `MODEL_UPDATE_MISSING_EVIDENCE` |

After success, matching assistant messages in-session with `movementProposal.proposalId` get payload updated to `status: "published"` and `modelUpdateId` set to the published `ModelUpdate.id`.

## Reject (`rejectExploreMovementProposal` → route)

`POST /api/explore/sessions/[id]/movement-proposals/[proposalId]/reject`

| Outcome | HTTP |
|---|---|
| Success | 200 `{ ok, status: "rejected", proposalId }` |
| Unauth | 404 in the assault run |
| Session / proposal not found | 404 |
| Already published (`user_visible` + `isMeaningful`) | 409 |

Rejected proposals must **not** appear on Today intelligence / Timeline as published movement (Playwright asserts absence in the final run).

## Review UI surfaces

1. **`ExploreMovementProposalCard`** — Publish / Reject buttons (`explore-publish-movement`, `explore-reject-movement`).
2. **`ExploreConversationReviewStrip`** — Uses `publishExploreMovementProposalReviewItem` / `rejectExploreMovementProposalReviewItem` against the same routes; review-items server includes open Explore proposals as `model_update_candidate` with `movementProposalAction`.

## Pre-publish visibility rule (coded)

While status is `proposed`, Playwright expects `countUserVisibleModelUpdates() === 0`. After publish, exactly one user-visible ModelUpdate exists for the published `modelUpdateId`.
