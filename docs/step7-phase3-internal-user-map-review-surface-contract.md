# MindLab Step 7 — Phase 3 Internal User Map Review Surface Contract

## 1. Purpose and Boundary

This document locks the **first Phase 3 surface** for inspecting Phase 2 dark-engine candidate outputs without exposing those candidates in default user-facing flows.

Phase 3 step 1 is:
- internal review/debug visibility for `internal_only` `UserMapConclusion` candidates
- read-only inspection of candidate metadata, provenance links, and write diagnostics
- contract-safe bridge between Phase 2 persistence and later user-facing User Map decisions

Phase 3 step 1 is not:
- public User Map rollout
- candidate promotion flow
- candidate editing/deletion workflow
- runtime trigger wiring
- mobile implementation
- agent/lens or Intelligence Library/domain retrieval work

## 2. Source Authority

For Step 7 implementation prompts, use this precedence:
1. `docs/step7-phase3-internal-user-map-review-surface-contract.md` (this document)
2. `docs/step6-phase2-dark-engine-gates-contract.md`
3. `docs/step4b-phase1b-additive-api-contract.md`
4. `docs/step4-phase0-contract-lock.md`
5. `docs/step5-foundation-closeout-and-next-work-map.md`

## 3. Current Preconditions (Locked)

This contract assumes the following are already true and must remain true:
- `UserMapConclusion.visibility` exists with `user_visible | internal_only`.
- Default public routes hide internal rows:
  - `GET /api/user-map/conclusions` returns `user_visible` only.
  - `GET /api/user-map/conclusions/[id]` does not expose `internal_only`.
- Phase 2 candidate persistence writes `UserMapConclusion.visibility=internal_only`.
- Evidence links are written via shared `lib/understanding-evidence-link-writer.ts`.

## 4. First Surface Decision

### Decision
**Option A** is locked for Phase 3 step 1:
- no internal web page yet
- introduce a **restricted internal/debug API read surface only** for candidate review

### Rationale
- Hidden/unlinked UI alone is not a sufficient access boundary.
- Existing public/default User Map APIs must stay unchanged.
- A restricted GET-only internal API is the smallest safe mechanism for inspection without public exposure.

## 5. Surface Boundary (Step 1)

Step 1 review surface must be:
- internal/debug only
- read-only (`GET` only)
- scoped to candidate inspection and evidence inspection

Step 1 must not include:
- promotion controls (`internal_only -> user_visible`)
- candidate text editing
- candidate deletion/rejection actions
- write endpoints (`POST`, `PATCH`, `DELETE`) for this surface
- nav exposure in core/secondary user navigation

## 6. Access Model Contract

Internal review API access must require:
- authenticated user
- explicit internal reviewer gate (for example allowlist via server config)

Additional access constraints:
- no cross-user review mode in step 1
- no `userId` query override
- results must remain user-owned only

Failure behavior:
- unauthorized: `401`
- authenticated but not internal reviewer: `404` or `403` (pick one and lock in implementation prompt; prefer non-disclosing behavior)

## 7. Data Contract

### 7.1 Allowed data (read-only)

The review surface may return:
- internal candidate rows (`visibility=internal_only`) with:
  - `id`
  - `area`
  - `status`
  - `confidenceScore`
  - `confidenceLevel`
  - `title`
  - `summary`
  - `evidenceCount`
  - `sourceDiversity`
  - `timeSpreadDays`
  - `createdAt`
  - `updatedAt`
  - `firstEvidenceAt`
  - `lastEvidenceAt`
  - `notes` (optional/sanitized)
- evidence-link summary for each candidate:
  - total link count
  - link count by `sourceType`
  - link count by `role`
- diagnostics/run metadata when safely available:
  - run id reference (for example from notes or linked artifact path)
  - artifact id/type when resolvable
  - blocked/duplicate/write counters when resolvable from persisted diagnostics payload

Optional:
- short snippets already persisted in `UnderstandingEvidenceLink` (`summary` / `snippet` / `quote`) only within current receipt/evidence display constraints.

### 7.2 Blocked data/actions

The review surface must not provide:
- publish/promotion buttons
- editing or deletion controls
- fieldwork/action generation controls
- model-update generation controls
- synthesized lens/agent outputs
- fake or inferred provenance

Contract note:
- `timeline_aggregation` and `user_correction` remain non-persisted context sources for evidence links in this phase boundary.

## 8. API Contract (Phase 3 Step 1)

Phase 3 step 1 may introduce restricted internal endpoints such as:
- `GET /api/internal/user-map/review-candidates`
- `GET /api/internal/user-map/review-candidates/[id]` (optional if list response is sufficient)

Endpoint rules:
- `GET` only
- internal reviewer access gate required
- user-scoped ownership required
- query/read behavior must not modify DB state

Public/default API lock:
- `GET /api/user-map/conclusions` remains unchanged and continues to hide `internal_only`.
- `GET /api/user-map/conclusions/[id]` remains unchanged and continues to block `internal_only`.
- no public route additions for internal candidate visibility in this step.

## 9. Evidence Display Contract

Evidence for a candidate must be loaded from persisted `UnderstandingEvidenceLink` data using:
- `targetType = usermap_conclusion`
- `targetId = candidate.id`

Evidence display rules:
- user ownership must be enforced
- no link creation on review surface
- no fallback/fake provenance mapping
- any unresolved integrity cases should be surfaced as warnings, not repaired in this step

## 10. Promotion / Edit / Delete Deferrals

Deferred beyond this step (Phase 3B+):
- promotion flow (`internal_only -> user_visible`)
- candidate text/status edits from review UI
- candidate delete/reject workflow
- explicit review state tracking (for example reviewed/approved/rejected flags)

## 11. Required Tests for Step 1 Implementation

Future implementation must include tests for:
- internal review endpoint access gating
- endpoint returns only `visibility=internal_only` candidates
- endpoint remains read-only (`GET` only)
- evidence link loading correctness by `targetType + targetId`
- diagnostics metadata inclusion when available (and null-safe behavior when unavailable)
- no writes from review endpoints
- default public User Map list/detail routes still hide `internal_only`
- no visible nav exposure for this internal surface
- no mobile/API public leakage
- no runtime trigger creation

## 12. Phase 3 Non-Goals Lock (Step 1)

Locked non-goals for this step:
- no mobile implementation
- no public User Map rollout
- no promotion flow
- no runtime triggers
- no new Investigation/ModelUpdate/Fieldwork persistence behaviors
- no agents/lenses
- no Intelligence Library/domain retrieval

