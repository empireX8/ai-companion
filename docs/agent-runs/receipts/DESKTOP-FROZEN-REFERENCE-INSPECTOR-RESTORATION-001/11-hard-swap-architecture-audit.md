# 11 — Hard-swap architecture audit (no product edits)

Status: audit only
Date: 2026-07-18
Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`

## Verdict

**HARD SWAP BLOCKED — EXACT BLOCKERS IDENTIFIED**

Hypothesis confirmed: production remains a parallel presentation app. An immediate mount of `FrozenReferenceWorkbench` with a live adapter is **not** sufficient, because frozen pages bypass `OrvekDataApi` and hardcode fixture composition.

---

## Phase 1 — Proven active architecture (import/runtime)

### Production desktop root (authenticated app)

| Step | Proven path |
|---|---|
| Layout | `app/(root)/layout.tsx` → `AppShell` |
| Shell | `components/layout/AppShell.tsx` → `OrvekWorkbenchShell` |
| Active UI root | `components/orvek-workbench/OrvekWorkbenchShell.tsx` → `Workbench` from `components/orvek-v0/workbench.tsx` |
| Data | `useOrvekHybridWorkbenchDataApi()` → hybrid `OrvekDataApi` |
| Pages | `components/orvek-v0/workbench.tsx` `PageContent` imports **`@/components/orvek-v0/pages/*`** |
| Children | `OrvekWorkbenchShell` accepts route `children` then **`void children`** — route page React trees are not rendered |

Proven consequence: Next route files (`app/(root)/page.tsx` → `OrvekTodayPage`, etc.) still execute module/effects, but **visible desktop composition is entirely `orvek-v0` Workbench + parallel pages**, not the route child’s page tree.

### Reference desktop root (authority)

| Step | Proven path |
|---|---|
| Route | `app/dev/orvek-v0-reference/page.tsx` |
| Root | `FrozenReferenceWorkbench` |
| Pages | `components/orvek-v0-reference-frozen/pages/*` |
| Data | `createFrozenReferenceDataApi()` wrapping fixture `reference-data.ts` |
| No hybrid | Frozen workbench does **not** import `useOrvekHybridWorkbenchDataApi` |

### Per-surface map

| Surface | Active route file | Active visible component | Package | Data source | Selection / nav | Overlays | Production-only presentation | Reference equivalent | Can diverge with same data? |
|---|---|---|---|---|---|---|---|---|---|
| `/` Today | `app/(root)/page.tsx` → `OrvekTodayPage` (not painted) | `orvek-v0/pages/today.tsx` via Workbench | **parallel production** | hybrid `data.today` + `getObject` via provider | `useWorkbench().select` + production intent helpers | shared `Overlays` via workbench `reportId` | `isProduction` / `hasLiveTodayPresentation` branches, V0 today props, deferred actions | `orvek-v0-reference-frozen/pages/today.tsx` | **Yes** — different page file + different composition source |
| Map | `your-map/page.tsx` → `OrvekMapPage` (not painted) | `orvek-v0/pages/map.tsx` | parallel | hybrid map API fields | workbench select + map selected id | shared | production map loading/error/ontology branches | frozen `pages/map.tsx` | **Yes** |
| Decisions | `actions/page.tsx` → `OrvekDecisionsPage` (not painted) | `orvek-v0/pages/decisions.tsx` | parallel | hybrid decisions API | workbench select / setPage | shared | production decisions branches | frozen `pages/decisions.tsx` | **Yes** |
| Explore / Experiment / Investigations / AQ | `explore/page.tsx` → `OrvekExplorePage` (not painted) | `orvek-v0/pages/explore.tsx` | parallel | hybrid explore + chat handlers | workbench + live chat handlers | shared | large live-chat / tab production matrix | frozen `pages/explore.tsx` | **Yes** |
| Timeline | `timeline/page.tsx` → `OrvekTimelinePage` (not painted) | `orvek-v0/pages/timeline.tsx` | parallel | hybrid timeline groups | workbench select | shared | production timeline branches | frozen `pages/timeline.tsx` | **Yes** |
| Inspector | mounted inside both workbenches | `components/orvek-v0-authority/evidence-panel.tsx` (re-export) | **shared chrome** | provider + production MU composer when `isProductionDisplay` | workbench history / pushSelection / goBack | n/a (panel) | `composeProductionModelUpdateCanonicalViewModel`, sticky overlay, hydration gates | same file on reference (fixture objects only) | **Yes** — same component, different object graph + production MU compose branch |
| Report overlay | workbench state | `components/orvek-v0/overlays.tsx` `ReportOverlay` | shared overlay module | `getObject(reportId)` / live report fields | `openReport` | itself | production provenance / live report identity | same module with fixture `rep-weekly` | **Yes** if report object shape differs |

### Exact reason production remains a parallel app

1. Production mounts `components/orvek-v0/workbench.tsx`, which hard-imports `components/orvek-v0/pages/*`.
2. Reference mounts `components/orvek-v0-reference-frozen/workbench.tsx`, which hard-imports `components/orvek-v0-reference-frozen/pages/*`.
3. Those page trees are **different files** with different sizes and branches (e.g. Today ~929 vs ~359 lines).
4. Production feeds a hybrid/live `OrvekDataApi` into the parallel pages; reference pages mostly **do not read that API for composition**.
5. Sharing Sidebar/TopBar/EvidencePanel/Overlays is shell reuse, not page-authority reuse.

Hypothesis **proven**.

---

## Phase 2 — Reference data boundary

### How frozen Workbench receives state today

| Concern | Mechanism in frozen package |
|---|---|
| Today composition | **Hardcoded** in `pages/today.tsx` (`lead = getObject("d1")`, `NOW_ROWS`, `MOVEMENTS`, `RESURFACED`, copy strings) |
| Objects / receipts / related | Direct import `getObject` / `getObjects` from `reference-data.ts` in page files — **not** `useOrvekData()` |
| Movement cards | Hardcoded `MOVEMENTS` array in frozen Today |
| Reports | Hardcoded `openReport("rep-weekly")` |
| Selection / linked nav / Back | Shared `WorkbenchProvider` / `useWorkbench` (`select`, `pushSelection`, `goBack`, history+scroll) |
| Overlay state | Shared `openReport` / `reportId` → shared `Overlays` |
| Actions | Local UI state / workbench corrections; no durable production handlers |
| OrvekDataApi | Created by `createFrozenReferenceDataApi()` and provided to tree — used by shared Inspector/overlays graph lookup, **largely unused by frozen pages’ composition** |

### Fields / assumptions from mock fixtures

- Entire `OBJECTS` graph in `reference-data.ts`
- Fixed ids: `d1`, `mu-1`…, `r5`/`r6`, `rep-weekly`, map category id lists in frozen map page
- Explore grounding/movement constants
- No loading/error/empty live gates in frozen Today

### Existing boundary suitable for production

- `OrvekDataApi` (`lib/orvek-v0/data-provider.tsx`) already exists
- Shared store callbacks already suitable: `select`, `pushSelection`, `goBack`, `openReport`, `setPage`, `setOverlay`, corrections API
- Production already has fetch/hydration in `useOrvekHybridWorkbenchDataApi` and builders (`buildTodayProductionDataApi`, map/timeline/decisions/explore builders)
- Durable action refresh + explore send handlers exist on production shell

### Smallest adapter seam required (presentation-preserving)

Target:

```
live storage/APIs
  → auth/ownership/honesty fetchers (existing)
  → adapter emitting reference-compatible OrvekDataApi
     (getObject/getObjects graph + any composition inputs pages need)
  → FrozenReferenceWorkbench page components
  → shared Inspector/Overlays
```

**Required seam the frozen package does not currently provide:**

Frozen pages must resolve objects through the provider (`useOrvekData().getObject`) instead of importing fixture `getObject` from `reference-data.ts`.

Without that inversion, adapter injection cannot change what Today/Map/Decisions/Timeline/Explore paint.

Frozen Today additionally needs composition inputs (hero/lead id, now rows, movements, resurfaced ids, report id) to come from the API/adapter rather than module-local constants — **markup can stay**, wiring cannot stay fixture-hardcoded.

---

## Phase 3 — Hard-swap feasibility answers

1. **Can production mount the actual frozen-reference Workbench as active desktop root?**
   **Yes, mechanically** (replace `OrvekWorkbenchShell` → mount `FrozenReferenceWorkbench` or a thin production wrapper around it).
   **Not sufficient alone** for live correctness (see #2).

2. **Can live data be injected through an adapter without copying/rewriting reference pages?**
   **No, as the frozen pages are written today.** They bypass `OrvekDataApi` and hardcode Today composition.
   A **minimal data-access seam** (provider reads + composition ids from API) is required; that is not a visual rewrite, but it is a frozen-package dependency change (or a presentation-identical fork, which violates the hard-swap goal).

3. **Capabilities lost by an immediate naive swap**
   - Live Today/Map/Explore/Timeline/Decisions content (pages still fixture)
   - Live explore chat send/boot
   - Durable corrections / outcome / fieldwork persistence refresh
   - Production route URL sync (`RoutePageSync`) unless reattached
   - Live report identity (`rep-weekly` hardcoded)
   - Auth-gated empty/loading honesty currently in parallel pages
   - `ProductionInspectorBridge` selection sync behaviors unless reattached

4. **Capabilities preservable behind callbacks/adapters**
   - Object graph via `getObject`/`getObjects`
   - Explore messages + send handler via page handlers / API fields
   - Durable write refresh via existing durable-actions context
   - Report open via `openReport(liveId)` if composition uses adapter report id
   - Auth ownership in fetchers before adapter emit
   - Loading/error/unavailable as API flags consumed by pages after seam

5. **Mock assumptions that genuinely block live operation**
   - Direct fixture imports in frozen pages
   - Hardcoded `d1` / `NOW_ROWS` / `MOVEMENTS` / `RESURFACED` / `rep-weekly`
   - Non-null assertions `getObject(id)!` when live ids missing
   - Fixed map/timeline id lists authored in frozen pages
   - Explore sample grounding when no live chat

6. **Smallest dependency-ordered hard-swap plan** (implement later; not now)

   1. **Provider inversion seam** in frozen pages: object reads via `useOrvekData` (presentation JSX unchanged).
   2. **Composition inputs seam** for frozen Today (and analogous list ids for Map/Timeline/Decisions/Explore) sourced from adapter fields, not constants.
   3. **Production live adapter** emitting reference-compatible graph + composition inputs (reuse existing fetchers; stop feeding parallel page branches).
   4. **Production root swap**: `AppShell` / `OrvekWorkbenchShell` mounts frozen workbench (or wrapper) with live adapter + route sync + durable/explore handlers.
   5. **Inspector**: remove production-only MU visual compose branch once graph already matches reference contract; keep fetch/auth only.
   6. **Quarantine** parallel `components/orvek-v0/pages/*` and route `Orvek*Page` wrappers from active path.
   7. **Path-equivalence tests** (Phase 4).

7. **Parallel components that become inactive after swap**

   - `components/orvek-v0/workbench.tsx` as production root (or reduced to unused)
   - `components/orvek-v0/pages/today.tsx`
   - `components/orvek-v0/pages/map.tsx`
   - `components/orvek-v0/pages/decisions.tsx`
   - `components/orvek-v0/pages/timeline.tsx`
   - `components/orvek-v0/pages/explore.tsx`
   - `components/orvek-v0/pages/what-changed.tsx` (if unused by frozen)
   - `components/orvek-workbench/OrvekTodayPage.tsx` / `OrvekMapPage.tsx` / `OrvekDecisionsPage.tsx` / `OrvekTimelinePage.tsx` / `OrvekExplorePage.tsx` as visible composers
   - Hybrid merge path used only to feed parallel pages (`buildHybridWorkbenchDataApi` consumer role changes)
   - Production-only presentation branches inside parallel pages
   - Production MU presentation composer path inside EvidencePanel (after graph contract is right)

   Remain active: frozen pages/workbench, shared shell chrome modules, overlays, store, durable/auth/fetch adapters, live APIs.

---

## Phase 4 — Regression test standard (design only)

For matched reference vs production states, assert:

| Assertion | Meaning |
|---|---|
| Same active page component family | Production imports/mounts `orvek-v0-reference-frozen/pages/<page>` (or identical module), not `orvek-v0/pages/<page>` |
| Same selected-object presentation branch | Same Inspector component + same field presence pattern for object type (e.g. MU: title/summary/whyItMatters/receipts/before-after/related; no extra packet dump sections unless reference object has them) |
| Same section order | DOM order of section labels matches frozen page/Inspector for that state |
| Same click destination type | Click handler resolves to same workbench action class (`select` / `pushSelection` / `openReport` / `setPage`) |
| Same linked-object path | Linked id resolves through same graph getObject path; destination type matches reference relationship |
| Same Back behaviour | History stack restores id, tab, scroll |
| Same overlay path | Report open/close via workbench `reportId` + shared `Overlays` |
| Same page transitions | Nav targets map to same workbench page ids |
| Allowed diffs | Truthful live strings, missing live nodes → reference empty/unavailable treatment, auth gating |

Source tests should fail if production still imports `@/components/orvek-v0/pages/*` from the active shell.

---

## Production capabilities requiring preservation

- Clerk auth / ownership on fetches
- Live Today / Map / Timeline / Decisions / Explore data loading
- Free Explore chat session boot + send
- Durable corrections / outcomes / fieldwork check-in + refresh
- Live movement report open by real ModelUpdate id
- Honest loading / empty / unavailable
- URL ↔ page sync for `/`, `/your-map`, `/actions`, `/timeline`, `/explore`
- Inspector Back + scroll continuity

## Final verdict

**HARD SWAP BLOCKED — EXACT BLOCKERS IDENTIFIED**

Primary blockers:
1. Frozen pages import fixture `getObject` directly; adapter cannot drive them.
2. Frozen Today hardcodes composition (`d1`, NOW, movements, resurfaced, `rep-weekly`).
3. Production root still mounts parallel `orvek-v0/pages/*` via `orvek-v0/workbench.tsx`.

Unblock requires the dependency-ordered plan above before any visual-parity claims.
