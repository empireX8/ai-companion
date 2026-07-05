# 04 Evidence Panel Provider Lookup

## Implemented

- Added `resolveOrvekObjectFromGraph()` and `resolveOrvekObjectsFromGraph()` in `lib/orvek-v0/data-provider.tsx`.
- Added `useOrvekObjectGraph()` hook — provider lookup first, static zip fallback second.
- Updated `components/orvek-v0/evidence-panel.tsx`:
  - `EvidencePanel` selected object lookup
  - `MovementView` recent movement + linked object lookup
  - `ObjectDetail` receipts / related / context lookup

## Preserved expectations

- Static/reference fallback preserved when provider lookup misses.
- Root Map production fetch bridge **not implemented**.
- Map presentation readiness gate unchanged; unsafe production Map still blocked from hybrid merge.
- Today hybrid unchanged.
- `createMockOrvekDataApi` remains baseline for unwired surfaces.
- WorkbenchProvider untouched.
- Old production shell remains quarantined.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/map-presentation-readiness.test.ts lib/__tests__/map-production-api.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts` — PASS

## Status

- EvidencePanel provider lookup added.
- Infrastructure only — no visible Map data bridge.
- **Not production-ready yet.**

## Product-owner visual check

**Not required for this slice** — no visible layout or Map data path changed. Root Map remains reference/mock. Optional smoke: Today Evidence Pointer still opens Inspector for reference ids (`r6`, `d1`).

## Next slice

Bounded root Map fetch bridge using `buildMapProductionDataApi` + `isMapPresentationReady()` + normalized hybrid merge, then PO visual check on root Map.
