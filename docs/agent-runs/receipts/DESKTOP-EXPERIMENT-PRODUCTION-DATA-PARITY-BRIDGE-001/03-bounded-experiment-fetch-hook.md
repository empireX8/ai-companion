# 03 Bounded Experiment Watch-For Fetch Hook

## Slice summary

Bounded `GET /api/watch-for` fetch in the root hybrid hook. Builds `experimentApi` and passes it as the sixth argument to `buildHybridWorkbenchDataApi`. Readiness gate still controls merge. FieldworkBridge unchanged.

## What was added

### `lib/watch-for.ts`

- `fetchWatchForItems()` — bounded fetch against `WATCH_FOR_ENDPOINT` (`/api/watch-for`), returns `[]` on failure

### `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`

- `watchForItems` + `isLoadingWatchFor` state with mount effect calling `fetchWatchForItems()`
- `experimentApi` built via `buildExperimentProductionDataApi(watchForItems)` with `experimentIsLoading: isLoadingWatchFor`
- Passed as sixth argument: `buildHybridWorkbenchDataApi(baseApi, todayApi, mapApi, timelineApi, decisionsApi, experimentApi)`
- Merge still gated by `shouldMergeExperimentProductionApi()` inside hybrid builder

### `lib/__tests__/experiment-hybrid-fetch.test.ts`

Covers hook wiring, sixth-argument pass-through, ready merge, unsafe/thin/empty/loading fallback, linked aliases, Investigations/Questions/chat untouched, FieldworkBridge unchanged, shell quarantine.

### `lib/__tests__/hybrid-workbench-api.test.ts` / `experiment-presentation-readiness.test.ts`

Updated hook wiring assertions (fetch now wired).

## Explicit non-goals (this slice)

- `FieldworkBridge` **not changed** — still reference hardcoded + `f2` fallback; does not read `exploreFieldworkIds`
- Production Fieldwork **not user-visible** — hybrid API does not set global `displayContract`, so `isProductionDisplay()` remains false
- Investigations tab **untouched**
- Active Questions tab **untouched**
- Free Explore chat **untouched**
- Today, Map, Timeline, Decisions bridges **unchanged**
- No `/watch-for` page navigation from workbench
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Explore Fieldwork Bridge | Data fetched + gated merge in provider; UI still reference |
| Investigations / Active Questions / chat | Still reference/mock |

## Production readiness

**Not production-ready yet.** Watch-for data enters the hybrid provider behind the readiness gate, but FieldworkBridge does not consume merged fieldwork lists yet.

## Product-owner visual check

**Not required for this slice** — FieldworkBridge rendering unchanged; no visible production Fieldwork switch.

**Required at implementation** when Slice D (FieldworkBridge alignment) lands.

## Recommended next slice

**Slice D — minimal FieldworkBridge alignment**

- Consume `exploreFieldworkIds` / `exploreFieldworkSelectedId` when readiness gate passes
- Wire inspector selection via `resolveExperimentOpenSelectionId()`
- Keep Investigations, Active Questions, and chat on reference/mock
