# Phase 2M — Candidate Promotion/Rejection Semantics Contract

**Status:** CONTRACT COMPLETE (DOCS ONLY)  
**Date:** 2026-05-29  
**Scope:** Docs-only semantic contract defining what promotion, rejection, expiry, hold, and supersession mean for `UserMapConclusion` candidates. No code, schema, routes, UI, or runtime behavior changes.

---

## 1. Purpose

This contract defines the **semantic meaning** of each `CandidateLifecycleStatus` transition for `UserMapConclusion` candidates, grounded in the current implemented truth. It answers:

1. Does promoted change only `candidateLifecycleStatus`, or also `visibility`/`status`?
2. Can a promoted candidate become user-visible immediately?
3. Does promotion create `ModelUpdate` records now, later, or never in this slice?
4. What does `rejected` mean?
5. What does `held_for_more_evidence` mean?
6. What does `expired` mean?
7. What does `superseded` mean?
8. What evidence/provenance must remain attached?
9. What is the safest next implementation slice after this contract?

---

## 2. Files Inspected

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Current schema: `UserMapConclusion`, `CandidateLifecycleStatus`, `UserMapConclusionStatus`, `UserMapConclusionVisibility` |
| `lib/candidate-lifecycle-transitions.ts` | Phase 2K transition policy (`transitionOrThrow`, `canTransition`, `getAllowedNextStatuses`) |
| `lib/candidate-lifecycle-persistence.ts` | Phase 2L persistence helper (`updateCandidateLifecycleStatus`) |
| `lib/understanding-dark-engine/user-map-candidate-persistence.ts` | Dark-engine candidate creation (`persistInternalUserMapConclusionCandidate`, `mapDecisionToPersistedStatus`) |
| `lib/understanding-engine-api.ts` | Existing `UserMapConclusionStatus` transition rules (`isAllowedUserMapTransition`, `USER_MAP_TRANSITIONS`) |
| `lib/internal-user-map-review-candidates.ts` | Internal review candidate query (filters by `visibility: internal_only`) |
| `lib/public-evidence-continuity.ts` | Public evidence projection (filters by `visibility: user_visible`) |
| `lib/public-linked-object-continuity.ts` | Public linked object projection (filters by `visibility: user_visible`) |
| `app/api/user-map/conclusions/route.ts` | User-facing GET (filters by `visibility: user_visible`) and POST (sets `visibility: user_visible`) |
| `app/api/user-map/conclusions/[id]/route.ts` | User-facing GET/PATCH (filters by `visibility: user_visible`) |
| `app/api/model-updates/route.ts` | ModelUpdate creation route (POST creates with user-supplied visibility) |
| `app/api/internal/user-map/review-candidates/route.ts` | Internal review route (filters by `visibility: internal_only`) |
| `docs/phase2e-candidate-storage-policy-contract.md` | Phase 2E storage/lifecycle policy |
| `docs/phase2i-candidate-lifecycle-schema-design-audit.md` | Phase 2I lifecycle/schema audit |

---

## 3. Current Implemented Truth

### 3.1 Schema State

```prisma
enum CandidateLifecycleStatus {
  proposed
  held_for_more_evidence
  rejected
  promoted
  superseded
  expired
}

model UserMapConclusion {
  // ... existing fields ...
  status                   UserMapConclusionStatus    // hypothesis | tentative | emerging | supported | disputed | superseded
  visibility               UserMapConclusionVisibility // internal_only | user_visible
  candidateLifecycleStatus CandidateLifecycleStatus?  // nullable — Phase 2I/2J added
  // ... supersession links, evidence, confidence, etc.
}
```

### 3.2 Current Visibility Semantics

| Visibility | Meaning | Used by |
|------------|---------|---------|
| `internal_only` | Dark-engine candidates, not user-facing | `listInternalUserMapReviewCandidates`, dark-engine persistence |
| `user_visible` | User-facing conclusions | `GET /api/user-map/conclusions`, `POST /api/user-map/conclusions`, `PATCH /api/user-map/conclusions/[id]`, public evidence/linked-object projections |

