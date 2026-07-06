# 03 Free Explore Chat Tab Alignment

## Slice summary

Minimal FreeExplore tab alignment with **read-only** live transcript consumption from the hybrid provider. Gated `exploreMessages` / session state render when `hasLiveExploreChatFromProvider` passes; reference transcript fallback when chat state is unsafe, booting, auth-failed, loading, or gated out. Send handlers remain unmounted and Ask stays disabled.

## What changed

### `components/orvek-v0/pages/explore.tsx` — `FreeExplore()` only

- Replaced `isProductionDisplay` chat path with `hasLiveExploreChatFromProvider(data)`
- Consumes gated provider fields: `exploreMessages`, `freeExploreSendHandlerAvailable`, `emptyCopyBySlot.exploreChatEmpty`, `exploreView` boot/loading copy
- Live transcript: filters empty message rows (no raw stream chunks)
- Safe empty-live: intentional empty copy when session gate passes with zero messages
- Reference fallback: `REFERENCE_FREE_EXPLORE_MESSAGES` when live gate fails
- Grounding: reference `EXPLORE_GROUNDING` when live grounding not ready
- Live detection: honest `V0_EXPLORE_LIVE_DETECTION_COPY` when live; reference mock copy + ping animation when reference
- Movement note: neutral inspector copy when live; reference “4 places” copy when reference
- Composer draft: local-only; Ask/send gated on `freeExploreSendHandlerAvailable === true` (remains false)

### `lib/orvek-v0/production/free-explore-chat-presentation.ts`

- Added `hasLiveExploreChatFromProvider()` — tab-side live/read-only gate helper

### Tests

- **Added:** `lib/__tests__/free-explore-chat-tab-alignment.test.ts`
- **Updated:** `free-explore-chat-presentation-readiness.test.ts`, `free-explore-chat-hybrid-fetch.test.ts`, `hybrid-workbench-api.test.ts`

## Bridge policy

| Capability | Status |
|------------|--------|
| Live transcript read | **Enabled when gate passes** |
| Send / write handlers | **Not mounted / not enabled** |
| `freeExploreSendHandlerAvailable` | **Remains false** |
| Ask button | **Disabled** |
| Fake grounding/movement/review/live-detection as production | **Withheld or reference-safe** |
| Raw stream chunks | **Not displayed** |

## Parity preserved

| Surface | Status |
|---------|--------|
| Fieldwork Bridge | Unchanged |
| Active Questions | Unchanged |
| Investigations | Unchanged |
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Experiment / Fieldwork | Unchanged |

## Quarantine / mock policy

- Old `/explore` production shell **not** restored as root UI
- `createMockOrvekDataApi` remains in use for unwired surfaces
- No `displayContract` leak through hybrid chat merge

## Production readiness

**Not production-ready yet.** Live transcript is read-only; send is disabled; movement/grounding production slices remain deferred.

## Product-owner visual check

**Required before commit.**

Verify in Explore → Free Explore:
- Live session shows real messages when backend session is ready
- Empty live session shows intentional empty copy (not reference transcript)
- Boot/auth/failure states fall back to reference transcript
- Ask remains disabled
- Grounding chips still open Inspector
- Reference ping / “4 places” movement copy only in reference mode

## Recommended next slice

**Slice E — handler wiring + send enable**

- Mount `OrvekPageHandlersProvider` with bounded `onSend`
- Set `freeExploreSendHandlerAvailable: true` only when handler slice explicitly allows
- Enable Ask after visual check on read-only alignment
