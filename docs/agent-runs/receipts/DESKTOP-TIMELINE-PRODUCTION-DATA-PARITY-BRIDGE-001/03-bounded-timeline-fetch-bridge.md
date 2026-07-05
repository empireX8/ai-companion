# 03 Bounded Root Timeline Fetch Bridge

## Implemented

- Extended `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` to fetch Timeline production inputs:
  - `buildTimelineRequestUrl` activity stream
  - `fetchTimelineSemanticEntries`
  - `buildTimelineModelLayersRequestUrl` model layers
- Builds raw `buildTimelineProductionDataApi()` and passes as fourth argument to `buildHybridWorkbenchDataApi()`.
- Readiness-gated merge handled by existing hybrid Timeline overlay (`shouldMergeTimelineProductionApi()` + `normalizeTimelineProductionDataApi()`).
- Fetch failure, loading, or readiness failure → reference/mock Timeline baseline preserved.
- No global `displayContract` on hybrid API.
- Updated `components/orvek-v0/pages/timeline.tsx`:
  - row open prefers `inspectorObjectId` when resolvable in provider graph
  - movement tab for model-update rows
- Updated `lib/orvek-v0/production/timeline-api.ts` to register inspector object id aliases.
- Added `resolveTimelineOpenSelectionId()` helper in `timeline-presentation.ts`.

## Preserved expectations

- Today hybrid unchanged.
- Map hybrid unchanged.
- Non-Timeline surfaces unchanged.
- `createMockOrvekDataApi` remains baseline for unwired surfaces and fallback.
- Root still uses `TimelinePage` — not `V0TimelineView` or `TimelineSurface`.
- Old production shell remains quarantined.
- No `/timeline` route navigation from root interactions.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/timeline-presentation-readiness.test.ts lib/__tests__/timeline-hybrid-fetch.test.ts lib/__tests__/map-presentation-readiness.test.ts lib/__tests__/map-production-api.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts` — PASS

## Status

- Bounded root Timeline fetch bridge implemented.
- Production Timeline only displays when readiness gate passes.
- Unsafe/failing production Timeline falls back to reference/mock.
- **Not production-ready yet.**

## Product-owner visual check

**Required before commit.**

Checklist:

- Root Timeline keeps reference layout (220px filter rail + stream).
- With live data passing readiness: grouped stream populates with normalized copy; no raw journal overflow.
- With failing/empty/unsafe data: clean reference/mock Timeline (`t1`…`t14`) — no flash of bad production rows.
- Model movement row click opens Inspector with movement tab (not “Nothing selected”).
- No navigation to `/timeline` from root row clicks.
- Today + Map unchanged.
- No old production shell chrome.

## Known risks

- Readiness gate requires every surfaced row to pass presentation checks; sparse or partially invalid streams fall back to reference Timeline even when some real data exists.
- Production stream may be empty for new users — reference mock remains visible (intended).
- Inspector detail for non-model rows may remain thin until inspector-target fetch slice lands.
- Brief loading window shows reference Timeline until fetches complete and readiness passes.

## Next slice

Product-owner visual verification on root Timeline; commit if clean.
