# 00 Decisions Production Data Parity Bridge — Audit

## Branch context

- Branch audited: `desktop-decisions-production-data-parity-bridge-001`
- Base: `staging` after #87 merge (Timeline bounded fetch bridge landed)
- Today, Map, and Timeline production parity bridges are live in root workbench via `useOrvekHybridWorkbenchDataApi`
- Decisions remains on `createMockOrvekDataApi()` baseline with hardcoded reference lists inside `DecisionsPage`

## Active root Decisions path

Production root Decisions is **not** `/actions`. It is the reference workbench page switch:

```
app/(root)/layout.tsx
  → AppShell
  → OrvekWorkbenchShell
  → Workbench (components/orvek-v0/workbench.tsx)
  → WorkbenchProvider + OrvekDataProvider(useOrvekHybridWorkbenchDataApi)
  → OrvekShellLayout
  → Sidebar page switch
  → PageContent case "decisions"
  → DecisionsPage (components/orvek-v0/pages/decisions.tsx)
  → EvidencePanel (components/orvek-v0/evidence-panel.tsx) — reference inspector rail
```

Parallel legacy production route (not active at `/` sidebar switch):

```
app/(root)/(routes)/actions/page.tsx
  → OrvekDecisionsPage
  → OrvekV0PageShell + ProductionInspectorBridge
  → DecisionsPage (same reference component)
```

Quarantined alternate production view (not used by either path above):

```
components/orvek-workbench/views/V0DecisionsView.tsx
components/decisions/DecisionsPriorityBand.tsx
components/decisions/DecisionItemCard.tsx
```

The accepted reference Decisions UI is **`components/orvek-v0/pages/decisions.tsx`**. Do not restore `V0DecisionsView`, old `/actions` shell chrome, or route-first navigation to `/actions` from root interactions.

---

## Audit answers

### 1. What component renders the root Decisions surface?

**`components/orvek-v0/pages/decisions.tsx` (`DecisionsPage`)** via `components/orvek-v0/workbench.tsx` page switch.

Data comes from `useOrvekData()` inside `DecisionsPage`, backed today by `useOrvekHybridWorkbenchDataApi()` → `createMockOrvekDataApi()` (zip `getObject` + empty `decisionListGroups`).

### 2. What reference/mock data shape does Decisions expect?

**List structure** — when `decisionListGroups` is empty (current mock), `DecisionsPage` falls back to hardcoded `LISTS`:

| Heading | Reference ids |
|---------|----------------|
| Active | `d1`, `d2`, `d3` |
| Chosen | `d-public` |
| Outcome due | `d-nav` (tone: action) |
| Reviewed | `d-rev-1`, `d-rev-2`, `d-rev-3` |

**Header stats** — reference mode shows hardcoded `2 outcomes due · 12 reviewed`. Production mode reads `decisionsHeaderStats.outcomesDue` / `reviewed`.

**Per-decision `OrvekObject` fields used by `DecisionsPage` workspace** (from `lib/orvek-v0/orvek-data.ts`):

| Field | Usage |
|-------|--------|
| `id` | Sidebar selection, `workspaceId`, `select(id)` |
| `type` | `decision` |
| `title` | List label + workspace headline |
| `summary` | Workspace intro |
| `recommendation` | “Evidence-backed read” block |
| `options[]` | Options grid (label, text, pros, cons) |
| `decisionContext[]` | Constraints / wants / fears table |
| `contextIds` | Background context chips → `select(contextId)` |
| `receiptIds` | Related receipts list → `select(receiptId)` |
| `projection`, `confidence` | Projection block |
| `outcomeWindow`, `expectedOutcome`, `actualOutcome` | Outcome panel |
| `tags` | Lifecycle stage detection (`/outcome due/i.test`) |
| `relatedIds` | Not rendered directly in workspace; Inspector / graph |

**`OrvekDataApi` Decisions fields** (`lib/orvek-v0/data-provider.tsx`):

- `decisionListGroups: { heading, ids, tone? }[]`
- `decisionsHeaderStats?: { outcomesDue, reviewed }`
- `decisionsSelectedId?: string | null`
- `decisionsIsLoading?: boolean`
- `emptyCopyBySlot` keys: `decisionsEmpty`, `decisionsOptionsEmpty`, `decisionsProjectionEmpty`, `decisionsOutcomeEmpty`, `decisionsContextEmpty`

`createMockOrvekDataApi()` sets `decisionListGroups: []` — page uses embedded `LISTS` + zip objects.

### 3. What interactions does Decisions have with Inspector, selected objects, overlays, reports, or page state?

