# DESKTOP-REFERENCE-APP-HARD-SWAP-001

## Result
PASS for visual hard swap.

## Product-owner visual validation
The production `/` route now visibly renders the accepted reference workbench UI. Product owner confirmed: “Yes this looks much better now, I’d say it’s a pass.”

## Active production render path
app/(root)/layout.tsx
-> components/layout/AppShell.tsx
-> components/orvek-workbench/OrvekWorkbenchShell.tsx
-> components/orvek-v0/workbench.tsx
-> OrvekShellLayout
-> reference TopBar + Sidebar + EvidencePanel + Overlays

## Old shell no longer active
- RouteTopBar
- RouteSidebar
- OrvekEvidencePanel
- ProductionInspectorAside

## Important caveat
This is not production-ready yet.

Production route children are currently ignored by the active shell, and production data/action wiring is not driving the visible desktop shell.

Temporary reference mock data is active in the production path via createMockOrvekDataApi().

## Next required work
Keep the reference workbench as the visible app and replace mock/reference data with production adapters surface by surface:
1. Today
2. Map
3. Inspector / evidence
4. Decisions / actions
5. Explore
6. Timeline
7. Capture + Watch For

## Merge status
Do not merge this branch to staging while mock data is active in the production path.
