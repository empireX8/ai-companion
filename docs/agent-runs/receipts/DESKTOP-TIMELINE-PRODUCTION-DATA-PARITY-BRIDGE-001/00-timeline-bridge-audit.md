# 00 Timeline Production Data Parity Bridge — Audit

## Branch context

- Branch audited: `desktop-timeline-production-data-parity-bridge-001`
- Base: `staging` after #86 merge (Map bounded fetch bridge landed)
- Today + Map production parity bridges are live in root workbench via `useOrvekHybridWorkbenchDataApi`
- Timeline remains on `createMockOrvekDataApi()` baseline with hardcoded reference groups inside `TimelinePage`

## Active root Timeline path

Production root Timeline is **not** `/timeline`. It is the reference workbench page switch:

```
app/(root)/layout.tsx
  → AppShell
  → OrvekWorkbenchShell
  → Workbench (components/orvek-v0/workbench.tsx)
  → WorkbenchProvider + OrvekDataProvider(useOrvekHybridWorkbenchDataApi)
  → OrvekShellLayout
  → Sidebar page switch
  → PageContent case "timeline"
  → TimelinePage (components/orvek-v0/pages/timeline.tsx)
  → EvidencePanel (components/orvek-v0/evidence-panel.tsx) — reference inspector rail
```

Parallel legacy production route (not active at `/` sidebar switch):

```
app/(root)/(routes)/timeline/page.tsx
  → OrvekTimelinePage
  → OrvekV0PageShell + ProductionInspectorBridge
  → TimelinePage (same reference component)
```

Quarantined older surface (not used by either path above):

```
app/(root)/(routes)/timeline/_components/TimelineSurface.tsx
```

The accepted reference Timeline UI is **`components/orvek-v0/pages/timeline.tsx`**. Do not restore `V0TimelineView`, `TimelineSurface`, or route-first navigation to `/timeline` from root interactions.

---

## Audit answers

### 1. What component renders the root Timeline surface?

**`components/orvek-v0/pages/timeline.tsx` (`TimelinePage`)** via `components/orvek-v0/workbench.tsx` page switch.

Data comes from `useOrvekData()` inside `TimelinePage`, backed today by `useOrvekHybridWorkbenchDataApi()` → `createMockOrvekDataApi()` (zip `getObject` + empty `timelineGroups`).

### 2. What reference/mock data shape does Timeline expect?

**Group structure** — when `timelineGroups` is empty (current mock), `TimelinePage` falls back to hardcoded `GROUPS`:

| Heading | Reference ids |
|---------|----------------|
| Today | `t1`–`t4` |
| This week | `t5`–`t7` |
| Last week | `t8`–`t11` |
| Earlier | `t12`–`t14` |
| Imported history | `imp-1` (via `t8` related link only; group lists `imp-1` id) |

**Filter rail** — when `timelineFilters` is empty, falls back to hardcoded `FILTERS`: `All`, `Model Updates`, `Receipts`, `Decisions`, `Reports`, `Fieldwork`, `Context Profile`, `Imports`.

**Per-event `OrvekObject` fields used by `TimelinePage`** (from `lib/orvek-v0/orvek-data.ts`):

| Field | Usage |
|-------|--------|
| `id` | Row key, `select(id)`, `getObject(id)` |
| `type` | `timeline-event` |
| `title` | Row headline |
| `summary` | Subline |
| `eventType` / `reportType` | Chip label + lane classification |
| `date` / `lastUpdated` | Timestamp display (`e.date ?? e.lastUpdated`) |
| `before` / `after` | Inline before/after block + `moved` badge; triggers Inspector movement tab |
| `tags` | Client-side filter matching |
| `relatedIds`, `receiptIds` | Not rendered in list; used indirectly when Inspector opens linked objects |

**`OrvekDataApi` Timeline fields** (`lib/orvek-v0/data-provider.tsx`):

- `timelineGroups: { heading, ids }[]`
- `timelineFilters: string[]`
- `timelineIsLoading?: boolean`
- `emptyCopyBySlot.timelineEmpty`
- **No** `displayContract` on mock baseline → reference mode

`createMockOrvekDataApi()` sets `timelineGroups: []`, `timelineFilters: []` — page uses embedded reference constants.

### 3. What interactions does Timeline have with Inspector, reports, selected objects, overlays, or page state?

