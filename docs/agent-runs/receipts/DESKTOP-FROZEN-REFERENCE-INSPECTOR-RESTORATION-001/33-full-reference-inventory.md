# 33 — Full frozen-reference inventory (authority)

Authority route: `http://localhost:3000/dev/orvek-v0-reference`
Package: `components/orvek-v0-reference-frozen/**`
Generated deterministic manifest: `33-full-reference-manifest.json`

## Central fixture

- `reference-data.ts` — 66 `OrvekObject`s across 11 types + `EXPLORE_GROUNDING` + `EXPLORE_MOVEMENT`
- Twin (Search overlay only): `lib/orvek-v0/orvek-data.ts`

## Page-local composition (not in OBJECTS alone)

| Surface | Hardcoded in frozen page | Wired into round-trip via |
|---|---|---|
| Today | briefing, lead chrome, NOW_ROWS, MOVEMENTS, PRIMARY_ACTIONS, resurfaced ids, report rail copy | `CanonicalTodayComposition` payload |
| Map | CATEGORIES rails, CORRECTIONS labels, header “243 / 7” chrome | workbench.mapCategories (IDs/labels). Header counts are frozen-page chrome; canonical Map computes from category slots — documented reference behaviour, not repaired |
| Decisions | LISTS groups, STAGES, header “2 / 12” chrome | workbench.decisionListGroups. Header stats computed in canonical page |
| Timeline | GROUPS, FILTERS, lane legend | workbench.timelineGroups + timelineFilters |
| Explore | Free Explore transcript bubbles, quick prompts, Fieldwork Bridge static fields (frozen), detection line | Objects + explore* id lists + exploreMovement. Frozen Free Explore bubbles remain page-local in frozen package; canonical Explore uses live chat when present — known representation gap for chat transcript only |

## Dead / non-writing controls (preserve as reference behaviour)

- Explore Ask / composer / quick prompts → inspector tab only (no send in frozen)
- Questions / Investigations action buttons without onClick
- Decisions draft entry local-only; Compare options no-op branch
- Capture / Import overlays local state only
- Today PRIMARY_ACTIONS all select `d1`
- Map corrections memory-only

## Persistence path

production `CanonicalTodayComposition.payload` (Today + workbench rails + objects[])
+ `CanonicalModelMovementReport`
→ `GET /api/canonical-today-composition`
→ hybrid prefers composition workbench rails
→ live provider → unchanged canonical pages
