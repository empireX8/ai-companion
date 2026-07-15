# 00 — Intake and current production map

**Run:** DESKTOP-EXPLORE-GROUNDING-MOVEMENT-ASSAULT-001
**Baseline:** staging @ `220d0a0` (`220d0a0d288c86932e85d9e766ec42d4a8c244a9`)
**Date:** 2026-07-15
**Campaign status:** **FAIL** — the assault-specific browser proof passed, but `bash scripts/verify-mindlab.sh` still fails on two pre-existing schema-index Vitest tests.

## Product intent

Prove that Free Explore chat can:

1. Retrieve **user-owned stored evidence** for an assistant reply.
2. Attach an honest **epistemic grounding payload** to the assistant `Message`.
3. Optionally create a **reviewable proposed model movement** (`ModelUpdate` `internal_only`, not yet user-visible).
4. Allow explicit **publish** or **reject** without inventing movement on Today/Timeline until publish.
5. Surface grounding chips + proposal card in Explore, and selected-message grounding in Inspector.

## Production surface map (current)

| Layer | Location | Role |
|---|---|---|
| Schema | `prisma/schema.prisma` → `Message.groundingPayload Json?`, `ExploreMovementProposal` | Persist grounding payload on assistant messages and store reviewable movement proposals |
| Contract | `lib/explore-grounding-contract.ts` | Payload shape, epistemic enums, UI labels, empty helpers |
| Retrieval | `lib/explore-grounding-retrieval.ts` | Collect owned candidates; select VERIFIED/INFERRED sources |
| Orchestrator | `lib/explore-grounding-orchestrator.ts` | Build payload; create proposal when mixed evidence + visible conclusion exist |
| Proposal lifecycle | `lib/explore-movement-proposal.ts` | Create / reject / publish `ExploreMovementProposal` rows and link them to `ModelUpdate` on publish |
| Deterministic provider | `lib/explore-assault-test-provider.ts` | Local-only assault replies (`ORVEK_EXPLORE_ASSAULT_DETERMINISTIC_REPLY=1`) |
| Runtime fixture | `lib/explore-grounding-movement-runtime-fixture.ts` | Seed/cleanup assault evidence + sessions |
| Message write | `POST /api/message` | On `explore_chat`, persist grounding after assistant reply |
| Message list | `GET /api/message/list` | Returns validated `grounding` on each message |
| Grounding GET | `GET /api/explore/messages/[id]/grounding` | Owned message grounding detail |
| Publish | `POST /api/explore/sessions/[id]/movement-proposals/[proposalId]/publish` | `publishModelUpdateCandidate` + payload status update |
| Reject | `POST /api/explore/sessions/[id]/movement-proposals/[proposalId]/reject` | Reject marker on `internalNotes` |
| Free Explore UI | `components/orvek-v0/pages/explore.tsx` | Live chips + `ExploreMovementProposalCard` |
| Proposal card | `components/explore/ExploreMovementProposalCard.tsx` | Publish / reject controls |
| Session review strip | `components/explore/ExploreConversationReviewStrip.tsx` | Review-item publish/reject for movement candidates |
| Inspector | `components/inspector/panels/ChatInspectorPanel.tsx` | Selected-message grounding via bridge |
| Bridge | `lib/explore-message-grounding-bridge.ts` | Explore → Inspector selected grounding state |
| Chat hydration | `useOrvekExploreChat.ts`, hybrid/workbench APIs | Carry `grounding` through list hydrate |
| Playwright | `scripts/explore-grounding-movement-assault.playwright.ts` | Serial browser assault (registered in `playwright.config.ts`) |
| Vitest | `explore-grounding-retrieval.test.ts`, `explore-grounding-movement-assault.test.ts` | Contract + retrieval + proposal unit proof |

## Pre-change gap (baseline)

At staging @ `220d0a0`, Explore chat had conversation/review surfaces but **no** durable per-message grounding payload, **no** Explore-owned movement proposal create/publish/reject path tied to grounding, and no live epistemic chips backed by stored owned evidence.

## Epistemic vocabulary (contract)

`VERIFIED` · `INFERRED` · `UNVERIFIED` · `PENDING_EVIDENCE`

## Campaign blockers (current)

1. Assault-specific browser proof is complete and recorded in the later receipts.
2. Full `bash scripts/verify-mindlab.sh` still fails on pre-existing schema-index Vitest mismatches in `lib/__tests__/surfaced-evidence-pointer-schema.test.ts` and `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`.
