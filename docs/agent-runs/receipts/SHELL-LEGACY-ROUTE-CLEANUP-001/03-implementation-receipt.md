# Implementation Receipt - Shell Legacy Route Cleanup

**Branch:** `shell-legacy-route-cleanup-001`

## Summary

This slice removes the highest-risk shell route leakage from visible v0 interactions and makes previously misleading actions honest about their availability.

## Files changed

- `components/orvek-v0/production/RouteTopBar.tsx`
- `components/command/CommandPalette.tsx`
- `app/(root)/(routes)/journal-chat/page.tsx`
- `app/(root)/(routes)/watch-for/page.tsx`
- `components/orvek-v0/pages/decisions.tsx`
- `components/your-map/YourMapMindContextPanel.tsx`
- `components/your-map/YourMapPreviewBands.tsx`
- `components/your-map/YourMapWorkbench.tsx`
- `lib/__tests__/shell-legacy-route-cleanup.test.ts`
- `lib/__tests__/command-palette-ia.test.ts`
- `lib/__tests__/phase3-watch-for-page.test.ts`
- `lib/__tests__/your-map-preview-surface.test.ts`
- `docs/agent-runs/receipts/V0-UX-FLOW-001/02-button-output-matrix.md`
- `docs/agent-runs/receipts/V0-UX-FLOW-001/03-data-flow-findings.md`
- `docs/agent-runs/receipts/V0-UX-FLOW-001/05-repair-queue.md`
- `docs/agent-runs/receipts/V0-UX-FLOW-001/06-closeout-receipt.md`
- `docs/agent-runs/receipts/SHELL-LEGACY-ROUTE-CLEANUP-001/00-intake-receipt.md`
- `docs/agent-runs/receipts/SHELL-LEGACY-ROUTE-CLEANUP-001/01-current-state-check.md`
- `docs/agent-runs/receipts/SHELL-LEGACY-ROUTE-CLEANUP-001/02-route-target-decisions.md`
- `docs/agent-runs/receipts/SHELL-LEGACY-ROUTE-CLEANUP-001/03-implementation-receipt.md`
- `docs/agent-runs/receipts/SHELL-LEGACY-ROUTE-CLEANUP-001/04-verification-receipt.md`
- `docs/agent-runs/receipts/SHELL-LEGACY-ROUTE-CLEANUP-001/06-closeout-receipt.md`

## Implementation notes

- The top bar `Import` action now renders as an honest disabled control instead of linking to `/import`.
- The command palette now filters out blocked legacy routes from visible commands.
- Journal Chat `Open patterns` is now honest about the missing v0 destination.
- Your Map legacy context, memory, and active-question links no longer present blocked routes as active destinations.
- Your Map open-questions preview rows and `View all` no longer expose the blocked `/active-questions` route.
- Watch For `Active Questions` is now honest instead of linkable.
- Decisions `Add outcome` is disabled in production so it no longer looks active while returning early.
- Targeted tests were added or updated to cover the repaired boundaries.
