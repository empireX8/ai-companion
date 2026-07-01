# Reference Scope

## Reference Baseline Reviewed
- `lib/orvek-v0/orvek-data.ts`
- `lib/orvek-v0/reference-props.ts`
- `components/orvek-workbench/views/V0MapView.tsx`
- `components/orvek-workbench/views/V0ExploreView.tsx`
- `components/orvek-workbench/views/V0TodayView.tsx`
- `components/orvek-workbench/views/V0DecisionsView.tsx`
- `components/orvek-workbench/OrvekMapPage.tsx`
- `lib/orvek-v0/production/map-api.ts`
- `lib/mind-context-surface.ts`
- `app/(root)/(routes)/context/page.tsx`

## Reference Signals
- The reference data has explicit `Context Profile` objects and explicit goal objects.
- The reference Today view treats `Context Profile` as a first-class, correctable model layer.
- The reference Map view exposes rails for `Goals / directions`, `Background / Context`, `Active questions`, and `Model updates`.
- The reference Explore view exposes `Free Explore`, `Investigations`, `Active Questions`, and `Fieldwork Bridge`.
- The reference Today view uses `State`, `Delta log`, `Evidence pointer`, and `Re-entry trigger` language.

## Baseline Implication
- The reference workbench treats context, goals, questions, fieldwork, and model movement as distinct responsibilities.
- Production should surface those layers visibly and correctably if it is going to consume them.
