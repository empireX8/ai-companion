# Dependency Map

## Stable foundations that should not be reopened

Accepted foundations already exist for:
- Mind Context first-class object support
- Model Goals first-class object support
- Map object selection safety
- Active Questions / Watch For basic parity
- Explore composer wireup
- Today route allowlist and route-first output policy

These foundations should be treated as stable inputs, not reopened scope.

## Blocker dependencies

| Blocker | Depends on | Does not require reopening |
|---|---|---|
| Inspector UX | Existing object selection, evidence panel ownership, Model Goals and Mind Context object support | schema, generation logic, new object families, map selection foundations |
| Decisions flow | Existing Decisions surface and object list | schema, persistence expansion, new decision object types |
| Today action routing | Stable route allowlist, Decisions behavior targets, Watch For destination truth | shell nav redesign, new route creation, schema |
| Capture Life Data UX contract | Stable Today action semantics, existing capture route, existing evidence/correction concepts | new storage, new route family, generic journaling expansion |
| Watch For / Fieldwork architecture | Existing Watch For route and fieldwork object concept | schema, new family generation logic |
| Map object presentation | Inspector readability, stable Mind Context / Model Goals / selection support | selection rewrite, new object types, new public routes |
| Explore grounding | Stable inspector behavior and correction language | new chat architecture, new persistence |
| Timeline continuity | Stable inspector behavior and map object presentation | new timeline schema, new media system |

## Direct answers to dependency questions

Which blockers depend on Model Goals / Mind Context / Map object selection work?
- Inspector UX depends on those object families already being stable and selectable.
- Map object presentation depends on those families being present and on selection already being safe.
- Explore grounding and Timeline continuity benefit from that stability, but do not need those foundations reopened.

Which blockers are mostly routing/action-flow only?
- Today action routing
- Watch For / Fieldwork architecture
- part of Decisions flow

Which blockers are mostly visual/presentation?
- None are purely visual-only.
- Inspector UX and Map object presentation are presentation-heavy, but they are trust and state-comprehension issues, not brand-only polish.

