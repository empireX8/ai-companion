# 02 Frozen Reference Route

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`

## Outcome

The authoritative frozen reference route is now:

- Route: `/dev/orvek-v0-reference`
- Entry file: `app/dev/orvek-v0-reference/page.tsx`
- Runtime root: `components/orvek-v0-reference-frozen/workbench.tsx`

This route no longer rides the mutable production presentation tree.

## Frozen Package

Created a dedicated frozen reference package so the route stays stable even if production Inspector code changes:

- `components/orvek-v0-reference-frozen/reference-data.ts`
- `components/orvek-v0-reference-frozen/reference-data-api.ts`
- `components/orvek-v0-reference-frozen/workbench.tsx`
- `components/orvek-v0-reference-frozen/pages/today.tsx`
- `components/orvek-v0-reference-frozen/pages/map.tsx`
- `components/orvek-v0-reference-frozen/pages/timeline.tsx`
- `components/orvek-v0-reference-frozen/pages/decisions.tsx`
- `components/orvek-v0-reference-frozen/pages/explore.tsx`

Provenance:

- `.reference/v0-orvek-workbench/**`
- same-snapshot companion Inspector/workbench files from commit `6ad723216088987953cac776c8119693ea3bc982` where `.reference/` was incomplete

## Quarantine Guarantees

The frozen route now avoids the production swap chain called out in campaign intake.

It does not import:

- `OrvekWorkbenchShell`
- `useOrvekHybridWorkbenchDataApi`
- `useOrvekExploreChat`
- production fetch hooks
- production Inspector components

It uses:

- static reference data
- a reference-only data adapter
- the restored shared Inspector presentation

It does not receive authenticated production data.

## Proof

Static/runtime isolation was verified by:

- `lib/__tests__/desktop-frozen-reference-authority.test.ts`
- updated route-shell quarantine and inversion tests
- Playwright capture run:
  - `scripts/desktop-frozen-reference-inspector-restoration.playwright.ts`
  - result: `3/3` passing on `2026-07-17`

Browser evidence written to:

- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/01-empty-inspector-reference.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/02-evidence-populated-reference.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/03-evidence-mid-scroll-reference.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/04-movement-populated-reference.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/05-movement-mid-scroll-reference.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/06-linked-back-navigation-reference.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/07-report-overlay-reference.png`

## Authority Result

The route named `/dev/orvek-v0-reference` now serves the frozen reference authority for this campaign. The previous mutable mock route behavior has been quarantined behind a separate frozen package rather than left tied to production Inspector changes.
