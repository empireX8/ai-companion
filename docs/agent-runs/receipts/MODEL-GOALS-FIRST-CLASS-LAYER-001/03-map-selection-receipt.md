# Map Selection Receipt

Changed files
- `components/orvek-v0/pages/map.tsx`
- `components/orvek-workbench/OrvekMapPage.tsx`
- `components/orvek-workbench/views/V0MapView.tsx`
- `lib/orvek-adapters/map.ts`
- `lib/orvek-v0/production/map-api.ts`
- `lib/orvek-v0/production/map-selection.ts`
- `lib/orvek-v0/orvek-types.ts`
- `lib/orvek-v0/mock-orvek-data.ts`
- `lib/orvek-v0/orvek-data.ts`
- `components/orvek-v0/primitives.tsx`
- `components/orvek-workbench/OrvekPrimitives.tsx`

Selection behavior
- Production map rail items now emit Model Goal rows as `goal-${id}`.
- `resolveMapWorkbenchSelectedId()` preserves preferred Mind Context and Goal selections before any empty-conclusion fallback.
- The production map API normalizes raw and rail ids so `goal-m-goal-1` and `m-goal-1` both resolve correctly.
- The map page keeps goal rail ids selectable and maintains existing conclusion selection.
- `V0MapView` treats `model_goal` items as active when the raw or rail id matches.

Projection behavior
- `buildMapProductionDataApi()` exposes both the rail id and raw alias for model goals.
- The rail object is a `model-goal` object with `inspectorObjectType: "model_goal"`.
- The object includes a safe linked path, evidence summary, confidence label, and missing-evidence state.
- Mock/reference data now seeds the same shape so the visible library copy does not fall back to generic goal language.

Tests added or updated
- `lib/__tests__/map-production-api.test.ts`
- `lib/__tests__/orvek-workbench-selection.test.ts`
- `lib/__tests__/your-map-workbench.test.ts`