**Key constraint:** The user-facing routes (`GET`, `POST`, `PATCH` on `/api/user-map/conclusions`) **always** filter by or set `visibility: user_visible`. The internal review route **always** filters by `visibility: internal_only`. These two visibility domains are strictly separated.

### 3.3 Current Status Semantics (UserMapConclusionStatus)

| Status | Meaning | Created by |
|--------|---------|------------|
| `hypothesis` | Earliest candidate state | Manual user creation |
| `tentative` | Weak evidence, low confidence | Dark engine (`pass_with_cap`) |
| `emerging` | Moderate evidence, passing gates | Dark engine (`pass`) |
| `supported` | Strong evidence | Manual user promotion |
| `disputed` | Contradicted | Manual user action |
| `superseded` | Replaced | Manual user action |

### 3.4 Current CandidateLifecycleStatus Semantics

| Status | Meaning | Set by |
|--------|---------|--------|
| `proposed` | Default for new dark-engine candidates | `persistInternalUserMapConclusionCandidate` |
| `held_for_more_evidence` | — | Not yet wired |
| `rejected` | — | Not yet wired |
| `promoted` | — | Not yet wired |
| `superseded` | — | Not yet wired |
| `expired` | — | Not yet wired |

### 3.5 Current Transition Rules

**Existing `UserMapConclusionStatus` transitions** (in `lib/understanding-engine-api.ts`):
```
hypothesis → tentative, disputed, superseded
tentative  → emerging, disputed, superseded
emerging   → supported, disputed, superseded
supported  → disputed, superseded
disputed   → disputed, superseded, tentative, emerging
superseded → (terminal)
```

**New `CandidateLifecycleStatus` transitions** (in `lib/candidate-lifecycle-transitions.ts`):
```
proposed → held_for_more_evidence, rejected, expired
held_for_more_evidence → proposed, rejected, expired, promoted
rejected → proposed (new cycle only)
promoted → superseded
expired → proposed (new cycle only)
superseded → (terminal)
```

### 3.6 Current ModelUpdate Creation

- `POST /api/model-updates/route.ts` creates `ModelUpdate` records with user-supplied visibility
- No existing code creates `ModelUpdate` records automatically from candidate lifecycle transitions
- `ModelUpdateVisibility` has `internal_only`, `candidate`, `user_visible` — but no lifecycle status field

---

## 4. Semantic Decisions

### 4.1 What does `promoted` mean?

**Decision:** `promoted` changes **only** `candidateLifecycleStatus`. It does **not** change `visibility` or `status`.

**Rationale:**
- `visibility` is a separate concern from lifecycle state. A promoted candidate may still need review before becoming user-visible.
- `status` (`UserMapConclusionStatus`) represents the conclusion's maturity/strength within the user's mental model. `candidateLifecycleStatus` represents the dark-engine's confidence in the candidate. These are orthogonal.
- Changing `visibility` automatically would bypass the user's review and violate the "no auto-promotion" safety constraint.

**Concrete behavior:**
- `updateCandidateLifecycleStatus(userId, conclusionId, "promoted")` sets `candidateLifecycleStatus = "promoted"` only.
- `visibility` remains `internal_only`.
- `status` remains whatever it was (e.g., `tentative` or `emerging`).
- The candidate is still only visible on the internal review page, not on user-facing conclusion routes.

### 4.2 Can a promoted candidate become user-visible immediately?

**Decision:** **No.** Promotion and user-visibility are separate gates.

**Rationale:**
- The user-facing routes (`GET /api/user-map/conclusions`) filter by `visibility: user_visible`. A promoted candidate with `visibility: internal_only` will not appear.
- Making a candidate user-visible requires an explicit separate action (e.g., a future "publish" or "accept" workflow) that changes `visibility` to `user_visible`.
- This separation allows the user to review promoted candidates before they appear in their mental model.

**Future workflow (not implemented here):**
```
candidateLifecycleStatus: proposed → promoted (dark engine decides)
visibility: internal_only → user_visible (user reviews and accepts)
```

### 4.3 Does promotion create ModelUpdate records now, later, or never in this slice?

**Decision:** **Never in this slice.** ModelUpdate creation is a separate concern.

