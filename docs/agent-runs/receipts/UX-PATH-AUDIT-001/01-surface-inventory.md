# Surface Inventory

## Core Shell

- Global app shell: `components/layout/GlobalRail.tsx`, `components/layout/WorkbenchTopBar.tsx`, `components/layout/ContentTopBar.tsx`
- Workbench shell: `components/orvek-workbench/OrvekWorkbenchShell.tsx`, `components/orvek-workbench/OrvekTopBar.tsx`, `components/orvek-workbench/OrvekSidebar.tsx`, `components/orvek-workbench/OrvekEvidencePanel.tsx`
- Inspector shell: `components/inspector/WorkbenchInspector.tsx`, `components/inspector/MemoryInspectorDrawer.tsx`, `components/inspector/InspectorPanelRouter.tsx`

## Primary Workbench Surfaces

- Today: `components/orvek-v0/pages/today.tsx`
- Your Map: `components/orvek-v0/pages/map.tsx`
- Decisions: `components/orvek-v0/pages/decisions.tsx`
- Timeline: `components/orvek-v0/pages/timeline.tsx`
- Explore: `components/orvek-v0/pages/explore.tsx`
- What Changed: `components/orvek-v0/pages/what-changed.tsx`

## Supporting Surfaces

- Watch For: `app/(root)/(routes)/watch-for/page.tsx`, `app/(root)/(routes)/watch-for/[id]/page.tsx`
- Active Questions: `app/(root)/(routes)/active-questions/page.tsx`, `app/(root)/(routes)/active-questions/[id]/page.tsx`
- Patterns / Contradictions: `app/(root)/(routes)/patterns/page.tsx`, `app/(root)/(routes)/patterns/[id]/page.tsx`, `app/(root)/(routes)/contradictions/page.tsx`, `app/(root)/(routes)/contradictions/[id]/page.tsx`
- Library / History: `app/(root)/(routes)/library/page.tsx`, `app/(root)/(routes)/library/[id]/page.tsx`
- References / Memories: `app/(root)/(routes)/references/page.tsx`, `app/(root)/(routes)/references/[id]/page.tsx`
- Journal / Journal Chat: `app/(root)/(routes)/journal/page.tsx`, `app/(root)/(routes)/journal-chat/page.tsx`
- Check-ins: `app/(root)/(routes)/check-ins/page.tsx`
- Context / Help / Import / Account / Settings / Metrics / Audit: `app/(root)/(routes)/context/page.tsx`, `app/(root)/(routes)/help/page.tsx`, `app/(root)/(routes)/import/page.tsx`, `app/(root)/(routes)/account/page.tsx`, `app/(root)/(routes)/settings/page.tsx`, `app/(root)/(routes)/metrics/page.tsx`, `app/(root)/(routes)/audit/page.tsx`

## Aliases And Redirects

- `/account` re-exports `/settings`.
- `/chat` redirects to `/`.
- `/projections` redirects to `/patterns`.
- `/what-changed` is list-only in the UI tree; it has API detail routes, but no current page route at `/what-changed/[id]`.

