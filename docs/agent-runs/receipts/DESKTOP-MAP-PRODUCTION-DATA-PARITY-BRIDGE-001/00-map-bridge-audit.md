# 00 Map Production Data Parity Bridge — Audit

## Branch context

- Branch audited: `desktop-map-production-data-parity-bridge-001`
- Base: current `staging` after #85 merge (`242112f`)
- Today production parity bridge is already landed; Map remains on `createMockOrvekDataApi()` baseline inside the hard-swapped workbench.

## Active Map render path

Production root Map is **not** `/your-map`. It is the reference workbench page switch:

```
app/(root)/layout.tsx
  → AppShell
  → OrvekWorkbenchShell
  → Workbench (components/orvek-v0/workbench.tsx)
  → WorkbenchProvider + OrvekDataProvider(useOrvekHybridWorkbenchDataApi)
  → OrvekShellLayout
  → Sidebar page switch
  → PageContent case "map"
  → MapPage (components/orvek-v0/pages/map.tsx)
  → EvidencePanel (components/orvek-v0/evidence-panel.tsx) — reference inspector rail
```

Parallel legacy production route (not active at `/`):

```
app/(root)/(routes)/your-map/page.tsx
  → OrvekMapPage
  → OrvekV0PageShell + ProductionInspectorBridge
  → MapPage (same reference component)
```

The accepted reference Map UI is **`components/orvek-v0/pages/map.tsx`**. Do not restore `YourMapWorkbench`, `YourMapListRail`, or `YourMapDetailPane`.

## Files / components that render Map

| Role | Path |
|------|------|
| Active page switch | `components/orvek-v0/workbench.tsx` |
| Map surface | `components/orvek-v0/pages/map.tsx` |
| Production header (when `displayContract === production`) | `components/orvek-workbench/ProductionMapHeader.tsx` |
| Reference header stats | `components/orvek-v0/MapPageHeaderStats.tsx` |
| Hybrid data hook (Today only today) | `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` |
| Mock baseline | `lib/orvek-v0/mock-api.ts` → `lib/orvek-v0/orvek-data.ts` |
| Production Map API builder | `lib/orvek-v0/production/map-api.ts` |
| Adapter / ontology contract | `lib/orvek-adapters/map.ts` |
| Existing wired route reference | `components/orvek-workbench/OrvekMapPage.tsx` |
| Selection helpers | `lib/orvek-v0/production/map-selection.ts` |
| Inspector bridge (only on `/your-map` shell) | `components/orvek-v0/production/ProductionInspectorBridge.tsx` |
| Reference inspector (active at `/`) | `components/orvek-v0/evidence-panel.tsx` |

## Reference Map data contract (current mock baseline)

`createMockOrvekDataApi()` supplies:

- `getObject` / `getObjects` → static zip objects in `lib/orvek-v0/orvek-data.ts` (`m-claim-1`, `ctx-current`, `aq-1`, `mu-1`, etc.)
- `mapCategories: []` → `MapPage` falls back to hardcoded `CATEGORIES` in `map.tsx`
- `mapHeader` mock stats (`mixed / evolving`, `243`, `7`)
- **No** `displayContract` → reference mode (`isProductionDisplay === false`)
- **No** `mapSelectedId`, `mapIsLoading`, `mapHasContent`, or map empty-copy slots

`OrvekDataApi` Map fields (`lib/orvek-v0/data-provider.tsx`):

- `mapCategories`, `mapHeader`, `mapSelectedId`
- `mapIsLoading`, `mapLoadError`, `mapHasContent`
- `emptyCopyBySlot` keys used by Map: `mapEmpty`, `mapSelectPrompt`, `mapCurrentUnderstandingEmpty`, `mapWhyEmpty`, `mapSupportingEmpty`, `mapConflictingEmpty`, `mapRelatedEmpty`

Production builder `buildMapProductionDataApi()` (`lib/orvek-v0/production/map-api.ts`) projects `MapMapDataInput` → `OrvekObject` graph with prefixed rail ids:

