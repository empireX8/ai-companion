# MindLab Step 8 — Web Product Backend Alignment Contract (Today / Timeline / Library)

**Date:** 2026-05-16  
**Type:** Audit + implementation contract (web polish only)

## 1) Purpose

This contract defines the smallest safe web polish pass after the Understanding Engine foundation and internal review closeout.

Goals:
- improve user-visible quality on existing web surfaces
- reduce synthetic/client-invented content where backend truth already exists
- preserve current safety boundaries and phase limits

This is a backend-alignment pass, not an intelligence-scope expansion.

## 2) Non-Goals (Locked)

Do not include any of the following in this pass:
- no public User Map surface
- no exposure of `internal_only` `UserMapConclusion` rows
- no promotion/review write actions
- no runtime dark-engine trigger work
- no mobile changes
- no agents/lenses/domain retrieval
- no Intelligence Library/domain retrieval expansion
- no schema or migration changes

## 3) Surface Findings

### A. Today (`/`)

Live/backend-derived:
- `Surfacing now` is fetched from live endpoints:
  - `/api/journal/entries?limit=1`
  - `/api/contradiction?top=3&mode=read_only`
  - `/api/patterns`
- card links use real object IDs (`/contradictions/{id}`, `/patterns/{id}`)
- quick-check-in entry points link into real check-in route state

Partial:
- quick-check-in state labels/colors are static UI mapping (presentation only)
- no action-derived card yet (surface currently journal/tension/pattern focused)

Static/mock/synthetic:
- capture media path is intentionally not wired (`Saving media is not wired yet`)
- receipt links from Today rely on Library receipt item IDs that are currently partly synthetic downstream

Backend/API risks:
- Today depends on mixed endpoint response shapes (`/api/contradiction` top-array vs paged list); assumptions must remain explicit

UX risks:
- Today can link into receipt items that feel canonical even when generated from synthetic Library composition

Safe fixes (defer for this first pass):
- preserve existing Today cards
- avoid adding new card types until receipt integrity is improved

### B. Timeline (`/timeline`)

Live/backend-derived:
- `/api/timeline` is live and user-scoped
- check-ins, imported sessions, optional app sessions, optional journal entries are real backend data
- `stateSummary` is backend-computed and used for repeated signals/possible links
- activity links route to real surfaces (`/check-ins`, `/journal`, `/journal-chat`, `/explore`, `/library`)

Partial:
- relationship chips/labels are computed presentation over backend summary data

Static/mock/synthetic:
- `RhythmGraph` is seeded/decorative and not directly plotted from timeline payload values

Backend/API risks:
- optional fields (`appActivity`, `journalEntries`) are query-flag gated; clients must keep honest fallbacks

UX risks:
- decorative graph can be interpreted as measured truth if not contextualized by surrounding real metrics

Safe fixes (defer for this first pass):
- keep Timeline free of User Map/ModelUpdate/Investigation event layers for now
- do not expand intelligence layers before review/promotion flows exist

### C. Library / Receipts / Evidence (`/history`, `/library`, `/evidence`)

Live/backend-derived:
- journal/check-in/session/imported activity are loaded from live APIs
- evidence browser (`/evidence`, `/api/evidence`, `/api/evidence/[id]`) is live and evidence-span based

Partial:
- Library aggregation is mostly real but receipts are composed client-side from multiple endpoints
- receipt detail objects are synthesized in helper code rather than read from a dedicated backend receipt contract

Static/mock/synthetic:
- `fetchReceiptItems()` creates synthetic action receipt dates (`new Date().toISOString()`, `"recent"`, `Date.now()`)
- receipt rows frequently use first-item heuristics (first claim receipt / first tension evidence) instead of consistent backend-backed receipt semantics
- linked items for action receipts can be empty/synthetic

Backend/API risks:
- current helper assumes heterogeneous endpoint shapes and flattens into one receipt model without strict invariants
- risk of UI presenting synthetic receipt chronology as factual provenance

UX risks:
- trust-layer perception risk: receipts appear authoritative even when partially fabricated client-side

Safe fixes:
- make receipts strictly backend-anchored or explicitly absent
- remove synthetic receipt timestamps and synthetic fallback receipt entries
- keep empty states explicit/honest where backend evidence is absent

## 4) Recommended First Implementation Scope

**Scope choice:** Library receipt backend-alignment cleanup.

What this scope does:
- tighten `Library`/`Receipt` composition to only show receipt rows backed by real persisted source evidence
- remove synthetic action receipt objects and synthetic timestamps
- make receipt detail/summary behavior honest when evidence is missing

What this scope does not do:
- no Today/Timeline expansion
- no new intelligence generation
- no User Map/public model surface changes

## 5) Exact Implementation Boundaries

Likely files to change:
- `lib/library-surface.ts` (primary)
- `app/(root)/(routes)/library/page.tsx` (empty-state/copy alignment if needed)
- `app/(root)/(routes)/library/[id]/page.tsx` (receipt detail rendering for honest absence handling)

APIs/helpers likely involved (read-only usage, no contract expansion required in this step):
- `/api/patterns`
- `/api/contradiction?status=open&limit=...`
- `/api/contradiction/[id]`
- `/api/actions`
- existing evidence endpoints only as current truth references

Must remove/replace:
- synthetic receipt timestamps (`Date.now()`, `"recent"`, new synthetic ISO timestamps)
- synthetic action receipt entries that are not anchored to persisted evidence/receipt data
- fake linked metadata where no real relation exists

Must not touch:
- internal review page/API routes
- public User Map visibility filtering behavior
- runtime trigger logic
- schema/prisma migrations
- mobile surfaces

Required tests for this scope:
- add focused tests for Library receipt aggregation logic:
  - no synthetic receipt timestamps
  - no synthetic receipt rows when backend evidence is absent
  - deterministic mapping of receipt item IDs to real backend source IDs
  - honest empty-state behavior in receipt detail lookup
- preserve and run existing regression tests covering:
  - timeline route behavior
  - nav/internal route visibility guards
  - understanding-link additive gating behavior on existing endpoints

Required validation:
- manual spot-check Library list + Library receipt detail
- verify receipt links from Today resolve only when real receipt data exists
- verify no internal User Map candidate data appears on Library/History surfaces

## 6) Internal User Map Safety (Must Hold)

Throughout this polish pass:
- `internal_only` `UserMapConclusion` rows remain hidden from public routes and product surfaces
- no User Map candidate data appears in Today/Timeline/Library
- `/internal/user-map/review` remains hidden from normal navigation and internal-reviewer gated only

## 7) Test Plan for Chosen Scope

Add/adjust tests to prove:
- removed synthetic fallback receipt content does not render
- receipt navigation uses real backend-backed IDs only
- empty states are explicit when receipts/evidence are unavailable
- API response shape assumptions are handled safely (array vs envelope where applicable)
- no internal-only understanding data leaks into Library/History/Today paths
- existing live surfaces still render for journal/check-ins/sessions/evidence

## 8) Output Decision

Recommended next prompt title:
- **Step 8 Prompt 3 — Implement Library Receipt Backend-Alignment Cleanup (Remove Synthetic Receipt Rows)**

Exact first implementation step:
- Write focused failing tests for `lib/library-surface.ts` receipt aggregation/detail behavior (synthetic timestamp/row removal + honest empty states), then refactor the helper to satisfy them without API/schema expansion.