| Interaction | Behaviour today (root reference) |
|-------------|----------------------------------|
| Row click | `openEvent(id)` → `select(id)` + `getObject(id)`; if `before`/`after` present → `setInspectorTab("movement")` |
| Inspector | `EvidencePanel` reads `selectedId` via `useOrvekObjectGraph()`; shows evidence/movement tabs for resolved `OrvekObject` |
| Reports | **No** direct `openReport()` from `TimelinePage`; reports open from Inspector (`openReport(obj.id)`) or other surfaces |
| Overlays | None from Timeline |
| Page handlers | `ReferencePageHandlersProvider` defines `timeline.onOpenItem` but **`TimelinePage` does not call `useOrvekPageHandlers()`** — handlers are unused at root |
| Filter / search | Local React state only (`filter`, `query`); not wired to provider |
| Production-only features missing at root | `TimelineInspectorAction`, `PublicLinkedObjectContinuity`, href navigation (`V0TimelineView` / `/timeline` route) |

### 4. Which production APIs/data sources already exist?

| Source | Fetch | API / builder |
|--------|-------|-------------|
| Activity stream (check-ins, journal, app sessions, imports) | `buildTimelineRequestUrl(window)` | `GET /api/timeline?window=…&includeAppActivity=true&includeJournalEntries=true` |
| Model movement layers | `buildTimelineModelLayersRequestUrl(window)` | `GET /api/timeline/model-layers?window=…` |
| Semantic overlays (fieldwork, investigations, decisions) | `fetchTimelineSemanticEntries(window)` | `GET /api/watch-for`, `GET /api/active-questions`, `GET /api/actions` |
| Adapter + production API | — | `mapTimelineDataToV0Props()` → `buildTimelineProductionDataApi()` |
| Wired reference implementation | — | `components/orvek-workbench/OrvekTimelinePage.tsx` (mirrors fetch pattern used for Map on `OrvekMapPage`) |

Stream merge: `buildTimelineStreamItems({ activity, modelLayers })` → grouped by London week buckets in adapter.

Production row ids: `activity-{entryId}` or `model-{modelUpdateId}` (not reference `t1`…`t14`).

### 5. Which production fields are display-ready for the reference Timeline?

| Field / projection | Ready? | Notes |
|--------------------|--------|-------|
| Group headings (`Today` … `Imported history`) | Yes | Adapter + `buildTimelineProductionDataApi` align with `TIMELINE_SHELL_GROUP_HEADINGS` |
| Row title (`eventLabel · title`) | Mostly | Chip labels from semantic enrichment are stable |
| Summary one-liner | Mostly | `userFacingSummary` / `entry.body` capped in journal preview at API layer (180 chars) |
| Lane colouring | Yes | Derived from semantic `lane` / model_change kind |
| Time/date formatting | Yes | Adapter formats London time + short date |
| Model-change `moved` badge | Yes | `model_change` rows flagged |
| Empty copy | Yes | `TIMELINE_ACTIVITY_EMPTY_COPY` |
| Inspector target metadata on objects | Partial | `inspectorObjectType` / `inspectorObjectId` set on production `OrvekObject`, but **root `TimelinePage` ignores them** — selects row id only |

### 6. Which production fields are raw, missing, stale, duplicated, or unsafe?

| Risk | Detail |
|------|--------|
| **Raw journal/check-in body** | `entry.body` / `entry.preview` can surface long capture text in row summary |
| **No presentation normalization layer** | Unlike Map, there is no `timeline-presentation.ts` / readiness gate |
| **Before/after contract mismatch** | Production model-change rows set `beforeSummary: null`, `afterSummary: userFacingSummary` only; reference `TimelinePage` expects paired `before`/`after` on `OrvekObject` and uses label **"After:"** not **"Updated understanding:"** |
| **Missing `date` on production objects** | `buildTimelineProductionDataApi` does not project `date`/`lastUpdated` onto `OrvekObject` — timestamp line may be blank in reference `TimelinePage` |
| **Missing `relatedIds` / `receiptIds`** | Production timeline-event objects lack reference richness; Inspector evidence tab may be thin |
| **Duplicate movement signal** | Same model update may appear as semantic activity + `model-{id}` layer row |
| **Filter label drift** | Production semantic filters (`All evolution`, `Mind model movement`, …) differ from reference `FILTERS` (`All`, `Model Updates`, …) — only applies if `displayContract === production` |
| **Href / route leakage** | Adapter rows may carry `/library/…`, `/watch-for/…`, `/actions` hrefs; `V0TimelineView` renders `<Link>`; reference `TimelinePage` does not expose hrefs (safe today) |
| **Loading partial stream** | `OrvekTimelinePage` can show production shell groups while activity/model/semantic loads are staggered |
| **`withProductionContract` on standalone builder** | Sets `displayContract: production` — must **not** propagate to hybrid root API (Map lesson) |

