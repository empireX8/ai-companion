# 01 Timeline Presentation Readiness Gate

## Implemented

- Added `lib/orvek-v0/production/timeline-presentation.ts`:
  - title/summary/date normalization and raw-text rejection
  - reference event-type mapping for filter/lane compatibility
  - movement pair suppression (identical/near-identical/asymmetric before-after)
  - duplicate model-movement row detection and dedupe on normalize
  - reference filter injection (`REFERENCE_TIMELINE_FILTERS`)
  - `isTimelinePresentationReady()` / `shouldMergeTimelineProductionApi()`
  - `normalizeTimelineProductionDataApi()`
- Updated `lib/orvek-v0/production/timeline-api.ts`:
  - projects `date` / `lastUpdated` on timeline row objects
  - added `buildNormalizedTimelineProductionDataApi()` wrapper

## Preserved expectations

- Root Timeline fetch **not implemented**.
- Production Timeline **not visible** in root workbench (no hybrid merge wiring yet).
- Today hybrid unchanged.
- Map hybrid unchanged.
- `createMockOrvekDataApi` remains baseline for unwired surfaces.
- Old production shell remains quarantined.
- Root still uses `components/orvek-v0/pages/timeline.tsx` — not `V0TimelineView` or `TimelineSurface`.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/map-presentation-readiness.test.ts lib/__tests__/map-production-api.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts lib/__tests__/timeline-presentation-readiness.test.ts` — PASS

## Status

- Timeline normalization added.
- Readiness gate added.
- Infrastructure only — no root Timeline bridge.
- **Not production-ready yet.**

## Product-owner visual check

**Not required for this slice** — root Timeline runtime unchanged; no fetch or hybrid merge wired.

## Next slice

1. Extend `buildHybridWorkbenchDataApi()` with gated `mergeTimelineOverlay()` using `shouldMergeTimelineProductionApi()` + `normalizeTimelineProductionDataApi()`.
2. Bounded Timeline fetch in `useOrvekHybridWorkbenchDataApi` (mirror `OrvekTimelinePage` fetches).
3. `TimelinePage.openEvent` inspector-target resolution (`inspectorObjectId` when present).
4. Product-owner visual check on root Timeline before commit.
