# Before / After UX Summary

Before:
- The Inspector mixed object read, evidence, movement, and correction context into long undifferentiated blocks.
- Evidence rows could collapse into generic `Linked evidence` cards with little hierarchy.
- Movement detail felt like a report dump rather than a readable movement readout.
- Selecting linked evidence or receipts could strand the user inside a replaced Inspector state.
- Unavailable detail states sounded system-facing rather than user-facing.
- User-facing Inspector copy exposed `Linked path` wording.

After:
- The Evidence / Context tab is broken into explicit, readable sections.
- Supporting evidence cards now show a clearer title, type, relation, and linked date.
- Dense read text and movement clauses are split into structured readouts instead of one paragraph blobs.
- Linked evidence and receipt selection now exposes a local `Back to ...` affordance inside the Inspector.
- Unavailable object states explain that detail is not available in this view yet and suggest using the related surface.
- User-facing Inspector copy no longer shows raw `Linked path` wording.
- Correction controls sit under a readable `Correct the model` section.

Manual validation:
- No browser screenshot pass was run in this slice.
- Validation here is code-level plus targeted inspector tests.