### 7. Does Timeline currently depend on mock/reference IDs that EvidencePanel can resolve?

**Yes.** Reference groups use zip ids (`t1`–`t14`, etc.) present in `lib/orvek-v0/orvek-data.ts`. `useOrvekObjectGraph()` resolves them via provider → zip fallback.

Reference events also link to other zip ids (`relatedIds`: `r6`, `d1`, `mu-1`, `rep-weekly`, …) resolvable in Inspector when user navigates related objects.

Production row ids (`activity-*`, `model-*`) are **not** in zip — they only resolve after hybrid merge puts them in `OrvekDataProvider`.

### 8. What would break if production Timeline IDs replaced reference IDs?

| Breakage | Cause |
|----------|--------|
| Inspector "Nothing selected" / thin panel | Row click selects `activity-*` id; if merge fails or object missing, zip fallback misses |
| Movement tab empty or wrong | `TimelinePage` uses row object's `before`/`after`, not `inspectorObjectId`; production model rows lack paired before/after on `OrvekObject` |
| Filter rail false negatives | Reference filter strings won't match production chip labels (`Check-in` vs `Receipts`) unless filters updated or normalized |
| Empty date column | Missing `date`/`lastUpdated` on production-projected objects |
| Visual density regression | Sparse real data vs rich reference narrative rows |
| Flash of empty groups | `isProduction` branch shows shell groups with `—` placeholders; hybrid must avoid flipping `displayContract` |
| False confidence from raw text | Long journal/import previews in summary slot |

### 9. What safety gate is needed before production Timeline data can enter root Timeline?

Mirror Map bridge pattern:

1. **`buildTimelineProductionDataApi()` raw builder** — keep as contract source (already exists).
2. **New `timeline-presentation.ts`** (or equivalent) with:
   - Title/summary length caps
   - Raw-text / error-pattern rejection (reuse Map patterns where applicable)
   - Before/after pair validation for movement rows (suppress identical/near-identical; require honest prior read or hide block)
   - Row-level presentation readiness (`isTimelineRowPresentationReady`)
   - Stream-level gate (`isTimelinePresentationReady`) — valid group structure, at least one ready row, not loading, no activity/model errors
3. **`shouldMergeTimelineProductionApi()`** — gate before hybrid merge.
4. **`normalizeTimelineProductionDataApi()`** — normalize on merge only.
5. **Hybrid rules**:
   - Do **not** set global `displayContract` on hybrid API.
   - Inject `timelineGroups`, `timelineFilters`, `timelineIsLoading`, `emptyCopyBySlot` only when gate passes.
   - Fallback to reference `GROUPS` / zip objects on fetch failure, empty stream, or gate failure.
6. **Inspector companion** (may be same slice or follow-up):
   - On row open, resolve `inspectorObjectId` when present (select inspector target, not only row id), matching `/timeline` route behaviour.
7. **No `/timeline` navigation** from root row interactions.

### 10. Smallest safe implementation slice after this audit

**Recommended phased slice (do not combine with Map/Today changes):**

#### Slice A — presentation contract + gate (no fetch)

- Add `lib/orvek-v0/production/timeline-presentation.ts`
- Add `normalizeTimelineProductionDataApi()` + `isTimelinePresentationReady()` + `shouldMergeTimelineProductionApi()`
- Extend `buildTimelineProductionDataApi` projection: `date`/`lastUpdated`, movement fields, inspector-friendly ids
- Tests: `timeline-presentation-readiness.test.ts` (mirror `map-presentation-readiness.test.ts`)

#### Slice B — hybrid merge only (no hook fetch yet)

- Extend `buildHybridWorkbenchDataApi()` with gated `mergeTimelineOverlay()` (no `displayContract`)
- Tests: hybrid merge preserves reference timeline when gate fails; merges when ready

#### Slice C — bounded fetch in `useOrvekHybridWorkbenchDataApi`

- Reuse fetch pattern from `OrvekTimelinePage.tsx` (activity + semantic + model layers)
- Gate + normalize on merge; mock fallback otherwise
- Tests: hook wiring, fallback, Today/Map untouched, shell quarantine

