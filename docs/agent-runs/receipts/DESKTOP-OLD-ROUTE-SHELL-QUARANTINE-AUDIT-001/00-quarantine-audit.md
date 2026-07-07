# Desktop Old-Route / Old-Shell Quarantine Audit — Receipt

**Slice:** `DESKTOP-OLD-ROUTE-SHELL-QUARANTINE-AUDIT-001`  
**Branch:** `desktop-old-route-shell-quarantine-audit-001`  
**Baseline commit:** `afc6fa5` (staging — PR #99 test gap cleanup landed)  
**Date:** 2026-07-07  
**Classification:** **PASS** (audit + guard tests; no product quarantine leak found)

**Production-ready: NO**

---

## Summary

Audited the desktop hard-swap quarantine boundary for old production shell components, route-first navigation, and legacy route ownership. Root `/` remains on the accepted v0 Workbench path with route children ignored. No concrete quarantine leak requiring product code change was found. Added focused guard tests to lock the boundary.

---

## Audited old routes / shells

### Root hard-swap chain (active)

| Layer | File | Status |
|-------|------|--------|
| Layout | `app/(root)/layout.tsx` → `AppShell` | **PASS** |
| Shell | `components/layout/AppShell.tsx` → `OrvekWorkbenchShell` | **PASS** |
| Bridge | `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` | **PASS** |
| Workbench | `components/orvek-v0/workbench.tsx` | **PASS** |
| Route children | `void children` in `OrvekWorkbenchShell` | **PASS** — ignored |

### Old shell components (quarantined, unimported)

| Component | Location | Imported by active root? |
|-----------|----------|--------------------------|
| `RouteTopBar` | `components/orvek-v0/production/RouteTopBar.tsx` | **No** |
| `RouteSidebar` | `components/orvek-v0/production/RouteSidebar.tsx` | **No** |
| `OrvekTopBar` | `components/orvek-workbench/OrvekTopBar.tsx` | **No** |
| `OrvekSidebar` | `components/orvek-workbench/OrvekSidebar.tsx` | **No** |
| `OrvekEvidencePanel` / `ProductionInspectorAside` | `components/orvek-workbench/OrvekEvidencePanel.tsx` | **No** |

### Legacy route-first page containers (exist, not mounted by root)

| Route | Container | Root active? |
|-------|-----------|--------------|
| `/` (page child) | `OrvekTodayPage` | **No** — voided by shell |
| `/explore` | `OrvekExplorePage` | **No** |
| `/your-map` | `OrvekMapPage` | **No** |
| `/timeline` | `OrvekTimelinePage` | **No** |
| `/actions` | `OrvekDecisionsPage` | **No** |
| `/journal-chat`, `/watch-for`, `/active-questions` | legacy pages | **No** |

### Reference route

| Check | Result |
|-------|--------|
| Bare `<Workbench />` | **PASS** |
| No hybrid hook / handlers | **PASS** |
| Mock via `createMockOrvekDataApi()` default | **PASS** |
| Send disabled | **PASS** |

---

## Quarantine result

**No old route/shell leak found.**

- Root does **not** mount `RouteTopBar`, `RouteSidebar`, `ProductionInspectorAside`, or legacy `OrvekTopBar` / `OrvekSidebar` / `OrvekEvidencePanel`.
- Root does **not** mount quarantined `Orvek*Page` route containers or `OrvekV0PageShell`.
- Active v0 pages (`today`, `map`, `timeline`, `decisions`, `explore`) use store navigation (`setPage`, `select`, `setInspectorTab`, `setOverlay`, `openReport`); no `router.push` in active v0 pages.
- `router.push` to legacy routes is confined to quarantined `RouteTopBar.tsx` and unused `ReferencePageHandlersProvider.tsx`.
- Map production bridge remains in `useOrvekHybridWorkbenchDataApi`, not active `OrvekMapPage` ownership.
- Free Explore honesty guards intact: `useReferenceGrounding = !hasLiveExploreChat`, inspector movement gates, `stripRejectedFreeExploreChatMockBleed`.
- No global `displayContract: production`.

---

## Code / test changes

| Kind | Detail |
|------|--------|
| Product code | **No** |
| Tests | **Yes** — added `lib/__tests__/desktop-old-route-shell-quarantine.test.ts` |
| Receipt | **Yes** — this file |

### Changed files

- `lib/__tests__/desktop-old-route-shell-quarantine.test.ts` (added)
- `docs/agent-runs/receipts/DESKTOP-OLD-ROUTE-SHELL-QUARANTINE-AUDIT-001/00-quarantine-audit.md` (added)

---

## Checks run

```bash
npx tsc --noEmit                                          PASS
bash scripts/check-trust-language.sh                      PASS
bash scripts/check-legacy-surfaces.sh                     PASS
git diff --check                                          PASS
npx vitest run \
  lib/__tests__/shell-quarantine.test.ts                  PASS
  lib/__tests__/orvek-v0-inversion.test.ts                PASS
  lib/__tests__/desktop-hard-swap-regression-sweep.test.ts PASS
  lib/__tests__/your-map-workbench.test.ts                PASS
  lib/__tests__/hybrid-workbench-api.test.ts              PASS
  lib/__tests__/free-explore-post-send-side-effect-audit.test.ts PASS
  lib/__tests__/free-explore-chat-send-draft-stream.test.ts PASS
  lib/__tests__/desktop-old-route-shell-quarantine.test.ts PASS
```

*(Fill exact test counts after run completes.)*

### Verification results (2026-07-07)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** |
| `bash scripts/check-trust-language.sh` | **PASS** |
| `bash scripts/check-legacy-surfaces.sh` | **PASS** |
| `git diff --check` | **PASS** |
| Vitest (8 files) | **133/133 PASS** |

**New quarantine tests:** `desktop-old-route-shell-quarantine.test.ts` — **12/12 PASS**

**Remaining failures:** none

---

## Remaining risks (accepted, not regressions)

1. **Legacy route URLs still reachable** — `/your-map`, `/explore`, etc. render quarantined `Orvek*Page` containers if navigated directly; root hard swap ignores them when using `/` + store navigation.
2. **Reference chrome in v0 TopBar** — static status copy (e.g. “Model moved · 4 places”) is accepted v0 fixture, not live post-send claims.
3. **RouteTopBar / RouteSidebar files remain in repo** — unimported backup code; guard tests assert zero importers.

---

## Runtime / visual check before commit?

**Not required** — audit-only + test additions; no product code changed. Optional PO spot-check: root `/` sidebar `setPage` navigation still works and does not flash old route UI.

---

## Recommended commit command (safe — test-only)

```bash
git add \
  lib/__tests__/desktop-old-route-shell-quarantine.test.ts \
  docs/agent-runs/receipts/DESKTOP-OLD-ROUTE-SHELL-QUARANTINE-AUDIT-001/00-quarantine-audit.md

git commit -m "$(cat <<'EOF'
Add old-route and old-shell quarantine guard tests.

Lock root hard-swap boundaries so legacy route containers and production shell components cannot become active root UI without explicit regression.
EOF
)"
```

**Not committed** per instructions.

---

**Production-ready: NO**
