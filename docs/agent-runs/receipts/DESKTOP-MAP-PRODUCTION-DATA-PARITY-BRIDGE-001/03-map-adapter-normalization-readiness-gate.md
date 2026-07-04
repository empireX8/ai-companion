# 03 Map Adapter Normalization + Readiness Gate

## Implemented

### Adapter normalization

Added `lib/orvek-v0/production/map-presentation.ts`:

- Text normalization: title/summary caps, whitespace collapse, bullet cleanup
- Duplicate `recommendation` removed when identical to `summary`
- `Linked path:` noise stripped from supporting bullets
- Invalid movement suppressed via `resolveMapMovementPair()` (identical before/after, placeholder before copy)
- `normalizeMapProductionDataApi()` applies normalization at display boundary
- `buildNormalizedMapProductionDataApi()` wraps raw builder + normalization for `/your-map` route

Updated:

- `lib/orvek-adapters/map.ts` — `mapDetailSlot()` only sets before/after when superseded summaries are genuinely different
- `lib/orvek-v0/production/map-api.ts` — raw production object builder; removed placeholder rail `before`; removed duplicate `recommendation` on detail objects

### Presentation readiness gate

Added in `map-presentation.ts`:

- `isMapObjectPresentationReady()`
- `hasValidMapCategoryStructure()` — enforces reference ontology rail order/labels
- `isMapPresentationReady()`
- `shouldMergeMapProductionApi()` — used by hybrid merge path

Gate rejects production Map when:

- loading / error / no content
- category structure invalid
- raw text too long or error-like (>320 chars pre-normalization)
- detail-like conclusions lack supporting evidence when `evidenceCount > 0`
- disputed detail lacks conflicting copy
- before/after invalid or identical
- any primary rail object fails readiness

### Hybrid fallback wiring (no full bridge)

- `buildHybridWorkbenchDataApi()` accepts optional `mapApi` but merges **only** when `shouldMergeMapProductionApi(mapApi)` passes
- On failure, returns reference/mock baseline unchanged
- Normalized map objects merged only after gate passes
- Root workbench still has **no Map fetch hook** — full bridge not implemented

### Deferred / unchanged

- EvidencePanel provider lookup — **not implemented**
- Full Map production fetch bridge in root workbench — **not implemented**
- Today hybrid — unchanged
- WorkbenchProvider — untouched
- Reference Map layout/components — unchanged

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts lib/__tests__/map-production-api.test.ts lib/__tests__/map-presentation-readiness.test.ts` — PASS

## Status

- Normalization added.
- Readiness gate added.
- Unsafe Map production data falls back to reference/mock via hybrid gate.
- Full Map bridge not implemented yet.
- EvidencePanel provider lookup deferred.
- Today parity preserved.
- **Not production-ready yet.**

## Visual check

**Not required for this slice** — root Map runtime path unchanged (still reference/mock baseline). Visual check required before any future slice that wires Map fetch into root workbench.

## Next slice recommendation

1. **EvidencePanel provider lookup** (Part 2 from prior plan) — only after normalized fixtures pass gate in tests
2. **Bounded Map fetch bridge** in `useOrvekHybridWorkbenchDataApi` using `buildMapProductionDataApi` + gate + `buildNormalizedMapProductionDataApi` on merge
3. Product-owner visual check on root Map after bridge slice

Optional parallel: extend public Map detail API to surface true superseded prior read for valid before/after movement.
