# 00 Experiment Production Data Parity Bridge — Audit

## Branch context

- Branch audited: `desktop-experiment-production-data-parity-bridge-001`
- Base: `staging` after #88 merge (Decisions bounded fetch bridge landed)
- Today, Map, Timeline, and Decisions production parity bridges are live in root workbench via `useOrvekHybridWorkbenchDataApi`
- Explore / experiment-loop surfaces remain on `createMockOrvekDataApi()` zip baseline with hardcoded reference tab content

## Critical finding: no root nav item named “Experiment”

The hard-swapped workbench sidebar exposes five pages only: **Today, Map, Decisions, Timeline, Explore**.

Product language maps **Experiment / Fieldwork / small experiments** to observation-and-test loops, but the accepted reference UI for that loop lives **inside Explore**, not as a standalone root page.

---

## Active root Experiment path

Production root “Experiment” parity is **not** `/watch-for`, `/active-questions`, or a dedicated Experiment route. It is the **Explore** page switch plus its experiment-loop tabs:

```
app/(root)/layout.tsx
  → AppShell
  → OrvekWorkbenchShell
  → Workbench (components/orvek-v0/workbench.tsx)
  → WorkbenchProvider + OrvekDataProvider(useOrvekHybridWorkbenchDataApi)
  → OrvekShellLayout
  → Sidebar page switch
  → PageContent case "explore"
  → ExplorePage (components/orvek-v0/pages/explore.tsx)
  → EvidencePanel (components/orvek-v0/evidence-panel.tsx)
```

Within `ExplorePage`, experiment-loop reference surfaces are tab components:

| Tab id | UI label | Component | Reference role |
|--------|----------|-----------|----------------|
| `fieldwork` | **Fieldwork Bridge** | `FieldworkBridge` | Primary “experiment / field test” framing |
| `investigations` | **Investigations** | `Investigations` | Investigation threads |
| `questions` | **Active Questions** | `Questions` | Open-question inquiry workspace |
| `free` | Free Explore | `FreeExplore` | Chat + grounding + movement (separate bridge scope) |

Parallel legacy production routes (not active at root sidebar switch):

```
app/(root)/(routes)/explore/page.tsx
  → OrvekExplorePage
  → OrvekV0PageShell + ProductionInspectorBridge
  → ExplorePage (same reference component; chat wired, tabs empty)

app/(root)/(routes)/watch-for/page.tsx
  → legacy Fieldwork / “Watch For” list page (AppShell + WatchForItemCard)

app/(root)/(routes)/active-questions/page.tsx
  → legacy Active Questions list/detail pages
```

Quarantined alternate production view (not used by root path):

```
components/orvek-workbench/views/V0ExploreView.tsx
```

The accepted reference experiment-loop UI is **`components/orvek-v0/pages/explore.tsx`**. Do not restore `V0ExploreView`, old `/watch-for` shell chrome, or route-first navigation from root interactions.

---

## Internal naming map

| Term | Where it appears | Meaning in repo |
|------|------------------|-----------------|
| **Experiment** (product) | docs, trust copy (`small experiment`), action feedback | Observation/test loop that updates the model — not a root page id |
| **Fieldwork Bridge** | Explore tab label | Reference experiment framing panel + link to zip fieldwork object `f2` |
| **Fieldwork** | `/watch-for` page title, `OrvekObject.type: "fieldwork"`, `WatchForItem` | Production fieldwork assignments (`FieldworkAssignment`) |
| **Watch For** | `/watch-for` eyebrow, API `/api/watch-for` | Same production fieldwork list, legacy route naming |
| **Investigations** | Explore tab, zip `inv-*`, `/api/investigations` | Reference investigation threads; full investigation API exists but is not wired to Explore tabs |
| **Active Questions** | Explore tab, zip `aq-*`, `/api/active-questions` | Public-safe **Investigation** rows filtered to active-question statuses |
| **Investigate** | Not a root nav label | Used in copy (“Ask, investigate…”) only |
| **Actions / Decisions** | `/actions`, Decisions page | Choice tracking — **already bridged**; product “small experiment” language overlaps but is a separate surface |

**Naming collision to respect in bridge design:** `/api/active-questions` returns `Investigation` DB rows, while reference Explore treats **Investigations** (`inv-*`) and **Active Questions** (`aq-*`) as distinct tab contracts.

---

## Audit answers

### 1. What component renders the root Experiment surface?

There is **no standalone root Experiment component**.

The experiment-loop reference surfaces render inside **`ExplorePage`** (`components/orvek-v0/pages/explore.tsx`):

