# Prioritized Findings

## Finding 1
- Severity: BLOCKER
- Surface/file: `app/(root)/(routes)/context/page.tsx`, `lib/mind-context-surface.ts`, `components/orvek-workbench/OrvekMapPage.tsx`, `lib/orvek-v0/production/map-api.ts`
- Current behavior: Mind Context is derived from active references and patterns, then shown as a read-only Context page. The Map fetches derived context items, but the production open path only selects user-map conclusions.
- Expected Orvek behavior: Mind Context / Context Profile should be inspectable, correctable, and evidence-linked as a visible model layer.
- Evidence from code/reference: `lib/mind-context-surface.ts` fetches `/api/reference/list?status=active&limit=50` and `/api/patterns`; `app/(root)/(routes)/context/page.tsx` renders a read-only memories/patterns list; `components/orvek-workbench/OrvekMapPage.tsx` only opens a rail item when the resolved id matches a conclusion; `lib/orvek-v0/orvek-data.ts` and `lib/orvek-v0/reference-props.ts` show `Context Profile` as a first-class correctable layer in the reference.
- Why it matters: hidden profiling/context use without inspection or correction is a product-contract violation and can misstate the user model.
- Recommended repair slice: add a first-class Mind Context / Context Profile inspection and correction path that is evidence-linked and selectable from Map and Context.
- Explicit non-goals: do not change schema, middleware, routes, generation logic, or styling; do not invent model data.

## Finding 2
- Severity: HIGH
- Surface/file: `app/(root)/(routes)/chat/_components/memory-panel.tsx`, `app/(root)/(routes)/references/_components/ReferenceListPanel.tsx`, `lib/orvek-adapters/map.ts`, `lib/orvek-v0/orvek-data.ts`
- Current behavior: Goal exists only as a generic reference type, and the production Map goal rail is assembled from user-map conclusions rather than a dedicated model-goal layer.
- Expected Orvek behavior: explicit Model Goal objects should be inspectable, correctable, and evidence-linked across Today, Map, Decisions, and Actions.
- Evidence from code/reference: `memory-panel.tsx` includes `goal` in the reference type picker; `ReferenceListPanel.tsx` filters and edits `goal` as a generic memory; `lib/orvek-v0/orvek-data.ts` has dedicated `m-goal-1` through `m-goal-3` objects; `lib/orvek-adapters/map.ts` maps goal-like rails from conclusion areas rather than from a first-class goal object.
- Why it matters: decisions and actions can depend on goals that users cannot inspect or correct as goals.
- Recommended repair slice: introduce a visible Model Goal layer that reuses evidence and is wired into Today, Map, Decisions, and Actions lineage.
- Explicit non-goals: no schema changes in this audit, no new input forms, no UI restyling.

## Finding 3
- Severity: HIGH
- Surface/file: `components/orvek-workbench/OrvekMapPage.tsx`, `lib/orvek-v0/production/map-api.ts`, `components/orvek-workbench/views/V0MapView.tsx`
- Current behavior: the Map rail renders context, question, and model-update items, but the production open path only selects user-map conclusions that exist in the conclusions list.
- Expected Orvek behavior: every visible ontology rail item should open a meaningful, inspectable model object or evidence panel.
- Evidence from code/reference: `V0MapView.tsx` makes rail items clickable; `OrvekMapPage.tsx` resolves the clicked id and only calls `openItem` when the resolved id matches a conclusion; `map-api.ts` builds the rail objects and assigns context, question, and model-update ids.
- Why it matters: the visible Map suggests a durable model workspace, but some rails cannot actually be inspected from the production surface.
- Recommended repair slice: make context, question, and model-update rail entries route to their proper detail or evidence view instead of stopping at a conclusion-only selector.
- Explicit non-goals: do not alter route structure, storage, or styling; do not add speculative placeholder detail screens.

## Finding 4
- Severity: MEDIUM
- Surface/file: `app/(root)/(routes)/watch-for/page.tsx`
- Current behavior: the footer labels Active Questions as unavailable in v0, even though `/active-questions` exists and the reference workbench treats questions and fieldwork as first-class tabs.
- Expected Orvek behavior: the production entrypoint should point to the actual question flow rather than a dead-end unavailable label.
- Evidence from code/reference: `watch-for/page.tsx` shows the unavailable Active Questions footer; `app/(root)/(routes)/active-questions/page.tsx` and `[id]/page.tsx` exist; `components/orvek-workbench/views/V0ExploreView.tsx` exposes Active Questions and Fieldwork Bridge as first-class reference tabs.
- Why it matters: discoverability is weaker than reference parity and the UI suggests a missing surface where a real one exists.
- Recommended repair slice: wire the footer to the actual active-questions flow or remove the unavailable affordance once it is reachable through navigation.
- Explicit non-goals: no route or schema changes in this audit.
