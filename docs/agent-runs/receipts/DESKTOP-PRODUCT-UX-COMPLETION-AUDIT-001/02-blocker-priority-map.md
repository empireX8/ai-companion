# Desktop Product UX Completion Audit — Blocker Priority Map

**Baseline:** `8ef094a`  
**Production-ready: NO**

---

## Priority definitions

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks product credibility or causes misleading live claims; should be next engineering focus |
| **P1** | Major completeness/clarity gap; hurts “complete Orvek” feel but not an active honesty violation in guarded paths |
| **P2** | Polish, depth, or nice-to-have; can follow P0/P1 |

## Classifications

| Tag | Meaning |
|-----|---------|
| **honesty** | UI/copy implies evidence, movement, sync, or completion not backed by data |
| **UX clarity** | User cannot understand state, next action, or surface purpose |
| **data readiness** | Live data path exists but UI does not consume it correctly |
| **visual/polish** | Interaction, streaming, layout refinement |
| **architecture risk** | Structural pattern that will keep causing regressions |

---

## P0 — Must address next

| ID | Blocker | Class | Surfaces | Recommended slice |
|----|---------|-------|----------|-------------------|
| **P0-1** | Root hybrid merges live data but v0 pages stay in reference mode because `isProductionDisplay` requires global `displayContract: production` (never set at root). Today worst: shows `REFERENCE_NOW_ROWS` / movements while live `today.*` may exist. | **architecture risk**, **data readiness**, **UX clarity** | Today, Map, Timeline, Decisions | `desktop-surface-live-mode-gating-001` |
| **P0-2** | TopBar status cluster presents specific live claims (“Model moved · 4 places”, “Synced 2h ago”, “Context profile current”) without live backing at root. | **honesty** | Cross-surface (TopBar) | `desktop-reference-chrome-live-gating-001` |
| **P0-3** | Inspector “Recent model movement” always renders reference objects `mu-1..mu-3` globally — not gated on live movement feed. | **honesty** | Inspector, Explore | `desktop-inspector-global-movement-honesty-001` |
| **P0-4** | Map shows reference header stats (“243 receipts”, “7 open questions”) when `isProduction` false even if production map categories merged — mixed live/reference presentation. | **honesty**, **data readiness** | Map | `desktop-map-live-header-parity-001` (may merge with P0-1) |

---

## P1 — High impact completeness gaps

| ID | Blocker | Class | Surfaces | Recommended slice |
|----|---------|-------|----------|-------------------|
| **P1-1** | Today re-entry cannot surface live hero/now rows/report at root until P0-1 resolved; user lands on demo playlist. | **UX clarity**, **data readiness** | Today | (follows P0-1) `desktop-today-live-reentry-ux-001` |
| **P1-2** | Decisions entry module (“Talk it through”) and several quick actions disabled in production mode; decision capture loop incomplete. | **UX clarity** | Decisions, Explore | `desktop-decisions-entry-actions-001` |
| **P1-3** | Timeline falls back to full mock `GROUPS` when sparse; evolution story disappears or becomes demo. | **data readiness**, **UX clarity** | Timeline | (follows P0-1) `desktop-timeline-sparse-live-ux-001` |
| **P1-4** | Inspector “Synced” badge on selected objects implies live freshness without proof. | **honesty** | Inspector | `desktop-inspector-sync-badge-honesty-001` |
| **P1-5** | Capture/Search overlays use reference `OBJECTS` — Life Data entry feels like demo search, not live library. | **UX clarity**, **data readiness** | Cross-surface (Overlays) | `desktop-capture-search-live-bridge-001` |
| **P1-6** | Explore sub-tabs (Investigations, Active Questions, Fieldwork) retain reference fallback copy and deferred actions when live lists load. | **UX clarity** | Explore | `desktop-explore-subtab-live-parity-001` |
| **P1-7** | Report overlay (`openReport`) surfaces reference report content — re-entry loop ends in demo document. | **honesty**, **UX clarity** | Today, Decisions, Inspector | `desktop-report-overlay-live-bridge-001` |
| **P1-8** | Many primary/deferred actions show “Not available on a live v0 route yet” — product feels intentionally broken. | **UX clarity** | Today, Decisions, Map | `desktop-deferred-action-inventory-001` |

---

## P2 — Polish and depth

| ID | Blocker | Class | Surfaces | Recommended slice |
|----|---------|-------|----------|-------------------|
| **P2-1** | Free Explore streaming UX stops at Thinking… row — no incremental assistant token render. | **visual/polish** | Explore | `desktop-free-explore-stream-polish-001` |
| **P2-2** | Map empty ontology rails show “—” without guiding narrative when most categories sparse. | **UX clarity** | Map | `desktop-map-sparse-rail-copy-001` |
| **P2-3** | Timeline local search only — no semantic/historical search backend. | **data readiness** | Timeline | `desktop-timeline-search-bridge-001` |
| **P2-4** | Decisions stage strip uses crude heuristics (`/outcome due/i`, tag parsing). | **UX clarity** | Decisions | `desktop-decisions-stage-signal-001` |
| **P2-5** | No breadcrumb / provenance for selected object across surface transitions. | **UX clarity** | Cross-surface | `desktop-selection-provenance-ux-001` |
| **P2-6** | Quick vs deep decision types not visually distinguished. | **UX clarity** | Decisions | `desktop-decisions-depth-framing-001` |
| **P2-7** | Legacy route URLs still reachable (quarantined) — dual-path confusion for bookmarks. | **architecture risk** | Cross-surface | `desktop-legacy-route-deprecation-001` (engineering safety) |

---

## Blocker count summary

| Priority | Count | Honesty | UX | Data | Polish | Arch |
|----------|-------|---------|-----|------|--------|------|
| P0 | 4 | 2 | 1 | 2 | 0 | 1 |
| P1 | 8 | 2 | 5 | 3 | 0 | 0 |
| P2 | 7 | 0 | 4 | 1 | 1 | 1 |

---

## What is NOT a blocker (explicitly accepted for now)

- Hard-swap temporary shell comment — known staging posture
- Reference route mock-only behavior — correct by design
- Free Explore live honesty path — **PO-confirmed PASS**
- Recent global movement **when clearly labeled reference** on `/dev/orvek-v0-reference` only
- Readiness-gated hybrid fallback to mock when fetch truly fails (must remain honest in copy)

---

**Production-ready: NO**