- **Primary experiment/fieldwork surface:** `FieldworkBridge` tab
- **Related loop surfaces:** `Investigations`, `Questions` tabs on the same page

Data comes from `useOrvekData()` → `useOrvekHybridWorkbenchDataApi()` → `createMockOrvekDataApi()` zip graph. Explore production overlay is **not** merged in the hybrid hook today.

### 2. Is the page called Experiment, Investigate, Fieldwork, Open Questions, or something else internally?

| Layer | Name |
|-------|------|
| Root nav | **Explore** (`OrvekPage: "explore"`) |
| Reference tab (experiment) | **Fieldwork Bridge** |
| Reference tab (threads) | **Investigations** |
| Reference tab (inquiries) | **Active Questions** |
| Legacy route (fieldwork list) | **Fieldwork** / **Watch For** (`/watch-for`) |
| Legacy route (questions list) | **Active Questions** (`/active-questions`) |
| Product/docs | **Experiment**, **small experiment**, **fieldwork** |

Internal code ids: `fieldwork`, `investigations`, `questions`, `free` (Explore tabs).

### 3. What reference/mock data shape does Experiment expect?

#### Fieldwork Bridge tab (reference-only hardcoding today)

When `!isProductionDisplay(data)`, `FieldworkBridge` renders **hardcoded copy** and does **not** read `exploreFieldworkIds` (field does not exist on `OrvekDataApi`):

- Title narrative: “Generate v0 architecture prototype…”
- Static field rows: Expected signal, What to observe, What would confirm/weaken, Due/review window
- CTA `Open fieldwork` → `select("f2")`
- CTA `Linked question` → `select("aq-2")`

Rich zip fieldwork objects (`f1`, `f2`) in `lib/orvek-v0/orvek-data.ts`:

| Field | Usage |
|-------|--------|
| `id`, `type: "fieldwork"` | Selection + Inspector |
| `title` | Headline |
| `purpose`, `expectedSignal`, `whatToObserve` | Workspace + Inspector |
| `confirmIf`, `weakenIf` | Calibration block |
| `reviewWindow`, `resultHistory` | Timing / history |
| `relatedIds`, `contextIds`, `receiptIds` | Linked chips |
| `tags`, `evidenceCount`, `lastUpdated` | List meta |

#### Investigations tab

Fallback ids when `exploreInvestigationIds` empty / non-production: `inv-1`, `inv-2`, `inv-3`.

Per-object fields: `title`, `whyItMatters`, `hypotheses[]`, `missingEvidence[]`, `relatedIds[]`, `receiptIds[]`, `contextIds[]`, `status`, `evidenceCount`.

#### Active Questions tab

Fallback ids: `aq-1` … `aq-4`.

Per-object fields: `title`, `whyItMatters`, `supporting[]`, `conflicting[]`, `relatedIds[]`, `receiptIds[]`, `status`, `evidenceCount`.

#### OrvekDataApi Explore fields (partial)

- `exploreGrounding: string[]` — mock `EXPLORE_GROUNDING`
- `exploreMovement: ExploreMovement[]` — mock movement cards for Free Explore inspector
- `exploreQuestionIds?: string[]` — production path (empty in builder today)
- `exploreInvestigationIds?: string[]` — production path (empty in builder today)
- `exploreMessages`, `exploreLiveDetectionCopy`, `explore`, `emptyCopyBySlot` — Free Explore / production chat
- **Missing:** `exploreFieldworkIds`, selected fieldwork id, fieldwork header stats

`createMockOrvekDataApi()` does not set question/investigation id arrays — tabs use hardcoded reference id lists.

### 4. What interactions does Experiment have with Inspector, selected objects, overlays, reports, Explore, or page state?

| Interaction | Behaviour (reference root) |
|-------------|----------------------------|
| Fieldwork Bridge → Open fieldwork | `select("f2")` — Inspector shows fieldwork blocks + local check-in UI |
| Fieldwork Bridge → Linked question | `select("aq-2")` |
| Investigations / Questions list click | `select(id)` on thread/question object |
| Related object chips | `select(relatedId)` |
| Questions → See evidence | `select(activeId)` + `setInspectorTab("evidence")` |
| Free Explore grounding chips | `select(chipId)` |
| Free Explore movement CTA | `setInspectorTab("movement")` |
| Explore mount | `setExploreActive(true)` — Inspector shows possible movement rail |
| Production branch | Entry CTAs disabled via `ORVEK_DEFERRED_ACTION_CLASS`; empty skeletons when lists empty |
| Page handlers | `ReferencePageHandlersProvider` defines `explore.*`; Free Explore uses `useOrvekPageHandlers()` when wired |
| Reports | No direct report overlay from Fieldwork Bridge; investigations copy mentions “Possible report” (deferred in production) |
| Route navigation | Reference CTAs use `select(id)` only — no `/watch-for` push at root |