| Interaction | Behaviour today (root reference) |
|-------------|----------------------------------|
| Sidebar click | `openDecision(id)` → `setWorkspaceId(id)` + `select(id)` |
| Context chips | `select(contextId)` — opens Inspector on zip context objects |
| Receipt rows | `select(receiptId)` — opens Inspector on zip receipts (`r1`, etc.) |
| “What this reveals” | `select(workspaceId)` + `setInspectorTab("movement")` |
| “Generate Decision Review” | `openReport("rep-decision")` — reference report overlay |
| “Talk it through” / Explore | `setPage("explore")` |
| Entry module / quick actions | Local draft state; reference-only actions (`Review due decision` → `d-nav`, local outcome toggle) |
| Production branch | Entry/quick actions disabled via `ORVEK_DEFERRED_ACTION_CLASS`; empty workspace skeleton when `isProduction` and no decision selected |
| Page handlers | `ReferencePageHandlersProvider` defines `decisions.*` handlers but **`DecisionsPage` does not call `useOrvekPageHandlers()`** — unused at root |
| Overlays | Report overlay via `openReport`; no capture/import overlay from Decisions |

`EvidencePanel` renders decision-specific blocks when `obj.type === "decision"` (recommendation, options, decisionContext, projection, outcome fields).

### 4. Which production APIs/data sources already exist?

| Source | Fetch / API | Builder |
|--------|-------------|---------|
| Surfaced actions list | `fetchActionsPageData()` → `GET /api/actions` | `buildDecisionsProductionDataApi(list)` |
| Action update | `PATCH /api/actions/:id` | Used by production `/actions` flows, not root page |
| Fieldwork from action | `createFieldworkFromAction()` → `POST /api/fieldwork` | Production handoff only |
| Adapter (richer view model) | — | `mapDecisionsDataToV0Props()` in `lib/orvek-adapters/decisions.ts` (powers `V0DecisionsView`, not root `DecisionsPage`) |
| Wired reference route | — | `components/orvek-workbench/OrvekDecisionsPage.tsx` |

Production list items are `SurfacedActionView` (`lib/actions-api.ts`): `id`, `title`, `whySuggested`, `bucket`, `effort`, linked pattern/goal fields, `status`, `note`, timestamps.

`buildDecisionsProductionDataApi()` maps actions → thin `OrvekObject` graph and four sidebar groups (Active / Chosen / Outcome due / Reviewed) by `status` + `note` heuristics.

**Not wired into root hybrid hook today** — `useOrvekHybridWorkbenchDataApi` has no Decisions fetch or merge.

### 5. Which production fields are display-ready for the reference Decisions surface?

| Field / projection | Ready? | Notes |
|--------------------|--------|-------|
| Sidebar title | Yes | `action.title` |
| Summary / evidence-backed read | Mostly | `whySuggested` is short, governed copy |
| Status → list group | Mostly | `not_started` / `done` / `helped` / `didnt_help` + `note` split |
| Header stats (outcomes due / reviewed) | Yes | Derived from groups in `buildDecisionsProductionDataApi` |
| Empty copy slots | Yes | `DECISIONS_EMPTY_COPY` + adapter empty strings |
| Inspector target metadata | Partial | `inspectorObjectType: pattern_claim` when `linkedClaimId` present |
| Linked claim summary as receipt quote | Partial | Available on `SurfacedActionView`, not fully projected into workspace receipts block |

### 6. Which production fields are raw, missing, stale, duplicated, or unsafe?

| Risk | Detail |
|------|--------|
| **Thin object vs reference workspace** | Production `actionToObject()` sets only `title`, `summary`, `recommendation` (duplicate of summary), `receiptIds: [linkedClaimId]`, empty `contextIds` — **no** `options`, `decisionContext`, `projection`, `confidence`, `outcomeWindow`, `actualOutcome` |
| **Lifecycle stage mismatch** | Reference stage strip uses `actualOutcome`, `outcomeWindow`, tags matching `Outcome due`. Production tags are status labels (`Unresolved`, `Recorded`, …) — **will not drive reference stage UI correctly** |
| **Duplicate recommendation** | `recommendation` and `summary` both set to `whySuggested` — same duplication class Map/Timeline gates block |
| **Missing linked receipts in zip** | `linkedClaimId` is a DB pattern-claim id, not reference `r6`/`r1` — `getObjects(receiptIds)` may return empty unless provider merges claim projection |
| **No presentation normalization gate** | Unlike Map/Timeline, no `decisions-presentation.ts` / readiness checks |
| **`withProductionContract` on standalone builder** | Sets `displayContract: production` — must **not** propagate to hybrid root API (flips `isProduction` branches: disabled entry module, skeleton workspace, hardcoded header fallback loss) |
| **Tab/bucket drift** | `OrvekDecisionsPage` filters by `?bucket=stabilize|build`; reference `DecisionsPage` has **no tabs** — bucket split must not surface at root |
| **Raw `whySuggested` overflow** | Long ranking copy could overflow summary/recommendation slots without caps |
| **Sparse real accounts** | Empty `/api/actions` list → dead sidebar unless fallback to reference mock |
| **Local outcome toggle** | Reference `outcomeAdded` state is UI-only; production statuses are API-backed — bridge must not fake recorded outcomes |

