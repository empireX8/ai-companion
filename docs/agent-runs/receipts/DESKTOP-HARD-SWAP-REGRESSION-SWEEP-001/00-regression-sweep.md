# Desktop Hard-Swap Regression Sweep — Receipt

**Slice:** `DESKTOP-HARD-SWAP-REGRESSION-SWEEP-001`  
**Branch:** `desktop-hard-swap-regression-sweep-001`  
**Baseline commit:** `786f891` (staging — PR #96 + PR #97 merged)  
**Date:** 2026-07-06  
**Classification:** **PASS WITH RISKS** (audit clean; no product regressions patched; 2 pre-existing stale tests on baseline)

---

## Summary

Full static + unit regression sweep across all landed Orvek desktop hard-swap surfaces and shell contracts. No concrete regressions found against baseline `786f891`. One focused regression test file added to lock sweep invariants. No product code patched.

**Production-ready: NO**

---

## Audited surfaces

| # | Surface | Result |
|---|---------|--------|
| 1 | Root hard-swap shell | **PASS** — `AppShell` → `OrvekWorkbenchShell` → `Workbench` with hybrid API + handlers; `void children`; v0 `OrvekShellLayout` / TopBar / Sidebar / EvidencePanel / Overlays |
| 2 | Reference route `/dev/orvek-v0-reference` | **PASS** — bare `<Workbench />`, mock API only, no hybrid hook, no handlers, send-disabled |
| 3 | Today | **PASS** — store page via `setPage("today")`; re-entry via `runTodayWorkbenchCommands` + `setPage`/`select`/`openReport`/`setOverlay`; not Timeline/Calendar |
| 4 | Map | **PASS** — hybrid `shouldMergeMapProductionApi` gate; `buildMapProductionDataApi` in hook; v0 `map.tsx` presentation; no `V0MapView` / `router.push` |
| 5 | Timeline | **PASS** — semantic filters (`TIMELINE_SEMANTIC_FILTERS`); `shouldMergeTimelineProductionApi`; no Calendar top-level; no `router.push` |
| 6 | Decisions | **PASS** — `shouldMergeDecisionsProductionApi`; v0 `decisions.tsx`; no legacy `DecisionsPriorityBand` |
| 7 | Explore | **PASS** — dual send gate (`freeExploreSendHandlerAvailable` + `onSend`); `useReferenceGrounding = !hasLiveExploreChat`; thinking row + underline tab styling; legacy `/explore` quarantined (`OrvekExplorePage`) |
| 8 | Inspector | **PASS** — live Explore: honest empty current-conversation movement (`showLiveConversationMovementEmpty`); reference-only `FROM THIS CONVERSATION` when `!hasLiveExploreChat`; recent/global movement separately framed as **Recent model movement** |
| 9 | Old route / shell quarantine | **PASS** — legacy route files exist but root shell ignores children; active v0 pages use `setPage`/`select`/`setInspectorTab`/`setOverlay`/`openReport`; `router.push` only in quarantined `RouteTopBar.tsx` and unused `ReferencePageHandlersProvider.tsx` |
| 10 | Production readiness honesty | **PASS** — no global `displayContract: production`; `createMockOrvekDataApi()` retained; hybrid merge clears live chat grounding/movement leaks |

---

## Old shell / route quarantine

- **Active shell:** `components/orvek-workbench/OrvekWorkbenchShell.tsx` — does **not** import `RouteTopBar`, `RouteSidebar`, `ProductionInspectorAside`, or legacy `OrvekTopBar` / `OrvekSidebar` / `OrvekEvidencePanel`.
- **Route children:** `void children` — `app/(root)/page.tsx` and nested route pages (e.g. `OrvekTodayPage`, `OrvekExplorePage`) are **not** rendered by root shell.
- **Legacy routes still present (quarantined):** `/journal-chat`, `/your-map`, `/timeline`, `/actions`, `/watch-for`, `/active-questions`, `/investigations`, `/explore` — each has its own `page.tsx` but is shadowed when navigating via root hard swap.
- **Navigation in active v0 pages:** store-driven only; no `router.push` in `today`, `map`, `timeline`, `decisions`, `explore`, or `sidebar`.

---

## Reference route integrity

| Check | Result |
|-------|--------|
| Renders `<Workbench />` | Yes |
| Mock data via `createMockOrvekDataApi()` default | Yes |
| No `useOrvekHybridWorkbenchDataApi` | Yes |
| No production fetch hooks on reference page | Yes |
| Send disabled (no handlers passed) | Yes |
| `data-testid="orvek-v0-reference-route"` | Present |

---

## Free Explore post-send honesty

| Check | Result |
|-------|--------|
| Grounded In: reference chips only when `!hasLiveExploreChat` | Locked in `explore.tsx` + tests |
| Hybrid merge passes empty `exploreGrounding` / `exploreMovement` from live chat overlay | Locked in `hybrid-workbench-api.ts` + post-send audit tests |
| Inspector current-conversation movement empty in live root | `showLiveConversationMovementEmpty` + `EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY` |
| Recent/global movement separately framed | `Recent model movement` section retained |
| Send path: user bubble → Thinking… → assistant | Wired in `explore.tsx` + send/draft/stream tests |

---

## Known residual fixtures (not regressions)

These are **accepted v0 reference chrome** in the hard-swapped shell, not post-send leaks:

- Top bar status cluster copy (e.g. “Model moved · 4 places”, “Synced 2h ago”) — reference fixture; uses `setPage` for navigation.
- Inspector **Recent model movement** cards (`mu-1`, `mu-2`, `mu-3`) — globally framed, not “from this conversation”.
- Route-first legacy pages remain reachable at their URLs but are **not** the root shell navigation path.

---

## Code changed

| Kind | Detail |
|------|--------|
| Product code | **No** |
| Tests | **Yes** — added `lib/__tests__/desktop-hard-swap-regression-sweep.test.ts` |
| Receipt | **Yes** — this file |

### Changed files

- `lib/__tests__/desktop-hard-swap-regression-sweep.test.ts` (added)
- `docs/agent-runs/receipts/DESKTOP-HARD-SWAP-REGRESSION-SWEEP-001/00-regression-sweep.md` (added)

---

## Checks run

```bash
npx tsc --noEmit
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
git diff --check
npx vitest run \
  lib/__tests__/shell-quarantine.test.ts \
  lib/__tests__/orvek-v0-inversion.test.ts \
  lib/__tests__/free-explore-chat-send-draft-stream.test.ts \
  lib/__tests__/free-explore-post-send-side-effect-audit.test.ts \
  lib/__tests__/free-explore-chat-tab-alignment.test.ts \
  lib/__tests__/free-explore-chat-presentation-readiness.test.ts \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/desktop-hard-swap-regression-sweep.test.ts \
  lib/__tests__/today-surface.test.ts \
  lib/__tests__/your-map-workbench.test.ts \
  lib/__tests__/map-presentation-readiness.test.ts \
  lib/__tests__/timeline-presentation-readiness.test.ts \
  lib/__tests__/decisions-presentation-readiness.test.ts \
  lib/__tests__/fieldwork-bridge-alignment.test.ts \
  lib/__tests__/active-questions-tab-alignment.test.ts \
  lib/__tests__/investigations-tab-alignment.test.ts
```

*(Fill verification output below after run completes.)*

### Verification results (2026-07-06)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** |
| `bash scripts/check-trust-language.sh` | **PASS** |
| `bash scripts/check-legacy-surfaces.sh` | **PASS** |
| `git diff --check` | **PASS** (untracked receipt/test files only) |
| Vitest sweep suites | **251/253 PASS** — 2 **pre-existing** failures on baseline `786f891` (see risks below) |

**New sweep tests:** `desktop-hard-swap-regression-sweep.test.ts` — **10/10 PASS**

**Pre-existing stale tests (not introduced by this sweep):**

1. `hybrid-workbench-api.test.ts` → `does not merge fake grounding/movement/live-detection fields as production chat overlay` — when a leaked chat overlay fails merge, hybrid returns full `baseApi` with mock `exploreGrounding` instead of clearing to `[]`. Runtime path builds clean overlay via hook; PO-confirmed live send honesty holds. Defensive gap only.
2. `your-map-workbench.test.ts` → `renders master-detail layout on /your-map` — still asserts `OrvekMapPage` contains `buildMapProductionDataApi`; hard swap moved map bridge to `useOrvekHybridWorkbenchDataApi` in `OrvekWorkbenchShell`. Legacy `/your-map` route is quarantined; root shell map bridge is readiness-gated in hybrid hook.

---

## Runtime / visual checks still required

Because **no product code changed**, runtime/visual re-check is **recommended but not blocking** for this slice. PO should still confirm on root `/` before any commit:

1. Free Explore send: user bubble → Thinking… → assistant; Ask disabled in-flight; no duplicate send.
2. Grounded In empty/honest in live root after send.
3. Inspector → Model Movement: honest empty current-conversation state in live root.
4. Sidebar `setPage` navigation across Today / Map / Timeline / Decisions / Explore.
5. Reference route `/dev/orvek-v0-reference`: send still disabled; mock data only.

---

## Blockers

None for landing further hard-swap work. Two **pre-existing test assertions** are stale relative to hard-swap architecture (see verification results); they do not indicate a product regression on audited surfaces.

**Production-ready remains NO** — hard swap is temporary; bridges are readiness-gated; reference fixtures remain in chrome.

---

## Recommended commit command (only if PO runtime passes)

```bash
git add \
  lib/__tests__/desktop-hard-swap-regression-sweep.test.ts \
  docs/agent-runs/receipts/DESKTOP-HARD-SWAP-REGRESSION-SWEEP-001/00-regression-sweep.md

git commit -m "$(cat <<'EOF'
Add desktop hard-swap regression sweep receipt and guard tests.

Lock shell quarantine, reference route integrity, and Explore post-send honesty invariants after PR #96/#97 without changing product behavior.
EOF
)"
```

**Do not commit until PO runtime/visual checks pass.**

---

**Production-ready: NO**
