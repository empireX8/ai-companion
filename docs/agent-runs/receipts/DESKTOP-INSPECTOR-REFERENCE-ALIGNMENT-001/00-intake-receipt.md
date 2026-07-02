# Intake Receipt

Slice: `DESKTOP-INSPECTOR-REFERENCE-ALIGNMENT-001`

Branch: `desktop-inspector-reference-alignment-001`

Task:
- Align the production desktop Inspector UX with the accepted v0 reference direction.
- Preserve the Inspector trust/evidence repair from `DESKTOP-INSPECTOR-TRUST-REPAIR-001`.
- Keep the implementation targeted to Inspector and Inspector-adjacent presentation.

Source of truth consulted:
- `.reference/v0-orvek-workbench/components/orvek/evidence-panel.tsx`
- `.reference/v0-orvek-workbench/inspector.png`
- `.reference/v0-orvek-workbench/movement.png`
- `.reference/v0-orvek-workbench/s-inspector.png`
- `app/dev/orvek-v0-reference/page.tsx`
- `docs/agent-runs/receipts/V0-VISUAL-ACCEPTANCE-001/`
- `docs/agent-runs/receipts/DESKTOP-LIVE-UX-VALIDATION-001/`
- `docs/agent-runs/receipts/DESKTOP-INSPECTOR-TRUST-REPAIR-001/`

Allowed scope used:
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/inspector/panels/ModelMovementInspectorPanel.tsx`
- `lib/__tests__/inspector-evidence-presentation.test.ts`
- `docs/agent-runs/receipts/DESKTOP-INSPECTOR-REFERENCE-ALIGNMENT-001/`

Explicit non-goals preserved:
- No schema changes.
- No middleware changes.
- No auth changes.
- No route creation or navigation changes.
- No mobile repair.
- No Today, Decisions, Capture, Watch For, Map center-panel, Explore grounding, Timeline, voice, import, branding, profile, or settings work.

