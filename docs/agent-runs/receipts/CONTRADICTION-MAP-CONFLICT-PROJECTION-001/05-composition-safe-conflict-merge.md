# 05 — Composition-safe conflict merge

## Function

`mergeLiveContradictionConflicts(baseApi, liveMapApi)` in `lib/orvek-v0/production/hybrid-workbench-api.ts`.

Called at the end of `buildHybridWorkbenchDataApi` **after** `applyCompositionWorkbenchRails`.

## Behaviour

1. Collect live objects from live Map `conflicts` category where `inspectorObjectType === "contradiction_node"` and id is not `m-conflict-*`.
2. If none → return `baseApi` unchanged (exact prior behaviour).
3. If composition has `conflicts` → append live CN rail ids (dedupe); keep existing `m-conflict-*`.
4. If composition lacks `conflicts` and live CNs exist → add Active conflicts category with live ids only.
5. `getObject` / `getObjects` resolve live CN rail + raw ids.
6. Unrelated composition rails (patterns, goals, timeline, decisions, explore) untouched.
7. Does **not** globally merge all production Map categories.

## Distinction

| Id form | Family |
|---------|--------|
| `contradiction-<cuid>` | Live open ContradictionNode |
| `m-conflict-*` | Synthetic composition seed |
| `conclusion-<id>` with disputed UMC | Live disputed UserMapConclusion |
