# 02 Bounded Free Explore Chat Root Fetch

## Slice summary

Bounded read-only Explore chat session/message wiring in the root hybrid hook. Builds `freeExploreChatApi` and passes it as the **9th argument** to `buildHybridWorkbenchDataApi`. Session/handler gate still controls merge. Send remains disabled.

## What was added

### `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`

- Calls `useOrvekExploreChat({})` for session boot + message list read state
- Builds `freeExploreChatApi` via `buildFreeExploreChatProductionDataApi()` with `sendHandlerAvailable: false`
- Passes ninth argument: `buildHybridWorkbenchDataApi(..., investigationsApi, freeExploreChatApi)`
- Does **not** expose `sendMessage`, `OrvekPageHandlersProvider`, or `onSend`

### `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`

Covers hook wiring, 9th-arg pass-through, ready merge, empty-live, boot/auth/malformed fallback, send disabled, handler not mounted, tab unchanged, parity, shell quarantine.

### Test updates

- `investigations-hybrid-fetch.test.ts`, `hybrid-workbench-api.test.ts`, `free-explore-chat-presentation-readiness.test.ts` — 9-arg hook regex / wiring expectations

## Bridge policy

| Source | Status |
|--------|--------|
| `useOrvekExploreChat` session/message read | **Used** |
| `sendHandlerAvailable: false` | **Enforced in hook + merge overlay** |
| Production write handlers | **Not mounted** |
| `FreeExplore` rendering | **Unchanged** (still `isProductionDisplay` + disabled Ask) |

## Explicit non-goals (this slice)

- Send not enabled — no active `onSend` handler
- `FreeExplore` tab alignment not changed — data may enter hybrid API behind gate but tab does not consume `hasLiveExploreChat`
- Fake grounding/movement/review not merged
- Legacy `/explore` route not restored as root UI

## Parity preserved

| Surface | Status |
|---------|--------|
| Fieldwork Bridge | Unchanged |
| Active Questions | Unchanged |
| Investigations | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |

## Production readiness

**Not production-ready yet.** Chat state enters hybrid provider behind gate when session boots successfully, but tab still shows reference transcript and Ask remains disabled without handlers.

## Product-owner visual check

**Not required for this slice** — Free Explore UI unchanged; live transcript not consumed by tab yet.

**Required** when Slice D (FreeExplore tab alignment + optional handler enable slice) lands.

## Recommended next slice

**Slice D — FreeExplore tab alignment**

- `hasLiveExploreChat` pattern in `FreeExplore()` (not `isProductionDisplay`)
- Consume `exploreMessages` / `freeExploreChatSessionId` when gate passes; reference transcript fallback otherwise
- Keep Ask disabled until explicit handler slice sets `freeExploreSendHandlerAvailable: true` and mounts `OrvekPageHandlersProvider`

**Slice E — handler wiring + send enable** (after tab alignment visual check)
