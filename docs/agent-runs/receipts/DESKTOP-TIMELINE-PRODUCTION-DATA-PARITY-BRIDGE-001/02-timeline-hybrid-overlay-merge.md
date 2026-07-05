# 02 Timeline Hybrid Overlay Merge

## Implemented

- Extended `lib/orvek-v0/production/hybrid-workbench-api.ts`:
  - added `mergeTimelineOverlay()` for `timelineGroups`, `timelineFilters`, `timelineIsLoading`, `getObject`/`getObjects`, and timeline empty copy
  - `buildHybridWorkbenchDataApi()` accepts optional fourth `timelineApi` argument
  - merge runs only when `shouldMergeTimelineProductionApi()` passes
  - normalized overlay applied via `normalizeTimelineProductionDataApi()` on merge
  - no global `displayContract` set on hybrid API

## Preserved expectations

- Root Timeline fetch **not implemented** (`useOrvekHybridWorkbenchDataApi` unchanged).
- Production Timeline **not visible** in root workbench (hook does not pass `timelineApi` yet).
- `TimelinePage` unchanged.
- Today hybrid merge unchanged.
- Map hybrid merge unchanged.
- `createMockOrvekDataApi` remains baseline for unwired surfaces.
- Old production shell remains quarantined.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/timeline-presentation-readiness.test.ts lib/__tests__/map-presentation-readiness.test.ts lib/__tests__/map-production-api.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts` — PASS

## Status

- Hybrid Timeline overlay merge added.
- Readiness gate controls merge.
- Unsafe Timeline production data falls back to reference/mock Timeline.
- **Not production-ready yet.**

## Product-owner visual check

**Not required for this slice** — root Timeline runtime unchanged; hook does not fetch or pass Timeline overlay yet.

## Next slice

1. Bounded Timeline fetch in `useOrvekHybridWorkbenchDataApi` (mirror `OrvekTimelinePage` fetches).
2. `TimelinePage.openEvent` inspector-target resolution (`inspectorObjectId` when present).
3. Product-owner visual check on root Timeline before commit.
