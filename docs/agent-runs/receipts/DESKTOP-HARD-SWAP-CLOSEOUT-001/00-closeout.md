# Desktop Hard-Swap Closeout — Receipt

**Slice:** `DESKTOP-HARD-SWAP-CLOSEOUT-001`  
**Branch:** `desktop-hard-swap-closeout-001`  
**Baseline commit:** `c920d97` (staging — PR #100 quarantine guards landed)  
**Date:** 2026-07-07  
**Classification:** **PASS** (audit + closeout receipt only; no product changes)

**Production-ready: NO**

---

## Summary

Closeout for the desktop hard-swap guard stack (PR #96–#100). Root `/` remains on the accepted Orvek v0 Workbench path with hybrid production bridges, store-driven navigation, and quarantined legacy routes/shells. Free Explore send/honesty guards are locked by tests. No concrete regression found at closeout verification.

This closeout records verified state, remaining risks, and recommended next slices. It does **not** declare production readiness.

---

## Merged PR stack covered

| PR | Slice | What landed |
|----|-------|-------------|
| **#96** | Free Explore E2/E3 send/draft/stream | Dual send gate; `useOrvekHybridWorkbenchDataApi` handlers; user bubble → Thinking… → assistant wiring |
| **#97** | Post-send side-effect audit | Live Grounded In honesty; hybrid overlay clears mock grounding/movement bleed; inspector current-conversation movement empty state |
| **#98** | Hard-swap regression sweep | Full surface audit receipt; `desktop-hard-swap-regression-sweep.test.ts` |
| **#99** | Test gap cleanup | `stripRejectedFreeExploreChatMockBleed`; Map bridge tests aligned to hybrid hook; hybrid/presentation tests green |
| **#100** | Old-route / old-shell quarantine | `desktop-old-route-shell-quarantine.test.ts`; zero-importer guard for legacy shell components |

**Prior bridge stack (pre-guard, still active):** Today, Map, Timeline, Decisions, Experiment/Fieldwork, Active Questions, Investigations, Free Explore chat — each readiness-gated via `buildHybridWorkbenchDataApi` in `useOrvekHybridWorkbenchDataApi`.

---

## 1. Root hard-swap status — **VERIFIED**

| Check | Status |
|-------|--------|
| Root `/` renders accepted v0 Workbench shell | **PASS** |
| Chain: `AppShell` → `OrvekWorkbenchShell` → `useOrvekHybridWorkbenchDataApi` → `Workbench` | **PASS** |
| Route children ignored (`void children`) | **PASS** |
| Old production shell not mounted | **PASS** — no `RouteTopBar`, `RouteSidebar`, `ProductionInspectorAside`, legacy `OrvekTopBar`/`OrvekSidebar`/`OrvekEvidencePanel` in active chain |
| Old route pages not active root UI | **PASS** — `OrvekTodayPage`, `OrvekMapPage`, `OrvekExplorePage`, etc. exist at legacy URLs but are voided when using root hard swap |

**Note:** Hard swap is explicitly **temporary** in `OrvekWorkbenchShell.tsx` comment — intentional staging posture, not final architecture.

---

## 2. Reference route status — **VERIFIED**

| Check | Status |
|-------|--------|
| `/dev/orvek-v0-reference` renders bare `<Workbench />` | **PASS** |
| Mock-only via `createMockOrvekDataApi()` default | **PASS** |
| No `useOrvekHybridWorkbenchDataApi` | **PASS** |
| No production fetch hooks on reference page | **PASS** |
| No handlers passed | **PASS** |
| Send disabled | **PASS** |
| `data-testid="orvek-v0-reference-route"` | Present |

---

## 3. Surface status — **VERIFIED (guard + prior receipts)**

| Surface | Verified state |
|---------|----------------|
| **Today** | Store page (`setPage("today")`); re-entry via `runTodayWorkbenchCommands` + store actions; hybrid Today overlay when snapshot has resurfaced ids; not Timeline/Calendar |
| **Map** | v0 `map.tsx` in Workbench; production bridge in `useOrvekHybridWorkbenchDataApi` via `buildMapProductionDataApi`; `shouldMergeMapProductionApi` readiness gate; inspector evidence wiring preserved |
| **Timeline** | Semantic evolution surface (`TIMELINE_SEMANTIC_FILTERS`); `shouldMergeTimelineProductionApi`; no Calendar top-level regression |
| **Decisions** | v0 `decisions.tsx`; `shouldMergeDecisionsProductionApi`; deferred actions remain honestly gated |
| **Explore** | Free Explore send/draft/stream wired; underline tab styling; Investigations / Active Questions / Fieldwork Bridge tabs unchanged; legacy `/explore` quarantined |
| **Inspector** | v0 `EvidencePanel` attached to selected object; live Explore: honest empty current-conversation movement; reference movement only when `!hasLiveExploreChat`; Recent model movement separately framed |

---

## 4. Free Explore status — **VERIFIED**

| Check | Status |
|-------|--------|
| Send/draft/stream gate landed (PR #96) | **PASS** — dual gate: `freeExploreSendHandlerAvailable` + `exploreHandlers.onSend` |
| Runtime path: user bubble → Thinking… → assistant | **PASS** — PO-confirmed; locked in `free-explore-chat-send-draft-stream.test.ts` |
| No mock/reference Grounded In chips in live root | **PASS** — `useReferenceGrounding = !hasLiveExploreChat` |
| No fake FROM THIS CONVERSATION movement in live root | **PASS** — `showLiveConversationMovementEmpty` + empty copy |
| Successful live merge path unchanged after PR #99 | **PASS** — `mergeFreeExploreChatOverlay` + `normalizeFreeExploreChatProductionDataApi` unchanged on success path |
| Rejected overlay defensive hardening (PR #99) | **PASS** — `stripRejectedFreeExploreChatMockBleed` prevents mock bleed on failed merge |

---

## 5. Quarantine status — **VERIFIED**

| Check | Status |
|-------|--------|
| Legacy route containers exist but not active root UI | **PASS** |
| Route-first navigation quarantined | **PASS** — active v0 pages use store; `router.push` only in quarantined `RouteTopBar` / unused `ReferencePageHandlersProvider` |
| Old shell components unimported | **PASS** — full source scan in quarantine test |
| Map bridge in hybrid hook, not active `OrvekMapPage` | **PASS** |

**Accepted residual fixtures (not leaks):**

- v0 TopBar reference status copy (“Model moved · 4 places”, etc.)
- Inspector **Recent model movement** global cards (`mu-1`, `mu-2`, `mu-3`)
- Legacy URLs still reachable if navigated directly (outside root store path)

---

## 6. Test status — guard coverage summary

### Closeout verification run (this receipt)

| Suite | Tests | Role |
|-------|-------|------|
| `desktop-hard-swap-regression-sweep.test.ts` | 10 | Full surface + honesty guardrails |
| `desktop-old-route-shell-quarantine.test.ts` | 12 | Old route/shell boundary hardening |
| `hybrid-workbench-api.test.ts` | 64 | All hybrid overlay merges + rejected chat bleed |
| `your-map-workbench.test.ts` | 11 | Map bridge in hybrid hook; quarantine |
| `shell-quarantine.test.ts` | 3 | Reference workbench shell contract |
| `orvek-v0-inversion.test.ts` | 7 | v0 UI inversion; reference route |
| `free-explore-post-send-side-effect-audit.test.ts` | 9 | Post-send honesty |
| `free-explore-chat-send-draft-stream.test.ts` | 17 | E2/E3 send/draft/stream wiring |
| `free-explore-chat-presentation-readiness.test.ts` | 21 | Session/presentation gates + hybrid merge |
| **Total (closeout run)** | **154** | **154/154 PASS** |

### Additional guard coverage (landed in PR stack, not re-run here)

- `free-explore-chat-tab-alignment.test.ts` — Explore tab parity
- `free-explore-chat-handler-provider-mount.test.ts` — handler provider mount
- `free-explore-chat-hybrid-fetch.test.ts` — bounded chat fetch
- Surface-specific presentation/hybrid-fetch tests for Timeline, Decisions, Experiment, Active Questions, Investigations

---

## 7. Remaining risks / not production-ready reasons

**Production-ready: NO** — explicitly and for these reasons:

1. **Hard swap is temporary** — root mounts reference Workbench directly; final shell/routing architecture not settled.
2. **Security / readiness audit not complete** — no full security review of hybrid fetch surfaces, auth boundaries, or evidence gates at launch bar.
3. **Full app E2E production data readiness not proven** — bridges are readiness-gated per surface; sparse/failed fetches fall back to reference mock; not all surfaces have PO runtime sign-off.
4. **External deployment / public launch readiness not proven** — no staging/production deployment validation, load testing, or operator runbooks for hard-swap posture.
5. **Known product gaps visible from receipts:**
   - Reference fixtures remain in v0 chrome (TopBar status, global movement cards)
   - Legacy route URLs still render quarantined containers if hit directly
   - Decisions/Timeline/Map/etc. page handlers in `ReferencePageHandlersProvider` unused at root
   - Investigations tab and other Explore sub-tabs may still mix reference + production overlays depending on fetch readiness
   - No claim that all inspector evidence/model movement is live-backed outside Free Explore honesty slice
6. **POST `/api/message` unchanged** — chat send path depends on existing API; not re-audited in this closeout.

---

## 8. Next recommended slices

### Engineering safety (next 3–5)

1. **Legacy route deprecation sweep** — redirect or 404 legacy `/your-map`, `/explore`, `/timeline`, `/actions` when root hard swap is active; reduce dual-path confusion.
2. **Hybrid fetch failure observability** — structured logging/metrics when `shouldMerge*ProductionApi` fails so silent mock fallback is visible in dev/staging.
3. **Full guard CI gate** — add `scripts/verify-desktop-hard-swap.sh` convenience script bundling the 154-test closeout stack into `verify-mindlab.sh` or CI matrix.
4. **Reference fixture audit** — separate pass on TopBar/Recent movement fixtures: label as reference-only or replace with honest empty/live-gated copy.

### Product UX (next 3–5)

1. **Today re-entry runtime PO pass** — verify all `runTodayWorkbenchCommands` targets land on correct store pages with honest empty states.
2. **Map/Timeline/Decisions sparse-data UX** — when production fetch fails readiness, confirm empty copy is honest (not mock objects presented as live).
3. **Explore sub-tab parity** — Investigations / Active Questions / Fieldwork Bridge runtime check under root hard swap (not just Free Explore).
4. **Inspector depth pass** — evidence panel live vs reference framing across non-Explore surfaces.

### Production readiness / security (next 3–5)

1. **Auth/session boundary audit** — Free Explore chat session boot, hybrid hook fetches, and inspector evidence endpoints under authenticated root.
2. **Evidence gate end-to-end audit** — trace user-facing claims on each surface to stored evidence; no static/mock leak in production display paths.
3. **Staging deployment smoke** — deploy hard-swap stack to staging; PO runtime matrix across all five surfaces + send.
4. **Security review slice** — POST `/api/message`, public API surfaces used by hybrid hook, no raw private evidence in projections.
5. **Production-ready gate definition** — explicit checklist (not this closeout) before removing “Temporary hard swap” comment or calling launch-ready.

---

## Verification summary (closeout run)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** |
| `bash scripts/check-trust-language.sh` | **PASS** |
| `bash scripts/check-legacy-surfaces.sh` | **PASS** |
| `git diff --check` | **PASS** (clean tree before receipt add) |
| Vitest closeout stack (9 files, 154 tests) | **154/154 PASS** |

**Remaining failures:** none

---

## Code / test changes (this slice)

| Kind | Detail |
|------|--------|
| Product code | **No** |
| Tests | **No** |
| Receipt | **Yes** — this file |

### Changed files

- `docs/agent-runs/receipts/DESKTOP-HARD-SWAP-CLOSEOUT-001/00-closeout.md` (added)

---

## Runtime / visual check before commit?

**Not required** — receipt-only closeout; no product or test code changed. PO may optionally re-run Free Explore send + sidebar navigation before merging closeout receipt.

---

## Recommended commit command (safe — receipt-only)

```bash
git add docs/agent-runs/receipts/DESKTOP-HARD-SWAP-CLOSEOUT-001/00-closeout.md

git commit -m "$(cat <<'EOF'
Add desktop hard-swap guard stack closeout receipt.

Record verified state, test coverage, remaining risks, and next slices after PR #96–#100 without changing product behavior.
EOF
)"
```

**Not committed** per instructions.

---

**Production-ready: NO**
