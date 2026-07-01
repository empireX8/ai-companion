# Gap Audit

1. Where do Model Goals currently appear?
- In the chat memory panel and reference list as generic reference types.
- In the reference v0 data as `map-object` rows with `subtype: "goal"`.
- In the v0 map rail as a goals category derived from generic map objects.

2. Are Model Goals represented as a first-class object type anywhere?
- No.
- The shared object contract does not define a dedicated goal object type.
- The current shape is generic `map-object` plus `goal` subtype, which is not enough to make Model Goals a first-class production layer.

3. Are they selectable from Map/workbench?
- Not as a dedicated Model Goal object type.
- The production bridge and inspector selector only know how to select conclusions, model updates, patterns, contradictions, and mind context.
- The goals rail in the v0 reference map is still a generic rail, not a first-class goal selector path.

4. Are they inspectable in the inspector?
- Not as goals.
- Goal-like content can flow through generic map-object inspection, but there is no goal-specific inspector branch, title, or correction state.

5. Are they evidence-linked?
- Only in a generic sense.
- The reference goal rows in `lib/orvek-v0/orvek-data.ts` do not establish a goal-specific evidence model.
- The production bridge does not project goal-specific evidence lineage.

6. Can the user correct or update them through Capture Life Data?
- Not through a goal-specific correction path.
- Generic reference editing exists, but that is not the same as a first-class Model Goal correction flow.

7. Are they confused with generic memories or references?
- Yes.
- The chat memory panel and reference list both present goal as just another generic reference type.

8. Are there blocked links or unavailable routes involved?
- No dedicated goal-specific blocked-link problem surfaced in this audit.
- The current blocker is missing first-class object wiring, not a known dead-link route for goals.

9. What is the minimum repair needed?
- Introduce a dedicated goal object contract and selector path.
- Wire that object into production map data, inspector selection, and inspector detail state.
- Add an explicit correction handoff that creates evidence or review input instead of pretending the goal has already been changed.

10. What must remain deferred?
- Broad reference parity cleanup.
- Schema changes unless a bounded repair proves they are unavoidable.
- Styling work.
- Any expansion beyond the Model Goals slice.

Prioritized findings
- P1: No dedicated Model Goal object type exists in production contracts or selectors.
- P1: Production Map/workbench does not expose Model Goals as first-class selectable objects.
- P2: Goal content remains conflated with generic memories/references in the chat and reference surfaces.

