# 01 — Current ContradictionNode → Map absence trace

**Campaign:** CONTRADICTION-MAP-CONFLICT-PROJECTION-001
**Baseline HEAD:** `e3b79ed`
**Mode:** pre-edit runtime truth (no product mutation in this receipt)

---

## End-to-end chain (actual at intake)

```
ContradictionNode (Prisma)
  → GET /api/contradiction?status=… (exists; Map does not call it)
  → useOrvekHybridWorkbenchDataApi
       fetchYourMapConclusions() → /api/user-map/conclusions  (UMC only)
  → MapMapDataInput.items: UserMapConclusionPublicApiListItem[]
       NO ContradictionNode field
  → lib/orvek-adapters/map.ts
       resolveConclusionOntology: status==="disputed" → rail "conflicts"
       kind enum: conclusion | model_goal | mind_context | open_question | model_update
       NO contradiction kind
  → lib/orvek-v0/production/map-api.ts
       railItemToOrvekObject → inspectorObjectType: "usermap_conclusion"
  → buildHybridWorkbenchDataApi
       if todayApi.mapCategories.length > 0 (full_reference_round_trip_seed):
         composition owns ALL mapCategories; live Map densograph blocked
       Import review is force-overridden live (precedent for narrow exception)
  → CanonicalLiveRuntimeEntry → CanonicalWorkbench
       components/orvek-v0-canonical/pages/map.tsx  ← ACTUAL mounted Map
  → select(railId) → ProductionInspectorBridge
       resolveInspectorObjectType(object.inspectorObjectType)
  → Inspector GET /api/inspector/contradictions/[id]
       ALREADY supports public statuses including open
       BUT Map never emits contradiction_node selection from Active conflicts
```

---

## Layer findings

### 1. Storage

- Model: `ContradictionNode` in `prisma/schema.prisma`
- Status enum: `candidate | open | snoozed | explored | resolved | accepted_tradeoff | archived_tension`
- **No** `rejected` / `dismissed` on ContradictionNode (candidate dismiss = hard delete)
- Accept write path already materialises `status=open` + UELs + optional ModelUpdate (unit-proven; not this campaign)

### 2. Authenticated list/read APIs

| Endpoint | Suitable for Map open CN list? |
|----------|--------------------------------|
| `GET /api/contradiction?status=open` | **Yes** — user-scoped, paginated, returns open only when filtered |
| `GET /api/inspector/contradictions/[id]` | Detail/Inspector only; not a list |
| `GET /api/import-review/candidates` | Candidates only |
| `GET /api/user-map/conclusions` | UserMapConclusion only |

**Decision at intake:** reuse `GET /api/contradiction?status=open` via a Map-specific client mapper (confidence + evidenceCount already returned by the route select). Do not broaden into a general contradiction-management API.

### 3. Map input / adapter

- `MapMapDataInput` has no contradiction bucket
- Active conflicts populated **only** from disputed `UserMapConclusion`
- Item kind has no explicit contradiction identity

### 4. Production objects

- Conflict rail rows are `map-object` + `inspectorObjectType: "usermap_conclusion"`
- Hard default in `resolveInspectorObjectType` for bare `map-object` is also `usermap_conclusion`

### 5. Composition mask

- `applyCompositionWorkbenchRails` replaces `mapCategories` when composition workbench present
- Kay has `full_reference_round_trip_seed` with `m-conflict-*` seed conflicts
- Live Map merge is blocked; shell header/loading may still apply

### 6. Mounted surface

- **Mounted:** `components/orvek-v0-canonical/pages/map.tsx` via AppShell → CanonicalLiveRuntimeEntry
- **Quarantined / dead under shell:** `components/orvek-v0/pages/map.tsx` / `OrvekMapPage`

### 7. Inspector

- `contradiction_node` selectable type + `fetchInspectorContradiction` + evidence panel **already exist**
- Gap is Map emission of that type from the conflicts rail

---

## Gap Wave 1.1 must close

1. Fetch open CNs into Map production input
2. Project with explicit contradiction kind + stable `contradiction-<rawId>`
3. Production object with `inspectorObjectType: contradiction_node` / raw id
4. Composition-safe conflicts overlay (Import-style narrow exception)
5. Provider wiring on hybrid hook
6. Tests + non-persistent presentation fixture

**Not gaps:** Prisma model; accept write path; Inspector fetch by id.
