# 02 Experiment / Fieldwork Bridge Hybrid Overlay Merge

## Slice summary

Hybrid overlay merge only for Experiment / Fieldwork Bridge production data. Readiness gate controls merge; no root fetch, no ExplorePage changes.

## What was added

### `lib/orvek-v0/production/hybrid-workbench-api.ts`

- `mergeExperimentOverlay()` merges Fieldwork Bridge fields only when `shouldMergeExperimentProductionApi()` passes:
  - `exploreFieldworkIds`
  - `exploreFieldworkSelectedId`
  - `experimentIsLoading`
  - `getObject` / `getObjects` aliases for fieldwork and linked receipts
  - `emptyCopyBySlot.exploreFieldworkEmpty`
- `buildHybridWorkbenchDataApi()` extended with sixth argument `experimentApi?: OrvekDataApi`
- Uses `normalizeExperimentProductionDataApi()` before merge (strips `displayContract`, dedupes rows)
- Does **not** merge Investigations, Active Questions, Explore chat, or global `displayContract`

### `lib/__tests__/hybrid-workbench-api.test.ts`

Added coverage for:

- Ready Experiment/Fieldwork production overlay merge
- Unsafe overlay fallback to reference/mock
- Thin watch-for row fallback
- No `displayContract` leak into root hybrid
- Duplicate fieldwork row dedupe during merge
- Linked object / inspector target alias survival
- Wrong-slot (decisionsApi) no merge
- Investigations / Active Questions / Explore chat untouched
- Today, Map, Timeline, Decisions parity preserved with Experiment overlay
- Root hook still does not fetch watch-for/fieldwork

## Explicit non-goals (this slice)

- Root Explore fetch **not implemented**
- `useOrvekHybridWorkbenchDataApi` **unchanged** (no `experimentApi` wiring)
- `ExplorePage` **unchanged**
- Investigations tab **untouched**
- Active Questions tab **untouched**
- Free Explore chat **untouched**
- Today, Map, Timeline, Decisions bridges **unchanged**
- No `/watch-for`, `/active-questions`, or old production page navigation
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Explore Fieldwork Bridge | Merge path exists; not user-visible until hook fetch + page alignment |
| Investigations / Active Questions / chat | Still reference/mock |

## Production readiness

**Not production-ready yet.** Hybrid merge exists but root hook does not fetch watch-for data and ExplorePage does not consume merged fieldwork lists yet.

## Product-owner visual check

**Not required for this slice** (no user-visible runtime change until bounded fetch lands).

**Required at implementation** when Slice C (bounded fetch) + Slice D (FieldworkBridge page alignment) land.

## Recommended next slice

**Slice C — bounded `GET /api/watch-for` fetch in `useOrvekHybridWorkbenchDataApi`**

- Fetch watch-for items in root hybrid hook
- Pass `buildExperimentProductionDataApi(items)` as sixth argument to `buildHybridWorkbenchDataApi()`
- Keep Investigations / Active Questions / chat on reference/mock

Then **Slice D — minimal FieldworkBridge alignment** to consume merged `exploreFieldworkIds` when gate passes.
