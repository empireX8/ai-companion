# 00 Reference Route Integrity Audit

**Slice:** `DESKTOP-REFERENCE-INTEGRITY-AUDIT-001`  
**Branch audited:** `staging` (post Free Explore read-only bridge merge, PR #92)  
**Mode:** Audit only — no runtime changes

---

## Executive summary

Product-owner concern is **valid for visual baseline**, **not for production data leakage**.

`/dev/orvek-v0-reference` is **data-isolated** (mock API only, no hybrid fetch hooks) but **not visually frozen**. It mounts the same live `components/orvek-v0/workbench.tsx` tree and the same page components — including `components/orvek-v0/pages/explore.tsx` — as the hard-swapped root app. Every bridge slice that edits shared v0 presentation code changes **both** routes on hot reload.

The route can still be trusted as a **mock-data reference**. It cannot be trusted as a **immutable golden visual baseline** without additional quarantine.

---

## 1. What route renders `/dev/orvek-v0-reference`?

| Layer | File |
|-------|------|
| Route entry | `app/dev/orvek-v0-reference/page.tsx` |
| Layout | `app/dev/layout.tsx` (pass-through) |
| Mounted component | `<Workbench />` from `components/orvek-v0/workbench.tsx` |
| Middleware allowlist | `middleware.ts` includes `/dev/orvek-v0-reference` |

```tsx
// app/dev/orvek-v0-reference/page.tsx
export default function OrvekV0ReferencePage() {
  return (
    <div data-testid="orvek-v0-reference-route">
      <Workbench />
    </div>
  );
}
```

**Root contrast:**

| Layer | File |
|-------|------|
| Route entry | `app/(root)/layout.tsx` → `components/layout/AppShell.tsx` |
| Shell | `components/orvek-workbench/OrvekWorkbenchShell.tsx` |
| Data hook | `useOrvekHybridWorkbenchDataApi()` |
| Mounted component | `<Workbench dataApi={dataApi} />` |

---

## 2. Does `/dev/orvek-v0-reference` use `createMockOrvekDataApi()` only?

**Yes.**

`Workbench` defaults to mock when no `dataApi` prop is passed:

```tsx
// components/orvek-v0/workbench.tsx
export function Workbench({ dataApi }: { dataApi?: OrvekDataApi } = {}) {
  const mockApi = useMemo(() => createMockOrvekDataApi(), []);
  const api = dataApi ?? mockApi;
  return (
    <OrvekDataProvider value={api}>
      ...
    </OrvekDataProvider>
  );
}
```

The dev reference page does **not** pass `dataApi`, so it always uses `createMockOrvekDataApi()`.

Mock API shape (relevant fields):

- Sets: `exploreGrounding`, `exploreMovement`, `exploreLiveDetectionCopy`, zip-backed `getObject` / `getObjects`
- Does **not** set: `displayContract`, `exploreQuestionIds`, `exploreInvestigationIds`, `exploreFieldworkIds`, `freeExploreChatSessionId`, `exploreMessages`, `today`, production map/timeline/decisions overlays

---

## 3. Does `/dev/orvek-v0-reference` call hybrid or production fetch hooks?

**No.**

| Hook / fetch | Reference route | Root app |
|--------------|-----------------|----------|
| `useOrvekHybridWorkbenchDataApi` | Not imported | Used in `OrvekWorkbenchShell` |
| `useOrvekExploreChat` | Not used | Used inside hybrid hook |
| `fetchTodayReentrySnapshot`, map/timeline/decisions fetches | Not used | Used inside hybrid hook |
| `OrvekPageHandlersProvider` | Not mounted | Not mounted at root (send still disabled) |

Reference route has **zero network fetch wiring** in its render path.

---

## 4. Does reference import the same `explore.tsx` as root?

**Yes — identical module.**

Both paths resolve to:

`components/orvek-v0/pages/explore.tsx`

Reference: `Workbench` → `PageContent` → `<ExplorePage />`  
Root: `OrvekWorkbenchShell` → `Workbench dataApi={hybrid}` → `<ExplorePage />`

Explore tab shell (segmented control, four tabs) is structurally the same as the accepted snapshot in `.reference/v0-orvek-workbench/components/orvek/pages/explore.tsx`. Tab **content** inside `FreeExplore`, `Questions`, `Investigations`, and `FieldworkBridge` has diverged significantly on the live file due to production-parity bridge work.

---

## 5. Which recent bridge slices changed shared reference presentation?

Commits touching `components/orvek-v0/pages/explore.tsx` on `staging`:

| Commit | Slice | Shared impact |
|--------|-------|---------------|
| `f99eb36` | Free Explore read-only tab alignment | `FreeExplore`: `hasLiveExploreChatFromProvider`, live/reference transcript branch, composer gating, live-detection/movement copy split |
| `fdc2d4b` | Investigations tab alignment | `Investigations`: `hasLiveInvestigations`, production id lists, deferred actions |
| `196e481` | Active Questions tab alignment | `Questions`: `hasLiveQuestions`, production id lists, deferred actions |
| `7c77057` | Fieldwork Bridge alignment | `FieldworkBridge`: `hasLiveFieldwork`, production fieldwork ids |

Other surfaces share the same pattern via live page files (not explore-specific):

- Today, Map, Timeline, Decisions bridges edited `components/orvek-v0/pages/{today,map,timeline,decisions}.tsx`
- Shared shell: `components/orvek-v0/workbench.tsx`, `evidence-panel.tsx`, `sidebar.tsx`, `top-bar.tsx`

All of these are imported by **both** reference and root Workbench.

---

## 6. Production data leaking into reference, or only shared presentation?

| Leak type | Verdict | Evidence |
|-----------|---------|----------|
| **Production API / session data** | **No leak** | Reference never mounts hybrid hook; mock API lacks production ids/session fields |
| **Live Explore chat transcript** | **No leak** | `hasLiveExploreChatFromProvider(mock)` is false (no session id, no `exploreMessages`) |
| **Active Questions / Investigations / Fieldwork live lists** | **No leak** | Mock lacks `exploreQuestionIds`, `exploreInvestigationIds`, `exploreFieldworkIds` → `hasLive*` false → reference fixtures |
| **Shared presentation / layout changes** | **Yes — co-mutates** | Same React components; bridge edits hot-reload on both URLs |

Product-owner observation (“reference updates alongside root”) is explained by **shared component coupling**, not data synchronization.

---

## 7. Can `/dev/orvek-v0-reference` still be trusted as a **data** reference?

**Mostly yes, with caveats.**

| Trust | Status |
|-------|--------|
| Mock zip objects via `getObject` | Stable baseline |
| No production fetch side effects | True today |
| `hasLive*` gates on reference | Correctly stay false with current mock shape |

**Caveats:**

1. `createMockOrvekDataApi()` is a living file — adding production-shaped fields to mock would accidentally activate live-mode UI branches on reference.
2. Mock is not version-pinned; it evolves with the repo.
3. A frozen copy exists at `.reference/v0-orvek-workbench/` but the dev route does **not** mount it.

---

## 8. Can `/dev/orvek-v0-reference` still be trusted as a **frozen visual baseline**?

**No.**

| Expectation | Reality |
|-------------|---------|
| Immutable accepted UI | Dev route mounts **live** v0 components |
| Independent of bridge work | Every shared presentation edit affects reference |
| Matches `.reference/v0-orvek-workbench/` snapshot | Live `explore.tsx` has diverged (provider gates, deferred actions, live/reference branches) |

Explore tab **switching chrome** (four-tab segmented control) is unchanged; tab **inner content** and conditional copy/logic **do** change with bridge slices. Free Explore on reference still renders reference transcript today, but through new conditional paths — not a frozen snapshot.

---

## 9. Safest way to preserve a true golden reference

**Recommended layered approach (smallest → strongest):**

1. **`referenceMode` prop** on `Workbench` / page components  
   - Dev route: `<Workbench referenceMode />`  
   - Forces reference branches regardless of incidental mock field drift  
   - Lowest cost; keeps one component tree

2. **Frozen fixture API** (`createFrozenReferenceOrvekDataApi()`)  
   - Deep-frozen object; separate from evolving `createMockOrvekDataApi()` used as hybrid base at root  
   - Prevents mock evolution from breaking reference semantics

3. **Route-level guard tests** (see below)  
   - Static assertions that dev route never imports hybrid hooks or passes `dataApi` from shell

4. **Optional snapshot route** (strongest)  
   - Mount `.reference/v0-orvek-workbench/` components or a pinned copy under `/dev/orvek-v0-reference-frozen`  
   - Use for visual diff only; keep `/dev/orvek-v0-reference` as interactive mock if desired

**Do not** fork entire page trees per surface unless `referenceMode` proves insufficient.

---

## 10. Should we add tests guaranteeing reference route never imports hybrid production hooks?

**Yes — required.**

Proposed static tests (new file e.g. `lib/__tests__/reference-route-integrity.test.ts`):

- `app/dev/orvek-v0-reference/page.tsx` must:
  - import `Workbench` from `@/components/orvek-v0/workbench`
  - **not** import `OrvekWorkbenchShell`, `useOrvekHybridWorkbenchDataApi`, `useOrvekExploreChat`, or any `fetch*` production adapter
  - **not** pass `dataApi={...}` from a hook
- `components/orvek-v0/workbench.tsx` default path must remain `createMockOrvekDataApi()`
- Optional: assert dev route does not import `buildHybridWorkbenchDataApi`

Existing `orvek-v0-inversion.test.ts` partially covers dev route presence but **does not** assert hook quarantine.

---

## 11. `referenceMode` prop, frozen fixture, or snapshot route before Free Explore send?

| Option | Before send enable? | Rationale |
|--------|---------------------|-----------|
| **`referenceMode` prop** | **Yes** | Send slice will wire handlers, composer, and `freeExploreSendHandlerAvailable`; reference must not pick up handler paths accidentally |
| **Frozen fixture API** | **Yes (paired with referenceMode)** | Separates root hybrid base mock from golden data contract |
| **Snapshot route** | **Optional but valuable** | Gives product-owner a diff target that never hot-reloads with bridge edits |
| **Playwright visual baseline** | **Recommended** | `scripts/v0-route-smoke.playwright.ts` already hits reference route; extend with Explore tab screenshots |

**Implementation should happen before Free Explore send enablement (Slice E).** Send wiring increases regression risk on shared `FreeExplore` composer/handlers; reference integrity guards should land first.

---

## Risk classification

| Risk | Level | Notes |
|------|-------|-------|
| Production data leak on reference route | **Low** | Architecture correct today |
| False confidence in visual baseline | **High** | Shared components co-mutate |
| Mock API drift activating live UI branches | **Medium** | No guard if mock gains production ids |
| Send enablement breaking reference semantics | **Medium-High** | Upcoming slice touches shared FreeExplore |
| Explore tab chrome regression | **Low** | Tab list unchanged; content logic mutable |

---

## Recommended fix (implementation slice — not done in this audit)

1. Add `referenceMode?: boolean` to `Workbench`; dev route sets `referenceMode`
2. Add `createFrozenReferenceOrvekDataApi()` used only by dev route
3. In Explore (and eventually other pages), prefer `referenceMode` over inferring reference from absent production fields
4. Add `reference-route-integrity.test.ts` static quarantine tests
5. Extend Playwright smoke with Explore tab states on reference URL
6. Document in AGENTS.md / dev README: reference route = mock data + live components; `.reference/` = frozen snapshot for diff

---

## Tests required (future slice)

- [ ] Dev route does not import hybrid hook or production fetch modules
- [ ] Dev route `Workbench` call has no `dataApi` prop from shell (or uses frozen fixture explicitly)
- [ ] `referenceMode` forces reference transcript / reference Questions / reference Investigations on Explore
- [ ] `hasLiveExploreChatFromProvider` never true when `referenceMode` is true
- [ ] Playwright: `/dev/orvek-v0-reference` Explore tab screenshot baseline

---

## Audit answers (quick reference)

| # | Question | Answer |
|---|----------|--------|
| 1 | Route path | `app/dev/orvek-v0-reference/page.tsx` → `<Workbench />` |
| 2 | Mock only? | **Yes** — default `createMockOrvekDataApi()` |
| 3 | Production hooks? | **No** |
| 4 | Same `explore.tsx`? | **Yes** |
| 5 | Bridge slices changed shared UI? | **Yes** — Explore tabs (Free Explore, Questions, Investigations, Fieldwork) + other v0 pages |
| 6 | Data leak or shared presentation? | **Shared presentation only** |
| 7 | Data reference trust? | **Yes, with mock-drift caveat** |
| 8 | Frozen visual baseline trust? | **No** |
| 9 | Safest golden reference | **`referenceMode` + frozen fixture + tests (+ optional snapshot route)** |
| 10 | Add hook quarantine tests? | **Yes** |
| 11 | Before Free Explore send? | **Yes — implement guards before Slice E** |

---

## Production readiness

This audit does not change production readiness. Reference route remains a dev tool; root remains hybrid-bridged and not send-enabled for Free Explore.

## Product-owner visual check

Not required for this audit slice. Required when reference integrity guards are implemented.
