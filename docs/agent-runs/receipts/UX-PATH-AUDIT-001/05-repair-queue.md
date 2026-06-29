# Repair Queue

## Critical Path Wiring

- Fix `components/orvek-v0/pages/decisions.tsx:137-163` so `Add outcome` either performs a real action or is clearly disabled.
- Treat `app/(root)/(routes)/journal/_components/JournalSurface.tsx:331-338` as a peripheral BROKEN_DATA path unless it is shown to block receipt/data creation.
- Decide whether the Today / Explore production CTA set should be wired now or kept explicitly deferred.

## Core Spine Verdict

- `[Capture/input] JournalSurface/import -> receipt/data creation: WIRED`
  Evidence: `app/(root)/(routes)/journal/_components/JournalSurface.tsx`, `app/(root)/(routes)/import/page.tsx`
  Suggested repair slice: `capture-input`
- `[Receipt/data] Receipt/data -> object/model update: WIRED`
  Evidence: `components/orvek-v0/pages/today.tsx`, `components/orvek-v0/pages/what-changed.tsx`
  Suggested repair slice: `report-spine`
- `[Object/model update] Object/model update -> What Changed/report: WIRED`
  Evidence: `components/orvek-v0/pages/what-changed.tsx`, `components/orvek-v0/pages/today.tsx`
  Suggested repair slice: `report-spine`
- `[Report/model movement] Report/model movement -> Inspector: WIRED`
  Evidence: `components/orvek-v0/pages/what-changed.tsx`, `components/inspector/InspectorPanelRouter.tsx`
  Suggested repair slice: `movement-entry`
- `[Inspector] Inspector -> Evidence/Context: PARTIALLY_WIRED`
  Evidence: `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
  Suggested repair slice: `inspector-boundary`
- `[Inspector] Inspector -> Mind Model Movement: WIRED`
  Evidence: `components/inspector/WorkbenchInspector.tsx`, `components/inspector/MemoryInspectorDrawer.tsx`, `components/inspector/panels/ModelMovementInspectorPanel.tsx`
  Suggested repair slice: `movement-panel`
- `[Report/movement] Report/movement -> re-entry action: WIRED`
  Evidence: `components/inspector/panels/ModelMovementInspectorPanel.tsx`, `components/orvek-v0/pages/what-changed.tsx`
  Suggested repair slice: `re-entry-action`
- `[Related object links] Related object links -> correct detail/inspector target: WIRED`
  Evidence: `components/orvek-v0/pages/map.tsx`, `app/(root)/(routes)/watch-for/page.tsx`, `app/(root)/(routes)/patterns/page.tsx`
  Suggested repair slice: `related-links`

## Inspector / Detail Routing

- Remove movement-owned copy from the Evidence / Context tab for `model_update` selections.
- Keep `What would change this` on the Mind Model Movement side only.
- Decide whether the `/account` alias should remain or be normalized to one canonical settings path.

## Empty-State Honesty

- Preserve the explicit "not available yet" copy on Today and Explore until the underlying flows are real.
- Do not convert deferred controls into fake affordances just to make the page look fuller.

## Duplicate Navigation Cleanup

- Collapse or justify the mirrored shell chrome.
- Reduce the account/settings alias surface if one path is enough.
- Tighten the inspector tab boundary so the same guidance does not appear in both tabs.

## Data / API Mismatch

- Journal media upload is the clearest mismatch.
- Any overflow menus that stay visible should either open a menu or be removed.

## Later Visual Polish

- Audit / reference / contradiction overflow affordances after the path wiring is clean.
- Refine empty-state copy only after the action surfaces are trustworthy.

## Recommended Next Single Repair Slice

- `inspector-boundary`
