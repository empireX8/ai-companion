# 05 Bounded Root Map Fetch Bridge

## Implemented

- Extended `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` to fetch Map production inputs:
  - `fetchYourMapConclusions`
  - mind context, movement preview, open questions previews
  - inspector detail + evidence for the resolved initial selection
- Builds raw `buildMapProductionDataApi()` and merges through `buildHybridWorkbenchDataApi()` only when `shouldMergeMapProductionApi()` / `isMapPresentationReady()` passes.
- Normalization applied on merge via existing `normalizeMapProductionDataApi()` in hybrid builder.
- Fetch failure, empty list, loading state, or readiness failure → reference/mock Map baseline preserved.
- No `displayContract: production` on hybrid API — Map keeps reference header branch.
- No `/your-map` navigation wired from root Map interactions.
- `WorkbenchProvider` untouched.
- `createMockOrvekDataApi` remains baseline for unwired surfaces and fallback.

## Preserved expectations

- EvidencePanel provider lookup still resolves merged Map objects through `useOrvekObjectGraph`.
- Today hybrid merge unchanged.
- Non-Map surfaces unchanged.
- Old production shell remains quarantined.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/map-presentation-readiness.test.ts lib/__tests__/map-production-api.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts` — PASS

## Status

- Bounded root Map fetch bridge implemented.
- Production Map data only displays when readiness gate passes.
- Unsafe/failing production Map data falls back to reference/mock Map.
- **Not production-ready yet.**

## Product-owner visual check

**Required before commit.**

Checklist:

- Root Map keeps reference master-detail layout and header (not old production shell).
- With live data passing readiness: rails populate; detail pane shows normalized copy.
- With failing/empty/unsafe data: clean reference/mock Map appears (no flash of raw production text).
- Map selection opens Inspector with provider-backed object (not “Nothing selected”).
- No unexpected navigation to `/your-map` from root Map clicks.
- Today unchanged: Delta Log, Evidence Pointer, Continue from what changed.
- Decisions / Timeline / Explore still reference/mock.

## Known risks

- Readiness gate requires every surfaced rail object to pass presentation checks; multi-conclusion maps where only the initial selection has inspector detail may fail the gate and fall back to reference Map even when list data exists.
- Root Map selection changes after load do not re-fetch inspector detail (hook runs outside `WorkbenchProvider`); non-initial selections use list-level projection until a follow-up slice wires selection-aware detail fetch.
- Brief loading window shows reference Map until ancillary fetches complete and readiness passes.

## Next slice

Product-owner visual verification on root Map; then commit if clean.
