# Phase 3 Public Intelligence Surfaces Contract

Date: 2026-05-17
Type: Public surface contract (audit/contract only)
Scope: `/Users/user/ai-companion`
Audit verdict: `READY FOR PHASE 3 CONTRACT DOC`

## 1. Purpose

This contract defines the safe public rollout for Phase 3 intelligence surfaces.

The objective is to expose user-visible understanding in a read-only-first way while preserving trust boundaries:
- no leakage of internal candidates,
- no synthetic canonical intelligence,
- no certainty claims beyond backend evidence,
- additive integration with existing trusted surfaces.

## 2. Current Roadmap Position

Current roadmap position is locked as:
- Existing-surface mobile trust cleanup is `CLOSED / VALIDATED`.
- Full Phase 6 mobile parity remains `IN PROGRESS`.
- Phase 3 public web intelligence surfaces are the current workstream.
- Broader mobile intelligence parity should wait until upstream web/product contracts are stable.

## 3. Phase 3 Public Surface Order

Execution order for this contract:
- `4.` Active Questions
- `5.` Watch For
- `6.` Your Map
- `7.` What Changed
- `8.` Today intelligence cards
- `9.` Timeline model layers

## 4. Global Rules

- Public surfaces must not read `/api/internal/user-map/review-candidates`.
- Public surfaces must not expose `internal_only` rows.
- Raw candidates must not be shown as user-visible truth.
- Promotion remains out of scope for this pass.
- Links must be real-ID gated.
- IDs must not be derived from labels or titles.
- No fake canonical insights.
- No synthetic receipts.
- Production receipts remain pattern/tension only: `receipt-pattern-*`, `receipt-tension-*`.
- No `receipt-action-*` support.
- Empty states must be honest.
- First implementation slice must be read-only and additive.

## 5. Surface Contracts

### A. Active Questions

- User-facing purpose: show active investigation threads and open inquiry loops.
- Data source: `GET /api/investigations`, `GET /api/investigations/[id]`.
- Visibility gate: authenticated, user-owned records only.
- What can be shown now: read-only investigation list/detail with real persisted statuses.
- What must remain hidden/internal: synthetic theories, inferred resolution states, internal candidate-only reasoning outputs.
- IDs / links / receipts: use only real `investigation.id`; no inferred deep links; no new receipt semantics required.
- Empty state: `No active questions yet.`
- Non-goals: promotion flows, write actions, runtime synthesis changes.
- Overclaiming risk: presenting normal status churn as validated understanding movement.
- Smallest safe first slice: read-only list + detail, no write controls.

### B. Watch For

- User-facing purpose: show active observation prompts linked to real uncertainty/evidence gaps.
- Data source: `GET /api/fieldwork`, `GET /api/fieldwork/[id]`.
- Visibility gate: authenticated, user-owned records only.
- What can be shown now: `assigned`/`active` prompts, reason text, linked object reference.
- What must remain hidden/internal: synthetic prompts, action-like assignment framing, inferred outcomes.
- IDs / links / receipts: use real `fieldwork.id` and real linked object IDs only; no new receipt ID semantics.
- Empty state: `No watch-for prompts right now.`
- Non-goals: action execution UX, experimental semantics expansion.
- Overclaiming risk: implying intervention effectiveness from uncompleted observation prompts.
- Smallest safe first slice: read-only active prompt list, no write controls.

### C. Your Map

- User-facing purpose: show stable, user-visible understanding conclusions.
- Data source: `GET /api/user-map/conclusions`, `GET /api/user-map/conclusions/[id]`.
- Visibility gate: public surface must use `user_visible` conclusions only.
- What can be shown now: read-only list/detail for persisted `user_visible` conclusions.
- What must remain hidden/internal: `internal_only` rows, internal reviewer APIs/pages, candidate review diagnostics.
- IDs / links / receipts: use real `conclusion.id`; no label-derived IDs; no fabricated conclusion receipts.
- Empty state: `No confirmed map items yet.`
- Non-goals: promotion/edit/delete/reject controls.
- Overclaiming risk: treating low-evidence or candidate-like records as confirmed truth.
- Smallest safe first slice: read-only list + detail with strict visibility filter and honest empty state.

### D. What Changed

