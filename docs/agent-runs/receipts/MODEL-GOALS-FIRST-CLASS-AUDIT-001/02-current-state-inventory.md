# Current State Inventory

Goal language in generic capture surfaces
- `app/(root)/(routes)/chat/_components/memory-panel.tsx:12-19,48-56,491` treats `goal` as one of the generic reference types and offers it as a save option in the memory panel.
- `app/(root)/(routes)/references/_components/ReferenceListPanel.tsx:17-27,37-55` treats `goal` as a generic reference filter, label, and chip style.

Goal type shape in shared contracts
- `lib/orvek-v0/orvek-types.ts:1-20` does not define a dedicated goal object type. It only includes `goal` as a `MapSubtype`.
- `lib/orvek-v0/orvek-types.ts:34-55` exposes generic object fields such as `detailHref`, `supporting`, `conflicting`, `missingEvidence`, and `whatWouldChange`, but none of those fields are goal-specific.

Goal objects in reference workbench data
- `lib/orvek-v0/orvek-data.ts:294-324` contains `m-goal-1`, `m-goal-2`, and `m-goal-3`, but each is still `type: "map-object"` with `subtype: "goal"`.
- Those reference goal rows carry tags and related ids, but they do not establish a separate production model-goal object type.

Production workbench page
- `components/orvek-workbench/OrvekMapPage.tsx:35-196,198-240` loads conclusions and mind context, resolves selection through `resolveMapWorkbenchSelectedId`, and then only fetches conclusion detail for the selected conclusion id. There is no goal-specific branch.

Production map and inspector wiring
- `components/orvek-v0/pages/map.tsx:51,91,220-434` shows a `goals` rail in the reference map UI, but the selected detail still renders through generic object fields and a generic `detailHref` link path.
- `components/orvek-v0/production/ProductionInspectorBridge.tsx:16-29,38-60` maps `context`, `map-object`, and `model-update` into inspector object types, but there is no goal-specific inspector type.
- `components/inspector/InspectorSelectButton.tsx:31-45` allows `usermap_conclusion`, `model_update`, `pattern_claim`, `contradiction_node`, and `context_profile`, but not a goal selector type.
- `lib/inspector-selection.ts:4-13,31-117` defines the same published-safe selector set and does not include a goal object type or goal href parser.
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx:223-479` renders generic summary, evidence, context, movement, and correction sections, but has no dedicated model-goal branch.

Map production bridge and selection behavior
- `lib/orvek-v0/production/map-api.ts:52-133,150-223` projects mind context and conclusions into the production data api, but no dedicated model-goal object is built there.
- `lib/orvek-v0/production/map-selection.ts:11-32` resolves preferred mind context and conclusion selection only. There is no goal selection path.

Test coverage
- `lib/__tests__/orvek-ux-integration.test.ts:39-47` still treats the published-safe selector list as fixed and excludes any goal type.
- `lib/__tests__/reference-detail.test.ts:23-35` and `lib/__tests__/reference-actions.test.ts:31-43,128-145` use `type: "goal"` for generic reference items, not for a first-class model-goal object.
- `lib/__tests__/map-production-api.test.ts:157-289` covers mind context and blocked link behavior, but not first-class model goals.
