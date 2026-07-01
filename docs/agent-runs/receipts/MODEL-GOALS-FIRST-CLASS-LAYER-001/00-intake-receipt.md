# Intake Receipt

Phase: `MODEL-GOALS-FIRST-CLASS-LAYER-001`

Scope
- Repair only the first-class Model Goals layer.
- No schema changes unless absolutely unavoidable.
- No route renames, middleware changes, generation-logic changes, or styling work.
- No broad reference-parity cleanup.
- No generic goals-app behavior.

Source of truth
- `docs/agent-runs/receipts/MODEL-GOALS-FIRST-CLASS-AUDIT-001/`

Review surfaces
- `app/(root)/(routes)/chat/_components/memory-panel.tsx`
- `app/(root)/(routes)/references/_components/ReferenceListPanel.tsx`
- `lib/orvek-v0/orvek-data.ts`
- `lib/orvek-v0/orvek-types.ts`
- `lib/orvek-v0/production/map-api.ts`
- `lib/orvek-v0/production/map-selection.ts`
- `components/orvek-workbench/OrvekMapPage.tsx`
- `components/orvek-v0/pages/map.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
- `components/inspector/InspectorSelectButton.tsx`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `lib/inspector-selection.ts`
- relevant tests under `lib/__tests__`

Verification plan
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run lib/__tests__/orvek-ux-integration.test.ts`
- `npx vitest run lib/__tests__/reference-detail.test.ts lib/__tests__/reference-actions.test.ts`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `npx vitest run`
