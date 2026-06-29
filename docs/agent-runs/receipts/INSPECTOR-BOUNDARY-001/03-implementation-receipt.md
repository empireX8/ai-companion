# Implementation Receipt

Changed files:
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `lib/__tests__/inspector-evidence-presentation.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`

What changed:
- `model_update` Evidence / Context now opens on affected-object framing instead of movement framing.
- The evidence tab header now uses `Related map item` and the affected object title.
- The movement-owned `Movement summary` block was removed from the evidence tab.
- The movement report's `What would change this` block was removed from the evidence tab.
- Affected-object resolution now prefers the affected object id, so the evidence panel does not pull the movement object into the context section.
- The empty state was rewritten to stay on related-object context and point to the Mind Model Movement tab for the epistemic report.

Test updates:
- Added a source-backed boundary test proving the model_update evidence tab does not contain movement-owned framing.
- Preserved the movement-tab test proving `What Would Change This Conclusion` still belongs to Mind Model Movement.