- User-facing purpose: show meaningful model movement events.
- Data source: `GET /api/model-updates`, optional `GET /api/model-updates/[id]`.
- Visibility gate: public consumer must request/filter `visibility=user_visible`.
- What can be shown now: meaningful, persisted user-visible updates with real affected object references.
- What must remain hidden/internal: `internal_only` and `candidate` updates in public feed.
- IDs / links / receipts: use real `modelUpdate.id` and real `affectedObjectType` + `affectedObjectId` links only.
- Empty state: `No meaningful changes yet.`
- Non-goals: synthetic insight feed behavior, decorative daily novelty.
- Overclaiming risk: surfacing backend churn as meaningful cognitive change.
- Smallest safe first slice: read-only chronological list, visibility-filtered to `user_visible`.

### E. Today Intelligence Cards

- User-facing purpose: provide concise daily intelligence summary from trusted source surfaces.
- Data source: existing Today data + additive reads from Active Questions, Watch For, and What Changed public data.
- Visibility gate: inherit source-surface visibility rules; no internal endpoints.
- What can be shown now: additive cards only when real backend rows exist.
- What must remain hidden/internal: candidate/internal rows, synthetic canonical fallback cards.
- IDs / links / receipts: strict real-ID links; preserve receipt constraints (`receipt-pattern-*`, `receipt-tension-*` only).
- Empty state: `No intelligence updates yet.`
- Non-goals: new synthesis engine behavior, label-derived deep links.
- Overclaiming risk: combining weak signals into certainty-looking summary language.
- Smallest safe first slice: additive read-only card strip after source surfaces are stable.

### F. Timeline Model Layers

- User-facing purpose: show model/investigation/fieldwork movement as explicit timeline layers.
- Data source: existing timeline baseline plus additive model feeds (model updates/investigations/fieldwork) until a dedicated combined contract is approved.
- Visibility gate: `user_visible` where applicable, authenticated user ownership everywhere.
- What can be shown now: separate read-only model movement lane with explicit event typing.
- What must remain hidden/internal: internal/candidate events, synthetic causality/forecast claims.
- IDs / links / receipts: real IDs only; non-link state when target cannot be safely resolved.
- Empty state: `No model movement in this window.`
- Non-goals: decorative certainty signals or forecast overlays.
- Overclaiming risk: presenting temporal co-occurrence as proven causation.
- Smallest safe first slice: additive read-only model lane after core source surfaces are stable.

## 6. Visibility and Promotion Policy

- `internal_only` remains internal.
- `user_visible` is required for public conclusions and for public model updates where applicable.
- Promotion (`internal_only -> user_visible`) is not built in this pass.
- Public UI must not imply candidate records are confirmed truth.

## 7. Backend/API Expectations

- First safe slice should avoid schema changes if possible.
- Use existing public/additive endpoints where available.
- Public What Changed consumer must request/filter `visibility=user_visible`.
- Optional later hardening: backend defaults should exclude candidate/internal records unless explicitly requested by internal tooling.

## 8. Frontend Expectations

- Build new read-only public surfaces for Active Questions and Watch For first.
- Your Map follows after visibility/empty-state confidence is locked.
- Today and Timeline should consume additive intelligence cards/lanes only after source surfaces are stable.
- Internal review routes remain hidden and non-navigable from public product entry points.

## 9. Receipt/Link Expectations

- Existing receipt trust cleanup must be preserved.
- Use only real IDs for links.
- If a target is missing, render an honest non-link state.
- No action receipt semantics in production public surfaces.

## 10. Risks and Mitigations

- Candidate leakage: enforce strict visibility filtering (`internal_only` never public, `user_visible` only for public model feed).
- Overclaiming: use evidence-aligned copy and explicit empty states instead of synthetic cards.
- Fake links: enforce ID-gated linking and null-safe non-link fallbacks.
- Scope creep: keep first pass read-only, additive, and limited to defined surfaces.
- Regression to trust surfaces: preserve existing Pattern/Tension/Action/Timeline/Library trust-cleanup behavior and receipt constraints.

## 11. Safe Slice 1 Recommendation

Safe Slice 1 definition:
- Read-only Active Questions list/detail
- Read-only Watch For list
- no writes
- no promotion
- no Today/Timeline integration yet
- no mobile work yet

## 12. Non-Goals

Explicitly deferred:
- public User Map promotion controls
- Phase 4 Actions/Experiments expansion
- Phase 5 continuity expansion for new Understanding objects
- Phase 7 agents/lenses
- broad mobile intelligence parity

## 13. First Implementation Prompt Title

`Phase 3 Public Intelligence Surfaces — Implement Read-Only Active Questions + Watch For Safe Slice`