### 7. Does Decisions currently depend on mock/reference IDs that EvidencePanel can resolve?

**Yes.** Reference lists use zip ids (`d1`–`d3`, `d-nav`, `d-rev-*`, etc.) in `lib/orvek-v0/orvek-data.ts`. `useOrvekObjectGraph()` resolves them via provider → zip fallback.

Nested lookups depend on zip graph:

- `receiptIds`: `r1`, `r2`, `r3`, `r5`, …
- `contextIds`: `ctx-self`, `ctx-values`, `ctx-current`, `ctx-constraints`
- `openReport("rep-decision")` → report object in zip

Production action ids (`surfaced-action-*` / UUIDs from DB) are **not** in zip — they only resolve after hybrid merge puts them in `OrvekDataProvider`.

### 8. What would break if production Decision IDs replaced reference IDs?

| Breakage | Cause |
|----------|--------|
| Rich workspace collapses | No `options` / `decisionContext` / `projection` on production objects — reference panels empty |
| Lifecycle stepper wrong | Status labels ≠ reference tag/stage semantics |
| Inspector thin / empty on receipts | `linkedClaimId` not in zip; `select(receiptId)` misses unless claim objects merged |
| Context chips missing | `contextIds: []` in production builder |
| “What this reveals” weak | Production decision lacks movement fields; movement tab may be empty |
| Header / list flash | `isProduction` branch if `displayContract` leaks — disabled capture + skeleton workspace |
| False parity | Showing thin production list instead of rich reference `d1` narrative — **visible regression** |
| Report overlay | `openReport("rep-decision")` still works (zip report), but `openReport(obj.id)` on production id would not |

### 9. What safety gate needed before production Decisions data can enter root Decisions?

Mirror Map/Timeline bridge pattern:

1. **`lib/orvek-v0/production/decisions-presentation.ts`** with:
   - Title/summary/recommendation length caps
   - Raw-text / error-pattern rejection
   - Duplicate summary/recommendation suppression
   - Reference list heading validation (`Active`, `Chosen`, `Outcome due`, `Reviewed`)
   - Tag normalization for lifecycle strip (`Outcome due`, `Reviewed`, `Active`) from action status
   - Optional-field honesty: do not fabricate `options` / `decisionContext` / `projection`
   - Row-level `isDecisionsObjectPresentationReady()`
   - Stream-level `isDecisionsPresentationReady()` — valid groups, min row count, not loading, no fetch error
2. **`shouldMergeDecisionsProductionApi()`** + **`normalizeDecisionsProductionDataApi()`**
3. **Hybrid rules**:
   - Do **not** set global `displayContract` on hybrid API
   - Merge `decisionListGroups`, `decisionsHeaderStats`, `decisionsSelectedId`, `decisionsIsLoading`, `emptyCopyBySlot`, `getObject`/`getObjects` only when gate passes
   - Fallback to reference `LISTS` + zip objects on failure
4. **Inspector companion**:
   - When selecting linked receipts, resolve `linkedClaimId` / `inspectorObjectId` if provider has claim projection
   - Register claim aliases in production builder when safe (mirror Map goal aliases)
5. **No `/actions` navigation** or stabilize/build tab wiring at root

### 10. Smallest safe implementation slice after this audit

**Recommended phased slice (do not combine with Today/Map/Timeline changes):**

#### Slice A — presentation contract + gate (no fetch)

- Add `lib/orvek-v0/production/decisions-presentation.ts`
- Extend `buildDecisionsProductionDataApi` projection: lifecycle tags, `lastUpdated`, claim aliases, deduped recommendation
- Tests: `decisions-presentation-readiness.test.ts`

#### Slice B — hybrid overlay merge only (no hook fetch)

- Extend `buildHybridWorkbenchDataApi()` with gated `mergeDecisionsOverlay()`
- Tests: hybrid merge preserves reference Decisions when gate fails

#### Slice C — bounded fetch in `useOrvekHybridWorkbenchDataApi`

- `fetchActionsPageData()` (merge `stabilizeNow` + `buildForward` or unified list — **no bucket tabs at root**)
- Gate + normalize on merge; mock fallback otherwise
- Tests: hook wiring, fallback, Today/Map/Timeline untouched

