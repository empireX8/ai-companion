# Intake Receipt

Branch: `inspector-boundary-001-repair-audit-gap`

Task:
Repair the highest-impact UX path audit gap from `UX-PATH-AUDIT-001`: the inspector boundary between Evidence / Context and Mind Model Movement.

Scope:
- No route changes
- No schema changes
- No generation contract changes
- No unrelated navigation, journal, or visual polish work

Primary target:
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`

Tests to update:
- `lib/__tests__/inspector-evidence-presentation.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`