**Rationale:**
- `ModelUpdate` records represent changes to the user's mental model. A candidate being promoted by the dark engine is not yet a change to the user's model — it's a change to the dark engine's confidence.
- ModelUpdate creation should happen when a candidate becomes user-visible (or when the user explicitly accepts it), not when the dark engine promotes it internally.
- Creating ModelUpdate records automatically would violate the "no auto-promotion" constraint and could flood the user's timeline with internal dark-engine decisions.

**Future consideration:** When a candidate transitions from `internal_only` to `user_visible`, a `ModelUpdate` of type `conclusion_added` or `conclusion_strengthened` may be appropriate. This is deferred to a later phase.

### 4.4 What does `rejected` mean?

**Decision:** `rejected` means the dark engine has determined that this candidate does not meet the required gates for promotion and should not be considered further.

**Semantics:**
- The candidate failed one or more gates (objectivity, source safety, evidence spread, meaningful delta, etc.).
- The candidate remains queryable (not soft-deleted) for audit/debug purposes.
- The candidate's `visibility` remains `internal_only`.
- The candidate's `status` (`UserMapConclusionStatus`) is unchanged.
- Evidence links remain attached for provenance.
- The candidate can be re-proposed only via a new candidate cycle (fresh evidence, new evaluation).

**What `rejected` does NOT mean:**
- It does not mean the conclusion is wrong — only that the dark engine cannot confidently promote it.
- It does not delete or hide the candidate — it remains visible on the internal review page.
- It does not change `visibility` or `status`.

### 4.5 What does `held_for_more_evidence` mean?

**Decision:** `held_for_more_evidence` means the candidate shows promise but does not yet have sufficient evidence or confidence for promotion.

**Semantics:**
- The candidate passed baseline gates (source safety, basic objectivity) but failed higher bars (evidence spread, confidence threshold, meaningful delta).
- The candidate is in a "waiting" state — it may be re-evaluated when new evidence arrives.
- The candidate's `visibility` remains `internal_only`.
- Evidence links remain attached.
- The candidate can transition back to `proposed` (new evidence triggers re-evaluation) or forward to `rejected`/`expired`/`promoted`.

**Distinction from `proposed`:**
- `proposed` = just created, not yet evaluated against higher gates.
- `held_for_more_evidence` = evaluated, passed baseline, but insufficient for promotion.

### 4.6 What does `expired` mean?

**Decision:** `expired` means the candidate has timed out without sufficient evidence for promotion.

**Semantics:**
- The candidate has been in `proposed` or `held_for_more_evidence` beyond a recency/staleness threshold.
- The candidate remains queryable (not soft-deleted).
- The candidate's `visibility` remains `internal_only`.
- Evidence links remain attached.
- The candidate can be re-proposed only via a new candidate cycle.