#### Slice D — Inspector row-open fix (small, may ship with C)

- Update `TimelinePage.openEvent` to prefer `inspectorObjectId` when row object carries `inspectorObjectType` (provider-backed), else `select(rowId)`
- Test: EvidencePanel resolves production model-update selection

**Do not** switch root to `V0TimelineView` or restore `TimelineSurface` in this bridge.

---

## Interaction risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Reference filter labels ≠ production chip text | Medium | Keep hybrid off `displayContract`; normalize filter matching or inject reference-compatible filter list |
| Inspector selects row id not inspector target | High | Slice D |
| Empty/sparse production stream replaces rich reference | Medium | Gate + fallback; never merge loading/error states |
| Movement before/after visual regression | Medium | Normalize movement pair or hide block when prior read unavailable |
| Route escape via href | Low at root | `TimelinePage` ignores hrefs today; do not add `Link` without product sign-off |
| Today/Map regression | High | Hybrid tests must assert Today + Map merge unchanged |
| Old shell resurrection | High | `shell-quarantine.test.ts` unchanged |

---

## Proposed minimal bridge plan

```
useOrvekHybridWorkbenchDataApi
  → fetch activity (/api/timeline)
  → fetch semantic entries (watch-for, active-questions, actions)
  → fetch model layers (/api/timeline/model-layers)
  → buildTimelineProductionDataApi(raw input)
  → shouldMergeTimelineProductionApi() ?
       yes → buildHybridWorkbenchDataApi(base, today, map, normalized timeline)
       no  → reference GROUPS + zip objects (current behaviour)
```

**Must remain mock / reference fallback:**

- Timeline when gate fails, fetch fails, or stream empty
- Decisions, Explore, overlays
- `createMockOrvekDataApi()` baseline for unwired slots

**Must not wire yet:**

- Navigation to `/timeline` or other production routes from root row clicks
- Global `displayContract: production` on hybrid API
- `ProductionInspectorBridge` at root
- Replacing `TimelinePage` with `V0TimelineView` or `TimelineSurface`

---

## Tests required before implementation

| Test file | Gap to add |
|-----------|------------|
| `lib/__tests__/timeline-presentation-readiness.test.ts` | **New** — normalization, gate, movement pair suppression |
| `lib/__tests__/hybrid-workbench-api.test.ts` | Timeline merge + fallback; Today/Map preserved |
| `lib/__tests__/evidence-panel-provider-lookup.test.ts` | Production timeline row → inspector resolution |
| `lib/__tests__/orvek-display-contract.test.ts` | Hybrid api must stay non-production |
| `lib/__tests__/shell-quarantine.test.ts` | No regression |
| `lib/__tests__/timeline-surface.test.ts` | Keep as API contract source |
| `lib/__tests__/inspector-surface-wiring.test.ts` | Inspector target fields remain wired |
| New or extend | Hook source asserts fetch fns, no `router.push('/timeline')` |

Suggested vitest slice (post-implementation):

```bash
npx vitest run \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/timeline-presentation-readiness.test.ts \
  lib/__tests__/timeline-surface.test.ts \
  lib/__tests__/evidence-panel-provider-lookup.test.ts \
  lib/__tests__/shell-quarantine.test.ts \
  lib/__tests__/orvek-v0-inversion.test.ts
```

---

## Product-owner visual check

**Required for implementation** (not for this audit).

Checklist:

- [ ] Root sidebar Timeline keeps reference layout (220px filter rail + stream, `lg:grid-cols-[220px_1fr]`)
- [ ] Reference filter labels remain unless explicitly migrated
- [ ] With live data passing gate: grouped stream populates; no raw overflow in summaries
- [ ] With empty/failed fetch: reference mock timeline (`t1`…`t14`) appears — no blank dead UI
- [ ] Model movement rows: honest before/after or suppressed block (no duplicate summary)
- [ ] Row click opens Inspector with synced title; movement tab when appropriate
- [ ] No navigation to `/timeline` or `/library/…` from root row clicks
- [ ] Today + Map unchanged
- [ ] No old production shell chrome

---

## Status

- **Audit only** — no runtime code changed
- **Not production-ready** — no Timeline bridge implemented
- **Recommendation: implement with Map-style gated hybrid merge** after Slice A presentation gate lands

## Next step

Implement Slice A (`timeline-presentation.ts` + readiness tests), then hybrid merge + bounded fetch following Map bridge receipts 03–05 pattern.