`EvidencePanel` renders `fieldwork`, `investigation`, and `active-question` type blocks (purpose, hypotheses, missing evidence, check-in textarea for fieldwork).

### 5. Which production APIs/data sources already exist?

| Source | Fetch / API | Current builder / adapter |
|--------|-------------|---------------------------|
| Fieldwork assignments (Watch For) | `GET /api/watch-for` | Used by Today reentry + `/watch-for` page; `mapWatchForToExploreFieldwork()` in `lib/orvek-adapters/explore.ts` |
| Fieldwork detail / update | `GET/PATCH /api/fieldwork`, `/api/fieldwork/[id]` | Detail routes; not wired to Explore tabs |
| Active questions (public investigations) | `GET /api/active-questions`, `/api/active-questions/[id]` | Used by Today reentry; `mapActiveQuestionsToExploreQuestions()` |
| Investigations (full) | `GET/POST /api/investigations`, `/api/investigations/[id]` | Understanding-engine API — **not** mapped into reference Explore tabs today |
| Action → fieldwork draft | `POST /api/fieldwork` via `createFieldworkFromAction()` | Decisions/Actions handoff only |
| Today reentry bundle | `fetchTodayReentrySnapshot()` | Already fetches watch-for + active-questions for Today bridge |
| Explore production API | `buildExploreProductionDataApi()` | Sets `exploreQuestionIds: []`, `exploreInvestigationIds: []`; **no fieldwork ids** |
| Wired legacy route | `OrvekExplorePage` | Chat wired; investigations/questions/fieldwork items passed as **empty arrays** |

**Not wired into root hybrid hook:** no Explore/fieldwork/investigation/question fetch or merge.

### 6. Which production fields are display-ready for the reference Experiment surface?

| Surface | Ready fields |
|---------|--------------|
| Fieldwork list (`WatchForItem`) | `id`, `prompt` (as title), `reason`, `statusLabel`, `linkedObjectHref` |
| Active question list (`ActiveQuestionItem`) | `id`, `title`, `organizingQuestion`, `statusLabel`, timestamps |
| Today reentry (hero/attention rows) | Summarized fieldwork + investigation cards already normalized for Today |

### 7. Which production fields are raw, missing, stale, duplicated, or unsafe?

| Risk | Detail |
|------|--------|
| **Fieldwork Bridge not list-driven** | Reference tab ignores production lists entirely; swapping ids without rebuilding tab contract collapses UX |
| **Thin fieldwork vs rich `f2`** | Watch For list items lack `purpose`, `expectedSignal`, `whatToObserve`, `confirmIf`, `weakenIf`, `reviewWindow` — reference Fieldwork Bridge and Inspector expect these |
| **Investigations vs Active Questions split** | Production active-questions API returns Investigation rows; reference has separate `inv-*` and `aq-*` graphs with different workspace fields |
| **No public investigation list for Explore Investigations tab** | `/api/investigations` is understanding-engine scoped; Explore production builder passes empty investigation items |
| **Empty production tab arrays** | `OrvekExplorePage` and `buildExploreProductionDataApi()` zero out tab lists → production Explore tabs show skeletons only |
| **`displayContract: production` on explore builder** | Must not leak to hybrid root API (disables reference CTAs, forces skeletons) |
| **Legacy `/watch-for` layout drift** | Grouped list + `WatchForItemCard` ≠ reference Fieldwork Bridge single-card layout |
| **`V0ExploreView` handoff** | Adapter handoff links to `/actions?bucket=` — bucket-tab assumption quarantined from root |
| **Linked object resolution** | Production fieldwork has `linkedObjectType/Id` but reference `relatedIds` graph is zip-only |
| **Inspector check-in** | Reference fieldwork check-in is local UI theater — production PATCH flows must not fake saved receipts |
| **Duplicate semantics** | Same Investigation row could appear as both “investigation” and “active question” if both tabs merge naively |
| **Free Explore chat** | Separate large bridge; out of scope for fieldwork-first experiment slice |

### 8. Does Experiment currently depend on mock/reference IDs that EvidencePanel can resolve?

**Yes.**

| Tab | Reference ids | Nested lookups |
|-----|---------------|----------------|
| Fieldwork Bridge | `f2`, `aq-2` | Zip fieldwork + active-question objects |
| Investigations | `inv-1`, `inv-2`, `inv-3` | `relatedIds`: `d1`, `f2`, `m-loop-1`, …; `receiptIds`, `contextIds` |
| Active Questions | `aq-1` … `aq-4` | `relatedIds`, `receiptIds`; `supporting` / `conflicting` bullets |

