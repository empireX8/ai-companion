# 02 Investigations Hybrid Overlay Merge

## Slice summary

Investigations production overlay merge in `buildHybridWorkbenchDataApi()` as the **8th argument** after Active Questions. Readiness gate controls merge. No hook fetch, no tab changes.

## What was added

### `lib/orvek-v0/production/hybrid-workbench-api.ts`

- `mergeInvestigationsOverlay()` — merges `exploreInvestigationIds`, `exploreInvestigationSelectedId`, `investigationsIsLoading`, `getObject`/`getObjects`, investigation empty copy
- **8th argument:** `investigationsApi?: OrvekDataApi`
- Gated by `shouldMergeInvestigationsProductionApi()` + `normalizeInvestigationsProductionDataApi()`
- Does not set global `displayContract`; does not touch fieldwork, active questions, or chat overlays

### `lib/__tests__/hybrid-workbench-api.test.ts`

10 new cases: ready merge, unsafe/thin fallback, Active Questions status rejection, displayContract strip, dedupe, linked aliases, mistaken arg slot, parity preservation, no hook wiring, tab unchanged.

## Explicit non-goals (this slice)

- Root hook fetch **not implemented**
- Investigations tab **unchanged** (reference `inv-*` + `isProductionDisplay`)
- Active Questions, Fieldwork Bridge, Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**
- Raw `/api/investigations` **not used**

## Overlap policy preserved

- Investigations overlay only merges rows that pass `shouldMergeInvestigationsProductionApi()` (complementary statuses + enriched thread detail)
- Active Questions-owned statuses excluded at builder + gate layers
- Active Questions overlay remains independent 7th argument

## Parity preserved

| Surface | Status |
|---------|--------|
| Active Questions | Unchanged |
| Fieldwork Bridge | Unchanged |
| Explore chat | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |

## Production readiness

**Not production-ready yet.** Overlay merge exists in hybrid builder but root hook does not fetch/pass `investigationsApi`; tab does not consume `exploreInvestigationIds`.

## Product-owner visual check

**Not required for this slice** — no UI or provider wiring at root.

**Required** when hook fetch + tab alignment land.

## Recommended next slice

**Slice D — bounded Investigations fetch in root hybrid hook**

- `fetchExploreInvestigationItems()` in `useOrvekHybridWorkbenchDataApi`
- Build `investigationsApi` via `buildInvestigationsProductionDataApi(items)` with `investigationsIsLoading`
- Pass as 8th arg to `buildHybridWorkbenchDataApi`
- Still no tab changes until Slice E