| Kind | Rail id pattern | Inspector fields |
|------|-----------------|------------------|
| Conclusion | `conclusion-{id}` | `inspectorObjectType: usermap_conclusion`, detail hydrated on selection |
| Model goal | `goal-{id}` (+ alias `{id}`) | `inspectorObjectType: model_goal` |
| Mind context | `context-{id}` (+ alias `{id}`) | `inspectorObjectType: context_profile` |
| Open question | `question-{id}` | no inspector type/id |
| Model update preview | `movement-{id}` | `inspectorObjectType: model_update` |

Ontology rails follow `V0_MAP_ONTOLOGY_RAIL_ORDER` / `V0_MAP_ONTOLOGY_RAIL_LABELS` in `lib/orvek-adapters/map.ts`.

## Production Map data sources already in repo

All fetch wiring already exists on `OrvekMapPage` and should be reused, not re-invented:

| Source | Function | Module |
|--------|----------|--------|
| User-map conclusions list | `fetchYourMapConclusions()` | `lib/your-map-surface.ts` → `GET /api/user-map/conclusions?limit=50&sortOrder=desc` |
| Selected conclusion detail | `fetchInspectorUserMapDetail(id)` | `lib/inspector-object-api.ts` |
| Conclusion evidence links | `fetchInspectorEvidenceLinks(INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(id))` | `lib/inspector-object-api.ts` |
| Mind context snapshot | `fetchMindContextSnapshot()` + `buildMindContextDisplayItems()` | `lib/mind-context-surface.ts` |
| Movement preview | `fetchMapMovementPreview()` | `lib/your-map-preview-surface.ts` |
| Open questions preview | `fetchMapOpenQuestionsPreview()` | `lib/your-map-preview-surface.ts` |
| Initial selection | `resolveMapWorkbenchSelectedId()` | `lib/orvek-v0/production/map-selection.ts` |

Adapter entry point: `mapMapDataToV0Props()` / `buildMapProductionDataApi()` in `lib/orvek-adapters/map.ts` + `lib/orvek-v0/production/map-api.ts`.

## Map action / navigation contract

Observed in `components/orvek-v0/pages/map.tsx`:

| Action | Behaviour | Workbench root today | Notes |
|--------|-----------|----------------------|-------|
| Sidebar → Map | `setPage("map")` | Works | No route change |
| Rail row click | `open(id)` → `setLocalId`, `select(id)`, optional `mapHandlers.onOpenItem` | `select` only | **No `OrvekPageHandlersProvider` at `/`** → detail fetch side effects absent |
| Related object click | same `open()` | same | |
| Inspector tab button | `select(obj.id)` + `setInspectorTab("evidence")` | Broken for production ids | EvidencePanel reads zip, not API |
| Correction chips | `applyCorrection(obj.id, label)` | Local workbench state only | Reference labels hardcoded in `map.tsx`; not persisted |
| `detailHref` link | Next `<Link>` navigation | Would leave workbench | Production goals/context may expose `/your-map?selected=…` or safe v0 hrefs |
| Empty production state | `ProductionMapHeader` + honest empty copy | Not reached | Mock baseline always shows reference categories |

**Inactive / deferred behaviours to preserve:**

- Do **not** wire `mapHandlers.onOpenItem` URL replace to `/your-map?selected=` inside root workbench (that would change navigation away from reference shell).
- Do **not** activate reference-dead controls beyond current reference behaviour.
- Open-question rail rows lack inspector object typing; treat as detail-only until typed.
- Model-update preview rows are preview-only; do not invent full movement inspector unless evidence exists.

## Workbench index / Inspector selectability

