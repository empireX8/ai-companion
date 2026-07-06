# 01 Free Explore Chat Hybrid Overlay Merge

## Slice summary

Hybrid Free Explore chat overlay merge in `buildHybridWorkbenchDataApi()` as the **9th argument** after Investigations. Session/handler readiness gate controls merge. No root fetch, no handlers, no UI changes.

## What was added

### `lib/orvek-v0/production/hybrid-workbench-api.ts`

- `mergeFreeExploreChatOverlay()` — merges safe chat/session fields only
- **9th argument:** `freeExploreChatApi`
- Signature: `buildHybridWorkbenchDataApi(baseApi, todayApi, mapApi, timelineApi, decisionsApi, experimentApi, activeQuestionsApi, investigationsApi, freeExploreChatApi)`
- Gated by `shouldMergeFreeExploreChatProductionApi()` + `normalizeFreeExploreChatProductionDataApi()`
- Merged fields: `freeExploreChatSessionId`, `exploreMessages`, `exploreIsLoading`, `explore` composer props, chat empty copy slots
- **Forces** `freeExploreSendHandlerAvailable: false` on merge (send withheld until handler slice)
- Does **not** merge `displayContract`, `exploreGrounding`, `exploreMovement`, or `exploreLiveDetectionCopy` from overlay — reference mock grounding/detection preserved on base

### Tests

- `lib/__tests__/hybrid-workbench-api.test.ts` — +10 overlay merge / parity cases
- `lib/__tests__/free-explore-chat-presentation-readiness.test.ts` — hybrid merge describe block

## Merge policy

| Rule | Status |
|------|--------|
| Session/handler gate controls merge | **Yes** |
| Unsafe/malformed/boot/auth → reference fallback | **Yes** |
| `displayContract` never on hybrid root | **Yes** |
| Fake grounding/movement/live-detection rejected at gate | **Yes** |
| Send handler forced false on merge | **Yes** |
| Root hook chat fetch | **Not implemented** |
| `OrvekPageHandlersProvider` | **Not mounted** |
| `FreeExplore` rendering | **Unchanged** |

## Parity preserved

| Surface | Status |
|---------|--------|
| Fieldwork Bridge | Unchanged |
| Active Questions | Unchanged |
| Investigations | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |
| `createMockOrvekDataApi` | Still baseline for unwired chat at root |

## Production readiness

**Not production-ready yet.** Overlay merge exists but root hook does not fetch/pass `freeExploreChatApi`; tab still reference-only with send disabled.

## Product-owner visual check

**Not required for this slice** — no runtime wiring or UI change.

**Required** when root hook fetch + handler wiring + `FreeExplore` tab alignment land.

## Recommended next slice

**Slice C — bounded root chat fetch + handler provider (send still disabled)**

- Wire `useOrvekExploreChat` in shell or explore-scoped wrapper
- Pass `freeExploreChatApi` as 9th arg from `useOrvekHybridWorkbenchDataApi`
- Mount `OrvekPageHandlersProvider` explore handlers with `freeExploreSendHandlerAvailable: false` and disabled `onSend` until explicit enable slice
- `setExploreSessionBridgeSessionId` on session change (prep for movement slice)

**Slice D — FreeExplore tab alignment** (`hasLiveExploreChat` pattern, reference transcript fallback)
