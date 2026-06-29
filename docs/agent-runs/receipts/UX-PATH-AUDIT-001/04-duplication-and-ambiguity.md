# Duplication And Ambiguity

## Shell Duplication

- The app carries two navigation systems with the same core destinations:
  - `components/layout/GlobalRail.tsx` plus `components/layout/WorkbenchTopBar.tsx`
  - `components/orvek-workbench/OrvekSidebar.tsx` plus `components/orvek-workbench/OrvekTopBar.tsx`
- This is not broken in the strict sense, but it does split the same intent across two chrome systems and makes the surface feel less canonical than it should.

## Settings Alias

- `/account` and `/settings` resolve to the same settings surface.
- The live navigation points to `/account`, while the page implementation lives in `app/(root)/(routes)/settings/page.tsx`.
- This is harmless for routing, but it is still two URLs for one intent.

## Inspector Boundary Duplication

- `SelectedObjectEvidencePanel` still repeats movement-adjacent guidance for selected `model_update` objects.
- `ModelMovementInspectorPanel` already owns the epistemic report, so the same "what would change this" language appearing in Evidence / Context creates a boundary overlap.
- This is the most important ambiguity in the inspector.

## What Changed Ambiguity

- `What Changed` is deliberately inspector-first rather than detail-route-first.
- That is fine as a product choice, but it means the surface has a list-card entry path and an inspector entry path, while no `/what-changed/[id]` page exists.
- This should be documented clearly if the product keeps that shape.