- `WorkbenchProvider.select(id)` accepts any string id.
- `MapPage` resolves objects via **`useOrvekData().getObject`** — production ids **will** work once the hybrid API merges map objects.
- **`EvidencePanel` does not use `useOrvekData()`**. It imports `getObject` / `getObjects` from `lib/orvek-v0/orvek-data.ts` (static zip index).
- Production rail ids (`conclusion-*`, `goal-*`, `context-*`, …) are **not** in the zip index → Inspector shows “Nothing selected” today even if Map detail pane renders.
- Today parity passed because Today continues to select **reference receipt ids** (`r6`, `d1`, …) that exist in the zip index.
- **Map bridge requires a companion inspector lookup fix** before merge: switch `EvidencePanel` to `useOrvekData().getObject/getObjects` (or an equivalent provider-aware lookup). This does **not** require changing `WorkbenchProvider`.

## Safe minimal bridge proposal

Follow the Today hybrid pattern (`08-today-production-data-parity-bridge-receipt.md`):

### Phase 1 — hydrate Map inside root workbench (allowed)

1. **Extend** `useOrvekHybridWorkbenchDataApi.ts` to fetch the same Map inputs as `OrvekMapPage` (list, mind context, movement preview, open questions; detail + evidence on selection).
2. **Build** `mapApi = buildMapProductionDataApi(input)` when list fetch succeeds and `mapHasContent === true`.
3. **Extend** `buildHybridWorkbenchDataApi()` with a third merge pass for Map:
   - Overlay `getObject` / `getObjects` for map object ids.
   - Pass through `mapCategories`, `mapSelectedId`, `mapHeader`, loading/error/content flags, map `emptyCopyBySlot`.
   - **Do not** set global `displayContract` on the hybrid API (Today precedent — preserves reference header branch in `MapPage` when categories are injected via `mapCategories.length > 0`).
4. **Fallback rule:** if Map fetch fails, loading, or `mapHasContent === false`, return mock Map baseline (`createMockOrvekDataApi()` map fields + zip objects) — never render dead empty master-detail.
5. **Keep** Today merge behaviour unchanged.
6. **Keep** `createMockOrvekDataApi()` for Decisions, Timeline, Explore, and unwired slots.

### Phase 1 companion fix (required for “Evidence Pointer / Inspector” parity)

7. Update `components/orvek-v0/evidence-panel.tsx` to resolve `selectedId` through `useOrvekData()` so Map selections open the reference Inspector rail with projected `OrvekObject` fields.

### Must remain mock / reference fallback

- Non-Map surfaces (Decisions, Timeline, Explore, overlays).
- Map when production list is empty or fetch fails.
- Open-question / movement preview rows without inspector backing — show detail projection only; do not fake inspector evidence.
- Correction chips remain local reference behaviour (no new persistence).

### Must not wire yet

- `mapHandlers.onOpenItem` URL navigation to `/your-map`.
- Replacing `MapPage` with old production Map components.
- Setting hybrid `displayContract = production` globally (would flip header/skeleton branches and abandon Today reference-mode parity).
- `ProductionInspectorBridge` at root unless explicitly scoped separately (different inspector stack; out of slice).
- Activating dead reference buttons or new capture flows beyond existing copy handoffs.

## Unsafe changes to avoid

- Restoring quarantined production shell (`RouteTopBar`, `RouteSidebar`, `ProductionInspectorAside`, `OrvekShellLayout` in `OrvekWorkbenchShell`).
- Touching `WorkbenchProvider` / workbench store semantics.
- Changing Today hybrid merge or Today intent metadata.
- Removing `createMockOrvekDataApi()` baseline.
- Using `YourMapWorkbench` or replacing reference master-detail layout.
- Forcing `withProductionContract()` onto the hybrid root API.
- Showing empty rails when production data is partial — fallback to mock instead.
- Wiring `detailHref` navigations that leave the workbench without product sign-off.

## Tests needed before / during implementation

Existing coverage to extend (do not rewrite):

