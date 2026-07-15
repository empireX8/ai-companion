# 02 — Conversation, message, and source identity

**Run:** DESKTOP-EXPLORE-GROUNDING-MOVEMENT-ASSAULT-001

## Identity chain (intended / coded)

```
Session (explore_chat)
  └── user Message.id          → groundingPayload.userMessageId
  └── assistant Message.id     → groundingPayload.assistantMessageId
        └── groundingPayload.conversationId === Session.id
        └── sources[].sourceId (owned stored objects)
        └── movementProposal.proposalId === ExploreMovementProposal.id (internal_only when proposed)
              └── on publish: movementProposal.modelUpdateId === ModelUpdate.id (user_visible; distinct from proposal id)
```

## Message write path (`POST /api/message`)

1. User message created with real Prisma id.
2. Assistant reply persisted via `persistAssistantReply`.
3. When `session.surfaceType === "explore_chat"`:
   - `orchestrateExploreReplyGrounding(...)`
   - `persistExploreGroundingPayload` writes `Message.groundingPayload`.
4. Local assault path: if `exploreAssaultDeterministicReplyAllowed()`, reply text comes from `buildExploreAssaultDeterministicReply` and response header `X-Orvek-Explore-Provider: assault-deterministic-local`. Grounding still runs on the real assistant message row.

## List / hydrate (`GET /api/message/list`)

- Selects `groundingPayload`.
- Emits `grounding` only when `isExploreGroundingPayload` passes; otherwise `null`.
- Client `useOrvekExploreChat` / hybrid workbench maps `grounding` onto live Explore messages.

## Grounding detail (`GET /api/explore/messages/[id]/grounding`)

Auth required. Loads message by `{ id, userId }` with session ownership check.

Success JSON:

```json
{
  "messageId": "<Message.id>",
  "conversationId": "<Session.id>",
  "role": "<role>",
  "grounding": { /* ExploreGroundingPayload or null */ }
}
```

## Fixture source identities (seed IDs — stable)

| Object | Exact ID |
|---|---|
| UserMapConclusion | `dev-explore-grounding-movement-assault-conclusion` |
| Verified journal | `dev-explore-grounding-movement-assault-journal-verified` |
| Pattern claim | `dev-explore-grounding-movement-assault-claim` |
| Pattern claim evidence (inferred) | `dev-explore-grounding-movement-assault-claim-evidence` |
| Positive session | `a11ce001-ea01-4000-8000-000000000001` |
| Insufficient session | `a11ce001-ea01-4000-8000-000000000002` |
| Cross-user session | `a11ce001-ea01-4000-8000-000000000003` |
| Cross-user journal | `dev-explore-grounding-movement-assault-cross-user-journal` |
| Cross-user session | `dev-explore-grounding-movement-assault-cross-user-session` |

Marker: `devFixture:explore-grounding-movement-assault`
Prefix: `dev-explore-grounding-movement-assault`

## Runtime conversation / message / proposal IDs (browser)

Created dynamically during Playwright (not fixture-stable):

| Identity | Value |
|---|---|
| `runtimeConversationId` | `a11ce001-ea01-4000-8000-000000000001` |
| `runtimeUserMessageId` | `825def98-6e6f-4f99-acab-341af6016fc2` |
| `runtimeAssistantMessageId` | `6ce635a4-20ca-4f24-8e6d-17d28e00c527` |
| `runtimeProposalId` (`ExploreMovementProposal.id` while proposed) | `cmrm9eju4000sql65ttck9xdp` |
| `runtimeModelUpdateId` (after publish) | `cmrm9fafw000tql65mitoswko` |

Playwright logs:

```
[explore-grounding-movement-assault] conversation=… userMsg=… assistantMsg=… proposal=… modelUpdate=…
```

## UI identity hooks

| Test id / attribute | Purpose |
|---|---|
| `explore-grounding-chip-{sourceId}` | Live source chip (e.g. journal / evidence ids above) |
| `data-epistemic-status` | `VERIFIED` / `INFERRED` / … |
| `explore-proposed-movement` + `data-proposal-id` | Proposed card identity |
| `explore-published-model-update-id` / `data-model-update-id` | Published ModelUpdate id |
| `inspector-grounding-source-{sourceId}` | Inspector selected-message sources |
| `inspector-proposed-movement` | Inspector proposed label |

## Session bridge / review strip

- Explore selection → `setExploreSelectedMessageGrounding` → Inspector `useExploreSelectedMessageGrounding`.
- Review items for open proposals use `movementProposalAction.proposalId` and call the same publish/reject routes (`lib/explore-conversation-review.ts`).
