# Desktop Product UX Completion Audit — Next Slice Plan

**Baseline:** `8ef094a`  
**Production-ready: NO**

---

## Recommended implementation order

Slices ordered by dependency and product impact. Each assumes hard-swap architecture, quarantine guards, and Free Explore honesty guards remain intact.

---

## Engineering safety (parallel / early)

### 1. `desktop-surface-live-mode-gating-001`

**Branch:** `desktop-surface-live-mode-gating-001`  
**Addresses:** P0-1 (root cause), enables P1-1, P1-3, P1-4  
**Goal:** Replace global `isProductionDisplay` dependency at root with **per-surface live readiness signals** derived from merged hybrid API (e.g. `todayHasLiveSnapshot`, `mapHasLiveContent`, `timelineHasLiveGroups`) — **without** setting global `displayContract: production`.  
**Scope:** `lib/orvek-v0/production/hybrid-workbench-api.ts`, v0 page `isProduction` checks, focused tests.  
**Verification:** Today shows live now rows when snapshot merges; Map uses `ProductionMapHeader` when map merge ready; reference fallbacks only when truly sparse.

### 2. `desktop-legacy-route-deprecation-001`

**Branch:** `desktop-legacy-route-deprecation-001`  
**Addresses:** P2-7  
**Goal:** Redirect or neutralize legacy `/your-map`, `/explore`, `/timeline`, `/actions` when root hard swap active; reduce dual-path confusion.  
**Scope:** route middleware or redirect pages only — no shell restore.

### 3. `desktop-hybrid-fetch-observability-001`

**Branch:** `desktop-hybrid-fetch-observability-001`  
**Goal:** Dev/staging visibility when `shouldMerge*ProductionApi` fails (silent mock fallback today).  
**Scope:** logging hooks in `useOrvekHybridWorkbenchDataApi` — no product copy changes.

---

## Product UX (after P0-1 foundation)

### 4. `desktop-reference-chrome-live-gating-001`

**Branch:** `desktop-reference-chrome-live-gating-001`  
**Addresses:** P0-2  
**Goal:** TopBar status cluster either live-gated, honestly empty, or explicitly labeled reference fixture.  
**Files:** `components/orvek-v0/top-bar.tsx`, possibly hybrid hook for stats source.

### 5. `desktop-inspector-global-movement-honesty-001`

**Branch:** `desktop-inspector-global-movement-honesty-001`  
**Addresses:** P0-3, P1-4  
**Goal:** Recent model movement section shows live feed or honest empty — never hardcoded `mu-1..mu-3` at root. Sync badge honesty in same slice or follow-up.  
**Files:** `components/orvek-v0/evidence-panel.tsx`, movement preview bridge if needed.

### 6. `desktop-today-live-reentry-ux-001`

**Branch:** `desktop-today-live-reentry-ux-001`  
**Addresses:** P1-1, P1-8 (Today subset)  
**Goal:** PO-runtime Today re-entry matrix — hero, now rows, fieldwork, receipts, report block all honest for sparse/live states.  
**Depends on:** P0-1 gating slice.

### 7. `desktop-explore-subtab-live-parity-001`

**Branch:** `desktop-explore-subtab-live-parity-001`  
**Addresses:** P1-6  
**Goal:** Investigations / Active Questions / Fieldwork Bridge: remove reference fallback strings when live lists loaded; wire or honestly defer actions.  
**Files:** `components/orvek-v0/pages/explore.tsx`, presentation readiness tests.

### 8. `desktop-decisions-entry-actions-001`

**Branch:** `desktop-decisions-entry-actions-001`  
**Addresses:** P1-2  
**Goal:** Decision entry module and quick actions either wired to Explore/send or clearly deferred with product copy — not silent opacity.  
**Files:** `components/orvek-v0/pages/decisions.tsx`.

### 9. `desktop-capture-search-live-bridge-001`

**Branch:** `desktop-capture-search-live-bridge-001`  
**Addresses:** P1-5  
**Goal:** Capture/Search overlays query live evidence index or show honest “search not connected” — not reference `OBJECTS` demo.  
**Files:** `components/orvek-v0/overlays.tsx`, search API bridge.

### 10. `desktop-report-overlay-live-bridge-001`

**Branch:** `desktop-report-overlay-live-bridge-001`  
**Addresses:** P1-7  
**Goal:** Report overlay content traces to stored reports or honest empty — close Life Data → Report → re-entry loop.  
**Files:** `components/orvek-v0/overlays.tsx`, report API if exists.

---

## Production readiness / security (later gate)

### 11. `desktop-evidence-gate-e2e-audit-001`

**Branch:** `desktop-evidence-gate-e2e-audit-001`  
**Goal:** Trace user-facing claims on each surface to stored evidence; receipt-only unless leak found.  
**Not a feature slice** — audit before any production-ready discussion.

### 12. `desktop-auth-session-boundary-audit-001`

**Branch:** `desktop-auth-session-boundary-audit-001`  
**Goal:** Free Explore session, hybrid fetches, inspector endpoints — auth boundary review.  
**Pairs with:** security review before staging sign-off.

### 13. `desktop-staging-smoke-matrix-001`

**Branch:** `desktop-staging-smoke-matrix-001`  
**Goal:** PO runtime matrix on staging across all five surfaces + send + inspector; documented pass/fail per surface.  
**Prerequisite for:** removing “Temporary hard swap” comment.

### 14. `desktop-production-ready-gate-definition-001`

**Branch:** `desktop-production-ready-gate-definition-001`  
**Goal:** Written checklist for what “production-ready” means for Orvek desktop — explicit **Production-ready: NO** until checklist passes.  
**Deliverable:** doc only, no code.

---

## Suggested first sprint (3 slices)

If picking **three slices immediately after this audit**:

1. **`desktop-surface-live-mode-gating-001`** — unlocks live UX on Today/Map/Timeline (P0-1)
2. **`desktop-reference-chrome-live-gating-001`** — TopBar honesty (P0-2)
3. **`desktop-inspector-global-movement-honesty-001`** — Inspector movement honesty (P0-3)

These three remove the largest “demo masquerading as live product” signals without restoring old shell or global `displayContract: production`.

---

## Suggested audit-only follow-ups (no code until leak found)

- `desktop-deferred-action-inventory-001` — catalog every `ORVEK_DEFERRED_ACTION_CLASS` with owner and wire plan
- `desktop-evidence-gate-e2e-audit-001` — cross-surface claim tracing
- `desktop-production-ready-gate-definition-001` — explicit launch bar

---

## Tests to add (only when implementing slices)

| Slice | Tests |
|-------|-------|
| Live mode gating | Per-surface live flag tests in hybrid + page source guards |
| TopBar honesty | Source guard: no ungated numeric movement claims at root |
| Inspector movement | Guard: no hardcoded `mu-1..mu-3` at root without reference flag |

**This audit slice:** no new tests — no guard gap discovered beyond documented product UX blockers.

---

**Production-ready: NO**
