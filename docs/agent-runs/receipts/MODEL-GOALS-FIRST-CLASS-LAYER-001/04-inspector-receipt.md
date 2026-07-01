# Inspector Receipt

Changed files
- `components/inspector/InspectorSelectButton.tsx`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/orvek-v0/evidence-panel.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
- `lib/inspector-selection.ts`
- `lib/__tests__/inspector-selection.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`
- `lib/__tests__/orvek-ux-integration.test.ts`

Inspector behavior
- `model-goal` objects now resolve to `model_goal` selector state.
- The production inspector bridge maps `model-goal` Orvek objects into the `model_goal` inspector type.
- The evidence panel renders a dedicated Model Goal branch instead of falling back to generic object copy.
- The panel shows the current read, evidence count, confidence, linked path state, and missing-evidence state.
- The panel says the read is correctable, not a final conclusion about the user.

Correction path
- The visible action is `Capture correction`.
- The button stores a handoff string in `mindlabs:today-capture-handoff`.
- The handoff string includes the current read, model read, confidence, evidence count, linked path, supporting evidence, and missing evidence.
- The button routes to the existing `/journal-chat` surface, but the product-facing copy frames it as Capture Life Data.
- The UI says user correction is first-class evidence and does not claim the model has already changed.

Selectable contract
- `model_goal` is included in the published-safe selector allowlist.
- The selector button type union accepts `model_goal`.
- `showCorrections` includes `model-goal` so correction affordances remain visible in the evidence surface.
