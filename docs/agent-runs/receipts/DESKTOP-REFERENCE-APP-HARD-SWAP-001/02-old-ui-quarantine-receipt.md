# DESKTOP-REFERENCE-APP-HARD-SWAP-001

## Result
Hard swap baseline preserved. Old production shell pieces were quarantined in tests and receipts, not reactivated.

## Active render path
app/(root)/layout.tsx
-> components/layout/AppShell.tsx
-> components/orvek-workbench/OrvekWorkbenchShell.tsx
-> components/orvek-v0/workbench.tsx
-> OrvekShellLayout
-> reference TopBar + Sidebar + EvidencePanel + Overlays

## Old shell active status
- RouteTopBar: not active in the production shell
- RouteSidebar: not active in the production shell
- OrvekEvidencePanel: not active as the visible right rail
- ProductionInspectorAside: not active as the visible right rail
- OrvekTopBar: not active in the production shell
- OrvekSidebar: not active in the production shell

## Quarantine map
### Old visual shell component
- `components/orvek-v0/production/RouteTopBar.tsx`
- `components/orvek-v0/production/RouteSidebar.tsx`
- `components/orvek-workbench/OrvekEvidencePanel.tsx`
- `components/orvek-workbench/OrvekTopBar.tsx`
- `components/orvek-workbench/OrvekSidebar.tsx`

### Old route body
- `components/orvek-workbench/OrvekTodayPage.tsx`
- `components/orvek-workbench/OrvekMapPage.tsx`
- `components/orvek-workbench/OrvekExplorePage.tsx`
- `components/orvek-workbench/OrvekDecisionsPage.tsx`
- `components/orvek-workbench/OrvekTimelinePage.tsx`
- `components/orvek-workbench/OrvekWhatChangedPage.tsx`

### Useful data/action logic
- `components/orvek-v0/production/OrvekV0PageShell.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
- `lib/orvek-v0/production/*.ts`
- `lib/today-reentry.ts`

### Test-only
- `lib/__tests__/shell-quarantine.test.ts`
- `lib/__tests__/shell-legacy-route-cleanup.test.ts`
- `lib/__tests__/orvek-v0-inversion.test.ts`
- `lib/__tests__/your-map-workbench.test.ts`

## Retention policy
Old UI files are retained as backup/adapters until the remaining data bridge work is complete.
Deletion is deferred until grep and tests prove the files are unused by the active render path.
The failed Today wiring stash was not reused.

## Next step
Design the data bridge intentionally.
Do not do random surface wiring before the active shell/data boundary is explicitly mapped.