Production UUIDs from `/api/watch-for` or `/api/active-questions` are **not** in zip — they only resolve after hybrid merge registers `OrvekObject` projections + linked aliases.

### 9. What would break if production Experiment IDs replaced reference IDs?

| Breakage | Cause |
|----------|--------|
| Fieldwork Bridge rich panel empty | Tab is hardcoded; production list not consumed |
| Investigations/Questions workspace collapse | Missing `hypotheses`, `missingEvidence`, `supporting`, `conflicting` on thin list projections |
| Inspector empty / wrong type | UUID ids not in provider; linked chips miss zip targets |
| False empty UX | `isProduction` + empty `explore*Ids` → skeleton panels and disabled CTAs |
| Tab semantic cross-wiring | Mapping active-questions into Investigations tab (or vice versa) breaks reference labels |
| Movement / grounding drift | Free Explore still on zip grounding ids if experiment tabs merge without alias registration |
| Route leakage | Using `mapWatchForToExploreFieldwork()` `href: /watch-for/${id}` in root would violate no-old-shell rule |

### 10. What safety gate is needed before production Experiment data can enter the root Experiment surface?

Mirror Decisions/Map/Timeline pattern — likely **`lib/orvek-v0/production/experiment-presentation.ts`** (or split `fieldwork-presentation.ts` + `explore-questions-presentation.ts`) with:

1. **Normalization**
   - Title/prompt/reason caps; raw-text rejection
   - Fieldwork: map `prompt` → title, `reason` → purpose/summary; honest empty slots for confirm/weaken/observe when absent
   - Active questions: map `organizingQuestion` → summary/whyItMatters; do not fabricate supporting/conflicting bullets
   - Tag normalization (`Fieldwork`, `Active Question`, `Investigation`)
   - Linked-object alias registration when `linkedObjectType/Id` verified
   - Duplicate summary/recommendation suppression where applicable

2. **Readiness gate**
   - `isExperimentPresentationReady()` / `shouldMergeExperimentProductionApi()` per tab or per merged explore overlay
   - Valid list min row count per enabled tab
   - Reject when required title/summary missing
   - Reject duplicate rows across tabs
   - Reject when linked receipts/context cannot resolve safely
   - Reject `displayContract: production` on hybrid API
   - Reject merge if Fieldwork Bridge reference layout would be replaced by legacy Watch For grouped list chrome

3. **Hybrid rules**
   - Do **not** set global `displayContract`
   - Merge only `explore*Ids`, `getObject`/`getObjects`, and tab empty copy when gate passes
   - Fallback to reference hardcoded Fieldwork Bridge + `inv-*` / `aq-*` lists on failure
   - Do **not** wire Free Explore chat in the same slice unless explicitly scoped

4. **Inspector companion**
   - `resolveExperimentOpenSelectionId()` for linked fieldwork/question/investigation targets
   - Preserve reference `select(id)` for row selection when no safe inspector alias

### 11. What is the smallest safe implementation slice after this audit?

**Recommended phased slices (do not combine with Today/Map/Timeline/Decisions changes):**

#### Slice A — fieldwork/experiment presentation gate (no fetch)

- Add `experiment-presentation.ts` (or `fieldwork-presentation.ts`) + tests
- Add `buildExperimentProductionDataApi()` projecting `/api/watch-for` items → `OrvekObject` fieldwork graph + optional `exploreFieldworkIds`
- Extend `OrvekDataApi` with `exploreFieldworkIds` / `exploreFieldworkSelectedId` if needed

#### Slice B — hybrid overlay merge only (no hook fetch)

- `mergeExperimentOverlay()` or extend `mergeExploreOverlay()` in `hybrid-workbench-api.ts`
- Gate Fieldwork Bridge data only first (smallest experiment surface)

#### Slice C — bounded fetch in `useOrvekHybridWorkbenchDataApi`

- Fetch `GET /api/watch-for` (and optionally `/api/active-questions` for Questions tab in a follow-on slice)
- Pass gated overlay; mock fallback otherwise

#### Slice D — `ExplorePage` / `FieldworkBridge` alignment (minimal)

- Drive Fieldwork Bridge from merged fieldwork object when gate passes; keep hardcoded reference when not
- Inspector target resolution for linked question/fieldwork ids
- **Do not** switch to `V0ExploreView` or `/watch-for` navigation

**Defer to later slices:** Investigations tab public source, Free Explore chat production merge, `/api/investigations` wiring, action→fieldwork write flows.

