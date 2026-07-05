# 01 Decisions Presentation Readiness Gate

## Slice summary

Safety infrastructure for a future root Decisions production parity bridge. Normalization and readiness gating only — no root fetch, no hybrid merge wiring.

## What was added

### `lib/orvek-v0/production/decisions-presentation.ts`

- Title/summary/recommendation normalization with length caps and raw-text rejection
- Duplicate summary/recommendation suppression
- Reference lifecycle group tags (`Active`, `Chosen`, `Outcome due`, `Reviewed`)
- Optional-field honesty: `options`, `decisionContext`, `projection`, outcome fields only when meaningful
- Linked claim alias object builder for safe receipt resolution
- `isDecisionsPresentationReady()` stream gate
- `shouldMergeDecisionsProductionApi()` gate (normalizes before checking)
- `normalizeDecisionsProductionDataApi()` strips `displayContract` and quarantined `decisions` view props
- Duplicate row dedupe across sidebar groups
- `resolveDecisionsOpenSelectionId()` for future inspector companion

### `lib/orvek-v0/production/decisions-api.ts` (minimal builder alignment)

- Lifecycle tags from reference group mapping (not raw status labels)
- Outcome window / actual outcome projection from action status + note
- Linked claim alias registration when `linkedClaimId` + `linkedClaimSummary` present

### `lib/__tests__/decisions-presentation-readiness.test.ts`

Covers normalization, readiness pass/fail, displayContract leak, claim aliases, dedupe, hybrid reference fallback, Today/Map/Timeline parity preservation, no root fetch wiring, shell quarantine.

## Explicit non-goals (this slice)

- Root Decisions fetch **not implemented**
- Production Decisions **not visible** in root workbench yet
- No `mergeDecisionsOverlay()` in `hybrid-workbench-api.ts`
- No changes to Today, Map, or Timeline bridges
- No `/actions` routing, `V0DecisionsView`, or old production shell restoration
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions (root) | Still reference mock via empty `decisionListGroups` + `LISTS` fallback |

## Production readiness

**Not production-ready yet.** Gate and normalization exist; bounded fetch and hybrid merge are required before root Decisions can show live data.

## Product-owner visual check

**Not required for this slice** (no user-visible runtime change).

**Required at implementation** when hybrid merge + bounded fetch land (Slice B/C).

## Recommended next slice

**Slice B — hybrid overlay merge only (no hook fetch)**

- Add `mergeDecisionsOverlay()` to `hybrid-workbench-api.ts`
- Wire fifth argument or named overlay slot behind `shouldMergeDecisionsProductionApi()`
- Tests: hybrid merge preserves reference Decisions when gate fails; Today/Map/Timeline untouched

Then **Slice C — bounded `fetchActionsPageData()` in `useOrvekHybridWorkbenchDataApi`** (unified list, no bucket tabs at root).
