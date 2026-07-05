# 01 Experiment / Fieldwork Bridge Presentation Readiness Gate

## Slice summary

Safety infrastructure for a future root Explore Fieldwork Bridge production parity bridge. Normalization and readiness gating only — no root fetch, no hybrid merge wiring.

## What was added

### `lib/orvek-v0/production/experiment-presentation.ts`

- Title/summary/reason normalization with length caps and raw-text rejection
- Fieldwork status → reference tag mapping (`Ready to try`, `Active in the field`)
- Optional-field honesty: purpose, expectedSignal, hypotheses, supporting/conflicting only when meaningful
- Linked object alias builder for inspector-selectable targets
- `isExperimentPresentationReady()` stream gate
- `shouldMergeExperimentProductionApi()` gate (normalizes before checking)
- `normalizeExperimentProductionDataApi()` strips `displayContract` and quarantined `explore` view props
- Duplicate fieldwork row dedupe
- `resolveExperimentOpenSelectionId()` for future inspector companion
- `watchForItemToFieldworkObject()` projection helper

### `lib/orvek-v0/production/experiment-api.ts`

- `buildExperimentProductionDataApi()` maps `WatchForItem[]` → fieldwork `OrvekObject` graph + `exploreFieldworkIds`
- Registers linked object aliases when selectable
- Does **not** set `exploreInvestigationIds` or `exploreQuestionIds`

### `lib/orvek-v0/data-provider.tsx`

- Added optional `exploreFieldworkIds`, `exploreFieldworkSelectedId`, `experimentIsLoading`

### `lib/__tests__/experiment-presentation-readiness.test.ts`

Covers normalization, readiness pass/fail, displayContract leak, claim aliases, dedupe, hybrid reference fallback, parity preservation, no root fetch wiring, shell quarantine.

## Explicit non-goals (this slice)

- Root Explore fetch **not implemented**
- Production Fieldwork **not visible** in root workbench yet
- No `mergeExperimentOverlay()` in `hybrid-workbench-api.ts`
- Investigations tab **untouched**
- Active Questions tab **untouched**
- Free Explore chat **untouched**
- No changes to Today, Map, Timeline, or Decisions bridges
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Explore Fieldwork Bridge | Still reference hardcoded + zip `f2` fallback |
| Investigations / Active Questions | Still reference `inv-*` / `aq-*` lists |

## Production readiness

**Not production-ready yet.** Gate and normalization exist; hybrid merge + bounded fetch are required before root Fieldwork Bridge can show live data.

## Product-owner visual check

**Not required for this slice** (no user-visible runtime change).

**Required at implementation** when hybrid merge + bounded fetch land (Slice B/C).

## Recommended next slice

**Slice B — hybrid overlay merge only (no hook fetch)**

- Add `mergeExperimentOverlay()` to `hybrid-workbench-api.ts`
- Wire sixth argument or named overlay slot behind `shouldMergeExperimentProductionApi()`
- Tests: hybrid merge preserves reference Fieldwork Bridge when gate fails; Today/Map/Timeline/Decisions untouched

Then **Slice C — bounded `GET /api/watch-for` fetch in `useOrvekHybridWorkbenchDataApi`**.

Then **Slice D — minimal `FieldworkBridge` alignment** to consume merged fieldwork object when gate passes.