#### Slice D — Inspector / receipt resolution (small, may ship with C)

- Receipt/context chip clicks resolve `inspectorObjectId` / `linkedClaimId` when provider-backed
- `openDecision` preserves reference `select(id)` when no inspector target

**Do not** switch root to `V0DecisionsView` or restore old `/actions` production shell.

---

## Interaction risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Thin production workspace replaces rich reference narrative | **High** | Readiness gate + fallback; optional min-field policy per group |
| `displayContract: production` disables reference entry UX | **High** | Never set on hybrid API |
| Lifecycle stepper drift | Medium | Normalize tags from `status` + `note` to reference stage vocabulary |
| Linked claim receipts not in provider graph | Medium | Merge claim objects or select `linkedClaimId` with alias lookup |
| Empty actions list for new users | Medium | Fallback to reference `LISTS` — intended |
| Duplicate summary/recommendation | Medium | Normalization suppresses |
| Today/Map/Timeline regression | High | Hybrid tests must assert other merges unchanged |
| Old shell resurrection | High | `shell-quarantine.test.ts` unchanged |

---

## Proposed minimal bridge plan

```
useOrvekHybridWorkbenchDataApi
  → fetchActionsPageData()  // GET /api/actions
  → flatten stabilizeNow + buildForward
  → buildDecisionsProductionDataApi(raw list)
  → shouldMergeDecisionsProductionApi() ?
       yes → buildHybridWorkbenchDataApi(base, today, map, timeline, normalized decisions)
       no  → reference LISTS + zip objects (current behaviour)
```

**Must remain mock / reference fallback:**

- Decisions when gate fails, fetch fails, or list empty
- Explore, overlays (except existing report handoff)
- `createMockOrvekDataApi()` baseline for unwired slots

**Must not wire yet:**

- Navigation to `/actions` from root clicks
- Stabilize/build tab chrome from `V0DecisionsView`
- Global `displayContract: production` on hybrid API
- `ProductionInspectorBridge` at root
- PATCH/action write flows unless explicitly scoped

---

## Tests required before implementation

| Test file | Gap to add |
|-----------|------------|
| `lib/__tests__/decisions-presentation-readiness.test.ts` | **New** — normalization, gate, tag mapping, duplicate suppression |
| `lib/__tests__/hybrid-workbench-api.test.ts` | Decisions merge + fallback; Today/Map/Timeline preserved |
| `lib/__tests__/decisions-surface.test.ts` | Extend as contract source |
| `lib/__tests__/evidence-panel-provider-lookup.test.ts` | Production decision id + linked claim resolution |
| `lib/__tests__/orvek-display-contract.test.ts` | Hybrid api stays non-production |
| `lib/__tests__/shell-quarantine.test.ts` | No old shell regression |
| New: `decisions-hybrid-fetch.test.ts` | Hook source asserts fetch fns; no `router.push('/actions')` |

Suggested vitest slice (post-implementation):

```bash
npx vitest run \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/decisions-presentation-readiness.test.ts \
  lib/__tests__/decisions-surface.test.ts \
  lib/__tests__/decisions-hybrid-fetch.test.ts \
  lib/__tests__/evidence-panel-provider-lookup.test.ts \
  lib/__tests__/shell-quarantine.test.ts \
  lib/__tests__/orvek-v0-inversion.test.ts
```

---

## Product-owner visual check

**Required for implementation** (not for this audit).

Checklist:

- [ ] Root sidebar Decisions keeps reference layout (entry module + 260px list + workspace, `lg:grid-cols-[260px_1fr]`)
- [ ] Reference entry module and quick actions remain enabled (not production-deferred) when on mock fallback
- [ ] With live data passing gate: sidebar groups populate; workspace shows honest fields only (no fabricated options grid)
- [ ] With empty/failed fetch: reference mock Decisions (`d1` workspace richness) appears — no blank dead UI
- [ ] Receipt/context chips open Inspector when claims are linked
- [ ] “What this reveals” / movement tab behaves honestly (no empty movement theater)
- [ ] No navigation to `/actions` from root interactions
- [ ] Today + Map + Timeline unchanged
- [ ] No old production shell chrome

---

## Status

- **Audit only** — no runtime code changed
- **Not production-ready** — no Decisions bridge implemented
- **Recommendation: implement with Map/Timeline-style gated hybrid merge** after Slice A presentation gate lands

## Next step

Implement Slice A (`decisions-presentation.ts` + readiness tests), then hybrid merge + bounded fetch following Timeline receipts 01–03 pattern.