---

## Interaction risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fieldwork Bridge replaced by legacy Watch For list layout | **High** | Gate + keep reference tab layout; merge objects only |
| Thin watch-for rows collapse rich `f2` workspace | **High** | Readiness gate + honest empty copy slots |
| Active Questions vs Investigations semantic cross-merge | **High** | Separate id arrays; never dedupe across tabs without contract |
| `displayContract: production` disables reference CTAs | **High** | Never set on hybrid API |
| Linked object chips miss provider graph | Medium | Alias registration from verified linked targets |
| Free Explore chat scope creep | Medium | Keep experiment bridge separate from chat slice |
| Decisions/Today regression | High | Hybrid tests assert other merges unchanged |
| Old shell resurrection (`/watch-for`, `V0ExploreView`) | High | `shell-quarantine.test.ts` unchanged |

---

## Proposed minimal bridge plan

```
useOrvekHybridWorkbenchDataApi
  → fetch GET /api/watch-for                    // Slice C — fieldwork first
  → (optional later) fetch GET /api/active-questions  // Questions tab
  → buildExperimentProductionDataApi(items)
  → shouldMergeExperimentProductionApi() ?
       yes → buildHybridWorkbenchDataApi(..., experimentExploreApi)
       no  → reference FieldworkBridge hardcoded + inv/aq fallback lists
```

**Must remain mock / reference fallback:**

- Fieldwork Bridge narrative when gate fails or fetch empty
- Investigations + Questions tabs on reference ids until their gates exist
- Free Explore chat, grounding, movement on zip baseline until scoped
- `createMockOrvekDataApi()` for unwired slots

**Must not wire yet:**

- Navigation to `/watch-for` or `/active-questions` from root clicks
- `V0ExploreView` or old AppShell fieldwork pages
- Global `displayContract: production` on hybrid API
- `/api/investigations` bulk merge without public-safe filter
- Free Explore production chat in experiment slice

---

## Tests required before implementation

| Test file | Gap to add |
|-----------|------------|
| `lib/__tests__/experiment-presentation-readiness.test.ts` | **New** — fieldwork normalization, gate, linked alias, duplicate suppression |
| `lib/__tests__/hybrid-workbench-api.test.ts` | Experiment merge + fallback; Today/Map/Timeline/Decisions preserved |
| `lib/__tests__/explore-surface.test.ts` or extend existing | Fieldwork Bridge contract source |
| `lib/__tests__/evidence-panel-provider-lookup.test.ts` | Production fieldwork id + linked object resolution |
| `lib/__tests__/shell-quarantine.test.ts` | No old shell regression |
| New: `experiment-hybrid-fetch.test.ts` | Hook wiring; no `router.push('/watch-for')` |

Suggested vitest slice (post-implementation):

```bash
npx vitest run \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/experiment-presentation-readiness.test.ts \
  lib/__tests__/experiment-hybrid-fetch.test.ts \
  lib/__tests__/evidence-panel-provider-lookup.test.ts \
  lib/__tests__/shell-quarantine.test.ts \
  lib/__tests__/orvek-v0-inversion.test.ts
```

---

## Product-owner visual check

**Required for implementation** (not for this audit).

Checklist:

- [ ] Root sidebar still shows **Explore** (no new Experiment nav item unless product explicitly adds one)
- [ ] Fieldwork Bridge tab keeps reference single-card layout (not legacy Watch For grouped list)
- [ ] With live data passing gate: fieldwork framing shows honest fields only (no fabricated confirm/weaken grid)
- [ ] With empty/failed fetch: reference Fieldwork Bridge + `f2` richness appears
- [ ] Investigations / Active Questions tabs remain reference-rich until their slices land
- [ ] Linked chips open Inspector when aliases resolve
- [ ] No navigation to `/watch-for` or `/active-questions` from root interactions
- [ ] Today + Map + Timeline + Decisions unchanged
- [ ] No old production shell chrome

---

## Status

- **Audit only** — no runtime code changed
- **Not production-ready** — no Experiment bridge implemented
- **Recommendation:** start with **Fieldwork Bridge / watch-for gated hybrid merge** (Slice A→D), then Active Questions tab, then Investigations tab after public list contract is settled

## Next step

Implement Slice A (`experiment-presentation.ts` or `fieldwork-presentation.ts` + readiness tests), following Decisions receipts 01–03 pattern. Clarify with product whether “Experiment” officially means **Fieldwork Bridge tab only** or all three Explore experiment-loop tabs — audit treats **Fieldwork Bridge as primary**, Questions/Investigations as related follow-ons.