**Expiry policy (deferred):**
- The exact timeout duration (e.g., 30 days in `proposed` without promotion → `expired`) is not defined in this contract. It will be defined when the expiry trigger is implemented.
- Expiry must be trigger-based or explicit, not automatic time-based in this phase (per Phase 2I safety constraint #7).

### 4.7 What does `superseded` mean?

**Decision:** `superseded` means this candidate has been replaced by a newer candidate.

**Semantics:**
- The candidate is no longer under active consideration.
- The candidate remains queryable for lineage/audit purposes.
- The candidate's `visibility` remains `internal_only`.
- Evidence links remain attached.
- The supersession link (`supersededById`/`supersedesId`) should be set to point to the replacing candidate.
- `superseded` is a terminal state — no further transitions are allowed.

**Distinction from existing `UserMapConclusionStatus.superseded`:**
- `UserMapConclusionStatus.superseded` is a user-facing status set manually by the user.
- `CandidateLifecycleStatus.superseded` is a dark-engine lifecycle status.
- These are orthogonal — a candidate could have `status: emerging` and `candidateLifecycleStatus: superseded` (the dark engine replaced it, but the user's conclusion status is unchanged).

### 4.8 What evidence/provenance must remain attached?

**Decision:** All existing evidence links must remain attached through all lifecycle transitions.

**Current evidence linkage:**
- `UnderstandingEvidenceLink` records link evidence sources to `UserMapConclusion` targets.
- These links are created during `persistInternalUserMapConclusionCandidate`.
- The internal review page (`listInternalUserMapReviewCandidates`) queries evidence links by `targetId`.

**Rules:**
- No lifecycle transition may delete or detach evidence links.
- `rejected` candidates retain their evidence links for audit/debug.
- `expired` candidates retain their evidence links.
- `superseded` candidates retain their evidence links for lineage.
- `promoted` candidates retain their evidence links — these become the provenance for any future user-visibility transition.
- Raw `snippet`/`quote` in evidence links remain internal-only per Phase 2E policy.

---

## 5. Transition Semantics Summary

| Transition | Changes `candidateLifecycleStatus` | Changes `visibility` | Changes `status` | Creates ModelUpdate | Evidence preserved |
|------------|-----------------------------------|---------------------|-------------------|---------------------|-------------------|
| `proposed → held_for_more_evidence` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `proposed → rejected` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `proposed → expired` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `held_for_more_evidence → proposed` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `held_for_more_evidence → rejected` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `held_for_more_evidence → expired` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `held_for_more_evidence → promoted` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `rejected → proposed` (new cycle) | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `promoted → superseded` | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |
| `expired → proposed` (new cycle) | ✅ yes | ❌ no | ❌ no | ❌ no | ✅ yes |

---

## 6. Forbidden Premature Behaviors

The following behaviors are explicitly forbidden in this slice and must not be implemented:

| Behavior | Why forbidden |
|----------|---------------|
| Changing `visibility` to `user_visible` on promotion | Would bypass user review; violates "no auto-promotion" |
| Changing `status` (`UserMapConclusionStatus`) on lifecycle transition | Orthogonal concerns; `status` is user-facing, `candidateLifecycleStatus` is dark-engine |
| Creating `ModelUpdate` records on lifecycle transition | ModelUpdate = user model change; promotion is internal dark-engine decision |
| Soft-deleting or hiding `rejected`/`expired` candidates | Must remain queryable for audit/debug |
| Deleting evidence links on any transition | Provenance must be preserved |
| Auto-expiring candidates via scheduler/cron | Expiry must be trigger-based or explicit in this phase |
| Exposing `candidateLifecycleStatus` in user-facing API responses | Would leak internal dark-engine state to user-facing surfaces |
| Filtering user-facing routes by `candidateLifecycleStatus` | User-facing routes filter by `visibility: user_visible` only |
| Creating a promotion/rejection API route | This contract defines semantics only; implementation is next slice |
| Adding `candidateLifecycleStatus` to `Investigation`/`ModelUpdate`/`FieldworkAssignment` | Deferred per Phase 2I recommendation; `UserMapConclusion` only for now |

---

## 7. Recommended Next Implementation Slice

### Phase 2N — Candidate Promotion/Rejection Action (Internal API)

**Goal:** Wire `updateCandidateLifecycleStatus` into an internal API action that allows the dark engine (or an internal review tool) to promote, reject, hold, or expire candidates.

**Allowed:**
- Create an internal API route (e.g., `POST /api/internal/user-map/candidates/[id]/lifecycle`) that calls `updateCandidateLifecycleStatus`
- Accept `newStatus` in the request body
- Validate the transition using `transitionOrThrow`
- Return the updated candidate
- Add tests for the route

**Forbidden:**
- No changes to user-facing routes (`/api/user-map/conclusions`)
- No changes to `visibility` or `status`
- No `ModelUpdate` creation
- No public/mobile projection
- No auto-promotion or auto-expiry
- No schema changes

**Verification:**
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`

---

## 8. Open Questions (Deferred)

1. **Expiry policy:** What is the exact timeout duration for `proposed → expired` and `held_for_more_evidence → expired`? Should it be configurable per candidate family?
2. **Promotion → user-visible workflow:** Should there be a separate "accept" action that changes `visibility` to `user_visible` and creates a `ModelUpdate`? Or should promotion automatically trigger a notification?
3. **Batch operations:** Should the lifecycle action support batch transitions (e.g., "reject all candidates older than 30 days")?
4. **Rejection reason:** Should `rejected` candidates store a rejection reason/code for audit?
5. **Cross-family lifecycle:** When should `Investigation`, `ModelUpdate`, and `FieldworkAssignment` get lifecycle support?
