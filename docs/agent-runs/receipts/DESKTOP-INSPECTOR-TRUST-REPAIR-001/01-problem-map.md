# Problem Map

Primary blocker addressed:
- Inspector evidence and movement reads were too dense to trust.

Observed failure modes from live validation:
- Evidence / Context rendered as dense paragraph blobs.
- Supporting and conflicting signals were mixed together.
- Movement text read as one dump instead of a structured readout.
- Evidence click-through replaced Inspector state with no local return path.
- Unavailable linked-object states were vague.
- Raw path-like strings such as `Linked path` leaked into user-facing Inspector copy.
- Correction actions were not clearly grouped under a readable model-correction section.

Repair target for this slice:
- make the selected object understandable
- keep evidence weak/missing states visible
- make movement readable as `Before / After / Why / Guardrails / Evidence used`
- add local Inspector back behavior without adding routes