| Test file | Gap |
|-----------|-----|
| `lib/__tests__/hybrid-workbench-api.test.ts` | Map merge preserves mock baseline; hydrates map categories/objects; no `displayContract`; Today untouched |
| `lib/__tests__/map-production-api.test.ts` | Already strong — keep as contract source |
| `lib/__tests__/your-map-workbench.test.ts` | Add assertion that root hybrid hook reuses `buildMapProductionDataApi` / fetch fns (mirror Today tests) |
| `lib/__tests__/orvek-v0-inversion.test.ts` | Map still renders via `MapPage` in `workbench.tsx`; shell unchanged |
| `lib/__tests__/shell-quarantine.test.ts` | No old shell regression |
| New: `map-hybrid-workbench-api.test.ts` or extend hybrid tests | Selection id resolution + fallback when `items.length === 0` |
| New: evidence-panel provider lookup test | `EvidencePanel` resolves production map id via `OrvekDataProvider` |

Suggested vitest command slice (post-implementation):

```bash
npx vitest run \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/map-production-api.test.ts \
  lib/__tests__/your-map-workbench.test.ts \
  lib/__tests__/orvek-v0-inversion.test.ts \
  lib/__tests__/shell-quarantine.test.ts
```

## Product-owner visual checklist (post-implementation)

- [ ] Root `/` → Sidebar Map shows **same master-detail layout** as reference (300px rail + detail pane).
- [ ] Header remains reference-style (not old production Map shell).
- [ ] With live user-map data: rails populate from production ontology; counts reflect real receipts/questions.
- [ ] With empty/failed fetch: reference mock Map appears (no blank dead UI).
- [ ] Selecting a conclusion updates detail pane with honest supporting/conflicting copy.
- [ ] “Full receipts & movement in inspector” opens reference Inspector rail with synced title/body.
- [ ] Related-object clicks stay inside Map (no unexpected route jump).
- [ ] Model goals + mind context rows render with safe copy; no fake evidence.
- [ ] Correction chips still behave as reference-local feedback (not claimed as persisted).
- [ ] Today page unchanged (Delta Log, Evidence Pointer, Continue from what changed).
- [ ] Decisions / Timeline / Explore still show reference/mock baseline.
- [ ] No resurrection of old production shell chrome.

## Recommendation

**Implement now — with a bounded two-part slice.**

**Reason:** The production Map contract is already implemented and tested (`buildMapProductionDataApi`, `OrvekMapPage`, `map-production-api.test.ts`). The remaining work mirrors the proven Today hybrid bridge: extend `useOrvekHybridWorkbenchDataApi` + `buildHybridWorkbenchDataApi`, with mock fallback. The main blocker is known and scoped: `EvidencePanel` must read from `OrvekDataProvider` before production Map ids are inspector-selectable.

**Do not merge** until both the hybrid Map merge and the EvidencePanel lookup fix pass tests and the product-owner visual checklist above.

Non-Map surfaces must remain on temporary reference/mock baseline. `createMockOrvekDataApi` stays for unwired surfaces. Stack remains **not production-ready** after Map bridge alone.

## Audit files inspected

- `components/orvek-workbench/OrvekWorkbenchShell.tsx`
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
- `components/orvek-workbench/OrvekMapPage.tsx`
- `components/orvek-workbench/ProductionMapHeader.tsx`
- `components/orvek-v0/workbench.tsx`
- `components/orvek-v0/pages/map.tsx`
- `components/orvek-v0/evidence-panel.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
- `components/orvek-v0/production/OrvekV0PageShell.tsx`
- `lib/orvek-v0/mock-api.ts`
- `lib/orvek-v0/orvek-data.ts`
- `lib/orvek-v0/data-provider.tsx`
- `lib/orvek-v0/display-contract.ts`
- `lib/orvek-v0/production/hybrid-workbench-api.ts`
- `lib/orvek-v0/production/map-api.ts`
- `lib/orvek-v0/production/map-selection.ts`
- `lib/orvek-adapters/map.ts`
- `lib/your-map-surface.ts`
- `lib/your-map-preview-surface.ts`
- `lib/mind-context-surface.ts`
- `lib/inspector-object-api.ts`
- `lib/__tests__/hybrid-workbench-api.test.ts`
- `lib/__tests__/map-production-api.test.ts`
- `lib/__tests__/your-map-workbench.test.ts`
