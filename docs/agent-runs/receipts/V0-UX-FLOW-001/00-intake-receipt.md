# V0-UX-FLOW-001 Intake Receipt

Branch: `v0-ux-flow-001-button-output-audit`

Scope:
- Audit the visible v0 surfaces only: `/`, `/journal-chat`, `/what-changed`, `/explore`, `/your-map`, `/timeline`, `/watch-for`, `/actions`.
- Inspect button-to-route, button-to-panel, and button-to-data-output paths.
- Do not redesign, restyle, change schema, change generation logic, or change middleware.
- Do not add product features.
- Do not fix routes in this slice.

Method:
- Static code inspection first.
- Use the existing route smoke spec and repo tests as verification.
- Group repeated controls into path families so the matrix stays binary and path-based.

Primary evidence sources inspected:
- `components/orvek-v0/production/RouteTopBar.tsx`
- `components/orvek-v0/production/RouteSidebar.tsx`
- `app/(root)/(routes)/chat/_components/SurfaceChatShell.tsx`
- `components/orvek-v0/pages/today.tsx`
- `components/orvek-v0/pages/what-changed.tsx`
- `components/orvek-v0/pages/explore.tsx`
- `components/orvek-v0/pages/map.tsx`
- `components/orvek-v0/pages/timeline.tsx`
- `components/orvek-v0/pages/decisions.tsx`
- `components/watch-for/WatchForItemCard.tsx`
- `components/watch-for/WatchForInspectorAction.tsx`
- `components/your-map/YourMapDetailPane.tsx`
- `components/your-map/YourMapPreviewBands.tsx`
- `components/your-map/YourMapMindContextPanel.tsx`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/inspector/panels/ModelMovementInspectorPanel.tsx`
- `scripts/v0-route-smoke.playwright.ts`
- `lib/__tests__/today-workbench-routes.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`
- `lib/__tests__/inspector-evidence-presentation.test.ts`
- `lib/__tests__/what-changed-reality-report.test.ts`

Grouping rule:
- One row can cover a repeated family of buttons when every control in the family shares the same output path or target class.
