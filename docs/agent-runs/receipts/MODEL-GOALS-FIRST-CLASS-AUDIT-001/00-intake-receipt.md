# Intake Receipt

Phase: `MODEL-GOALS-FIRST-CLASS-AUDIT-001`

Scope
- Audit only.
- No source edits.
- No schema, route, middleware, generation, or styling changes.
- No implementation of Model Goals.

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
- prior gap audit receipts under `docs/agent-runs/receipts/V0-REFERENCE-PARITY-GOALS-CONTEXT-AUDIT-001/`

Verification plan
- `git diff --check`
- `git status --short`
- `git diff --stat`
- `grep -RIn "Model Goal\|model goal\|goal" app components lib docs/agent-runs/receipts/V0-REFERENCE-PARITY-GOALS-CONTEXT-AUDIT-001 --exclude-dir=node_modules`

