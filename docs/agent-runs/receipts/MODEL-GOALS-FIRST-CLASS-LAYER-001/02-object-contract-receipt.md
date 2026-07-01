# Object Contract Receipt

Model Goal contract added
- Shared object type: `model-goal`
- Inspector selector type: `model_goal`
- Ontology rail kind: `model_goal`
- Rail id form: `goal-${rawId}`
- Raw object id preserved: `m-goal-*`
- Visible labels: `Model Goal` and `Model Goals`

Fields used for the first-class read
- `title`
- `summary`
- `whyItMatters`
- `supporting`
- `conflicting`
- `confidence`
- `lastUpdated`
- `evidenceCount`
- `detailHref`
- `missingEvidence`
- `whatWouldChange`

Evidence and correction framing
- Evidence is summarized from the existing evidence count and linked-path shape.
- Low support is reported as provisional or thin support, not as authority.
- Correction copy says user correction is first-class evidence.
- Correction handoff goes to Capture Life Data using the existing capture route.

Map-safe projection
- Model Goal detail links stay v0-safe.
- The production map projection uses `/your-map?selected=goal-...` for first-class selection.
- No blocked `/references/...` or `/patterns/...` links are exposed as active Model Goal detail links.
