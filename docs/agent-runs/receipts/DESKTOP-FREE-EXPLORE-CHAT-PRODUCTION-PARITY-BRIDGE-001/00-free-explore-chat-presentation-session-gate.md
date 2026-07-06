# 00 Free Explore Chat Presentation / Session Gate

## Slice summary

Free Explore chat **session/handler presentation gate** added as safety infrastructure. Chat is treated as a session/handler bridge — not a list-row bridge. No hybrid merge, root fetch, handlers, or UI changes in this slice.

## What was added

### `lib/orvek-v0/production/free-explore-chat-presentation.ts`

- Message/session normalization helpers
- `isFreeExploreChatPresentationReady()` — session/handler gate
- `shouldMergeFreeExploreChatProductionApi()` — fail-closed merge predicate (not wired to hybrid yet)
- `normalizeFreeExploreChatProductionDataApi()` — strips `displayContract`, fake grounding/movement/live-detection leaks
- Safe empty-live state support (booted session, zero messages, no auth error)
- Streaming-safe final assistant row (empty content only while `isSending`)
- Explicit `freeExploreSendHandlerAvailable` requirement

### `lib/orvek-v0/production/free-explore-chat-api.ts`

- `buildFreeExploreChatProductionDataApi()` — builds chat overlay shape **without** `withProductionContract`
- Maps assistant → orvek; withholds grounding/movement/review affordances

### `lib/orvek-v0/data-provider.tsx`

- Optional `freeExploreChatSessionId`, `freeExploreSendHandlerAvailable` fields for gate checks

### `lib/__tests__/free-explore-chat-presentation-readiness.test.ts`

Covers transcript pass, empty-live, malformed/auth/stream failures, handler explicitness, leak withholding, legacy builder rejection, hook/render unchanged, parity.

## Gate policy

| Rule | Status |
|------|--------|
| Session/handler gate (not list-row gate) | **Yes** |
| `displayContract: production` rejected | **Yes** |
| Fake grounding/movement/live-detection withheld | **Yes** |
| Send requires explicit handler flag | **Yes** |
| Auth/boot errors fail closed | **Yes** |
| Hybrid merge | **Not implemented** |
| Root hook chat fetch | **Not implemented** |
| Handlers mounted / send enabled | **No** |
| `FreeExplore` rendering changed | **No** |

## Parity preserved

| Surface | Status |
|---------|--------|
| Fieldwork Bridge | Unchanged |
| Active Questions | Unchanged |
| Investigations | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |
| `createMockOrvekDataApi` | Still baseline for unwired chat |

## Production readiness

**Not production-ready yet.** Gate and builder exist; hybrid overlay, root hook fetch, handler wiring, and tab alignment not landed.

## Product-owner visual check

**Not required for this slice** — no UI or runtime wiring changed.

**Required** when chat hybrid overlay + handler wiring + `FreeExplore` alignment land.

## Recommended next slice

**Slice B — hybrid explore chat overlay**

- `mergeFreeExploreChatOverlay()` in `hybrid-workbench-api.ts`
- Wire gate via `shouldMergeFreeExploreChatProductionApi()` (still no root fetch in B if hook fetch is slice C)
- Or combine B+C: root `useOrvekExploreChat` + handler provider scoped to Explore + hybrid merge

Do **not** enable send at root until handler slice explicitly sets `freeExploreSendHandlerAvailable: true`.
