# Phase 2P — Publish/Acceptance Semantics Contract

**Status:** CONTRACT COMPLETE (DOCS ONLY)  
**Date:** 2026-05-29  
**Scope:** Docs-only semantic contract defining what it means to turn a promoted `UserMapConclusion` candidate into a user-visible conclusion. No code, schema, routes, UI, or runtime behavior changes.

---

## 1. Purpose

This contract defines the **semantic meaning** of publishing (accepting) a promoted candidate — the act of making a dark-engine-promoted `UserMapConclusion` visible to the user on their Your Map surface. It answers:

1. What preconditions must be true before a candidate can be published?
2. Does publishing require `candidateLifecycleStatus = promoted`?
3. What exact field changes happen on publish?
4. Does publishing change `visibility`, `status`, both, or neither?
5. Does publishing create a ModelUpdate now, later, or never in this slice?
6. What evidence/provenance must remain attached?
7. Can publishing be reversed?
8. How is supersession handled after publishing?
9. What must public/mobile routes expose or hide?
10. What is the safest next implementation slice after this contract?

---

## 2. Files Inspected

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Current schema: `UserMapConclusion`, `CandidateLifecycleStatus`, `UserMapConclusionStatus`, `UserMapConclusionVisibility` |
| `lib/candidate-lifecycle-transitions.ts` | Phase 2K transition policy |
| `lib/candidate-lifecycle-persistence.ts` | Phase 2L persistence helper (`updateCandidateLifecycleStatus`) |
| `app/api/internal/user-map/candidates/[id]/lifecycle/route.ts` | Phase 2N internal lifecycle route |
| `app/api/user-map/conclusions/route.ts` | User-facing GET (filters by `visibility: user_visible`) and POST (sets `visibility: user_visible`) |
| `app/api/user-map/conclusions/[id]/route.ts` | User-facing GET/PATCH (filters by `visibility: user_visible`) |
| `app/api/model-updates/route.ts` | ModelUpdate creation route (POST creates with user-supplied visibility) |
| `lib/public-evidence-continuity.ts` | Public evidence projection (filters by `visibility: user_visible`) |
| `lib/public-linked-object-continuity.ts` | Public linked object projection (filters by `visibility: user_visible`) |
| `docs/phase2m-candidate-promotion-rejection-semantics-contract.md` | Phase 2M semantics contract (foundation for this contract) |
| `docs/phase2o-internal-candidate-lifecycle-route-audit.md` | Phase 2O audit (confirms Phase 2N is clean) |
| `docs/engineering-ledger.md` | Current ledger state |

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
  id                       String                        @id @default(cuid())
  userId                   String
  area                     UserMapConclusionArea
  status                   UserMapConclusionStatus       // hypothesis | tentative | emerging | supported | disputed | superseded
  visibility               UserMapConclusionVisibility   // internal_only | user_visible
  candidateLifecycleStatus CandidateLifecycleStatus?     // nullable — lifecycle-managed candidates
  title                    String
  summary                  String
  confidenceScore          Float
  confidenceLevel          UserMapConfidenceLevel
  evidenceCount            Int                           @default(0)
  sourceDiversity          Int                           @default(0)
  timeSpreadDays           Int                           @default(0)
  version                  Int                           @default(1)
  supersededById           String?
  supersedesId             String?
  firstEvidenceAt          DateTime?
  lastEvidenceAt           DateTime?
  lastUserCorrectionAt     DateTime?
  lastUserCorrectionLabel  String?
  correctionCount          Int                           @default(0)
  notes                    String?
  createdAt                DateTime                      @default(now())
  updatedAt                DateTime                      @updatedAt
  // ... supersession relations, investigation links ...
}
```

### 3.2 Current Visibility Semantics

| Visibility | Meaning | Used by |
|------------|---------|---------|
| `internal_only` | Dark-engine candidates, not user-facing | `listInternalUserMapReviewCandidates`, dark-engine persistence, lifecycle route |
| `user_visible` | User-facing conclusions | `GET /api/user-map/conclusions`, `POST /api/user-map/conclusions`, `PATCH /api/user-map/conclusions/[id]`, public evidence/linked-object projections |

**Key constraint:** The user-facing routes (`GET`, `POST`, `PATCH` on `/api/user-map/conclusions`) **always** filter by or set `visibility: user_visible`. The internal review route **always** filters by `visibility: internal_only`. These two visibility domains are strictly separated.

### 3.3 Current CandidateLifecycleStatus Semantics

| Status | Meaning | Set by |
|--------|---------|--------|
| `proposed` | Default for new dark-engine candidates | `persistInternalUserMapConclusionCandidate` |
| `held_for_more_evidence` | Passed baseline gates, insufficient for promotion | Phase 2N lifecycle route |
| `rejected` | Failed gates definitively | Phase 2N lifecycle route |
| `promoted` | Passed all gates, ready for user review | Phase 2N lifecycle route |
| `superseded` | Replaced by newer candidate | Phase 2N lifecycle route |
| `expired` | Timed out without sufficient evidence | Phase 2N lifecycle route |

### 3.4 Current Lifecycle Transition Rules

```
proposed → held_for_more_evidence, rejected, expired
held_for_more_evidence → proposed, rejected, expired, promoted
rejected → proposed (new cycle only)
promoted → superseded
expired → proposed (new cycle only)
superseded → (terminal)
```

### 3.5 Current UserMapConclusionStatus Transitions

```
hypothesis → tentative, disputed, superseded
tentative  → emerging, disputed, superseded
emerging   → supported, disputed, superseded
supported  → disputed, superseded
disputed   → disputed, superseded, tentative, emerging
superseded → (terminal)
```

### 3.6 Current ModelUpdate Creation

- `POST /api/model-updates/route.ts` creates `ModelUpdate` records with user-supplied visibility
- No existing code creates `ModelUpdate` records automatically from candidate lifecycle transitions
- `ModelUpdateVisibility` has `internal_only`, `candidate`, `user_visible`
- `ModelUpdateType` includes `conclusion_added`, `conclusion_strengthened`, `conclusion_weakened`, `conclusion_disputed`, `conclusion_superseded`

### 3.7 Current Public/Mobile Projection

- `listYourMapPublicEvidenceContinuity` (in `lib/public-evidence-continuity.ts`) filters by `visibility: user_visible`
- `resolvePublicLinkedObjectHrefs` (in `lib/public-linked-object-continuity.ts`) filters by `visibility: user_visible`
- `candidateLifecycleStatus` is **never** exposed in user-facing API responses
- User-facing routes do not filter by `candidateLifecycleStatus`

---

## 4. Semantic Decisions

### 4.1 What preconditions must be true before a candidate can be published?

**Decision:** All of the following must be true:

1. **`candidateLifecycleStatus` must be `promoted`** — the dark engine has determined the candidate passes all gates.
2. **`visibility` must be `internal_only`** — the candidate must not already be user-visible.
3. **`candidateLifecycleStatus` must be non-null** — legacy records without lifecycle management must be initialized first.
4. **The candidate must belong to the authenticated user** — ownership check enforced by the persistence layer.
5. **The user must be an allowlisted internal reviewer** — publishing is an internal action, not a user-facing self-service action in this slice.

**Rationale:**
- Precondition 1 ensures only dark-engine-verified candidates are published. A `proposed` or `held_for_more_evidence` candidate has not passed all gates.
- Precondition 2 prevents double-publishing. If `visibility` is already `user_visible`, the candidate is already on the user's map.
- Precondition 3 prevents publishing legacy records that haven't been lifecycle-managed.
- Precondition 4 is standard ownership enforcement.
- Precondition 5 ensures publishing is a deliberate internal action, not an automatic process.

**What happens if preconditions are not met:**
- If `candidateLifecycleStatus` is not `promoted`: the publish action should reject with a clear error (e.g., "Candidate must be promoted before publishing").
- If `visibility` is already `user_visible`: the publish action should reject (already published).
- If `candidateLifecycleStatus` is null: the publish action should reject (legacy record, must be initialized first).

---

### 4.2 Does publishing require `candidateLifecycleStatus = promoted`?

**Decision:** **Yes.** Publishing is the act of making a promoted candidate user-visible. Only candidates with `candidateLifecycleStatus = promoted` may be published.

**Rationale:**
- The entire lifecycle pipeline (proposed → held → promoted) exists to gate which candidates reach the user. Publishing is the final step in that pipeline.
- Allowing non-promoted candidates to be published would bypass the dark engine's gate evaluation.
- This is consistent with Phase 2M decision 4.2: "Promotion and user-visibility are separate gates." Publishing is the second gate.

**Concrete behavior:**
- A publish action must check `candidateLifecycleStatus === "promoted"` before proceeding.
- If the candidate is in any other lifecycle status (`proposed`, `held_for_more_evidence`, `rejected`, `expired`, `superseded`), the publish action must reject.

---

### 4.3 What exact field changes happen on publish?

**Decision:** Publishing changes exactly two fields:

1. **`visibility`**: `internal_only` → `user_visible`
2. **`updatedAt`**: updated to the current timestamp

**No other fields are changed.**

**Concrete Prisma update:**
```typescript
await prismadb.userMapConclusion.update({
  where: { id: conclusionId },
  data: {
    visibility: UserMapConclusionVisibility.user_visible,
    updatedAt: new Date(),
  },
});
```

**What does NOT change:**
- `candidateLifecycleStatus` remains `promoted` (unchanged)
- `status` (`UserMapConclusionStatus`) remains whatever it was (e.g., `tentative` or `emerging`)
- `title`, `summary`, `confidenceScore`, `confidenceLevel` — unchanged
- `evidenceCount`, `sourceDiversity`, `timeSpreadDays` — unchanged
- `supersededById`, `supersedesId` — unchanged
- `notes`, `version` — unchanged
- Evidence links — unchanged

---

### 4.4 Does publishing change `visibility`, `status`, both, or neither?

**Decision:** Publishing changes **`visibility` only**. It does **not** change `status` (`UserMapConclusionStatus`).

**Rationale:**
- `visibility` is the gate between internal-only and user-visible. Publishing is the act of opening that gate.
- `status` (`UserMapConclusionStatus`) represents the conclusion's maturity/strength within the user's mental model. This is orthogonal to visibility.
- A promoted candidate may have `status: tentative` (weak evidence, low confidence) or `status: emerging` (moderate evidence). Publishing makes it visible to the user, but does not change its maturity level.
- The user can later change `status` via the existing `PATCH /api/user-map/conclusions/[id]` route (which enforces `UserMapConclusionStatus` transition rules).

**Concrete behavior:**
```
Before publish:
  visibility: internal_only
  status: tentative
  candidateLifecycleStatus: promoted

After publish:
  visibility: user_visible    ← changed
  status: tentative           ← unchanged
  candidateLifecycleStatus: promoted  ← unchanged
```

**Future consideration:** A future phase may decide that publishing should also set `status` to a default value (e.g., `emerging` for promoted candidates). This is deferred — for now, publishing is purely a visibility change.

---

### 4.5 Does publishing create a ModelUpdate now, later, or never in this slice?

**Decision:** **Later.** ModelUpdate creation is deferred to a future phase.

**Rationale:**
- Publishing a candidate is a significant event — a new conclusion appears on the user's map. This should eventually create a `ModelUpdate` of type `conclusion_added` or `conclusion_strengthened`.
- However, ModelUpdate creation introduces complexity:
  - What `userFacingSummary` should be generated?
  - What `visibility` should the ModelUpdate have? (`user_visible` since the conclusion is now user-visible)
  - Should the ModelUpdate be `isMeaningful: true`?
  - What `beforeSummary` and `afterSummary` values are appropriate?
- These questions require a separate design phase. For now, publishing is a pure visibility change with no side effects.

**Deferred to:** Phase 2R or later — ModelUpdate creation on publish.

**What this means for the publish action:**
- The publish action does NOT create a ModelUpdate record.
- The publish action does NOT trigger any notification.
- The publish action does NOT update any timeline or activity feed.
- The published conclusion will appear on the user's map the next time they load `GET /api/user-map/conclusions` (which filters by `visibility: user_visible`).

---

### 4.6 What evidence/provenance must remain attached?

**Decision:** All existing evidence links must remain attached through publishing.

**Current evidence linkage:**
- `UnderstandingEvidenceLink` records link evidence sources to `UserMapConclusion` targets.
- These links are created during `persistInternalUserMapConclusionCandidate`.
- The public evidence projection (`listYourMapPublicEvidenceContinuity`) filters by `visibility: user_visible` on the target conclusion.

**Rules:**
- Publishing must NOT delete or detach any evidence links.
- After publishing, the evidence links become visible through the public evidence projection (because the target conclusion now has `visibility: user_visible`).
- Raw `snippet`/`quote` in evidence links remain internal-only per Phase 2E policy — the public evidence projection only exposes `sourceType`, `sourceTypeLabel`, `evidenceSummaryLabel`, `sourceId`, `href`, and `createdAt`.
- The evidence links are already stored and associated with the conclusion — no additional work is needed.

**Important:** After publishing, the conclusion's evidence links will be queryable via `listYourMapPublicEvidenceContinuity` (which checks `visibility: user_visible`). This is correct behavior — the user should see evidence for their conclusions.

---

### 4.7 Can publishing be reversed?

**Decision:** **Yes, but only via a separate "unpublish" action.** Publishing is not a one-way door.

**Unpublish semantics:**
- Unpublishing changes `visibility` from `user_visible` back to `internal_only`.
- `candidateLifecycleStatus` remains `promoted` (unchanged).
- `status` (`UserMapConclusionStatus`) remains unchanged.
- Evidence links remain attached.
- The conclusion disappears from user-facing routes (because they filter by `visibility: user_visible`).
- The conclusion reappears on the internal review page.

**Constraints on unpublishing:**
- Unpublishing should only be allowed if the conclusion has `visibility: user_visible` and `candidateLifecycleStatus: promoted`.
- Unpublishing should NOT be allowed if the conclusion has been superseded (superseded conclusions should remain visible for lineage).
- Unpublishing should NOT delete the conclusion or its evidence.

**What unpublishing does NOT mean:**
- It does not change `candidateLifecycleStatus` back to `proposed` or `held_for_more_evidence`.
- It does not delete the conclusion.
- It does not detach evidence links.
- It does not create a ModelUpdate.

**Future consideration:** If ModelUpdate creation is implemented for publishing, unpublishing should also create a ModelUpdate (e.g., `conclusion_weakened` or a new `conclusion_removed` type). This is deferred.

---

### 4.8 How is supersession handled after publishing?

**Decision:** Supersession after publishing follows the existing `UserMapConclusion` supersession mechanism, with additional lifecycle considerations.

**Normal supersession (user-facing):**
- The user can supersede a published conclusion via `PATCH /api/user-map/conclusions/[id]` by setting `supersededById` or `supersedesId`.
- This changes `status` to `superseded` (via `UserMapConclusionStatus` transition rules).
- The superseded conclusion remains `visibility: user_visible` (it stays on the user's map for lineage).
- This is existing behavior and is unchanged.

**Lifecycle supersession (dark-engine):**
- A promoted candidate can be superseded by a newer candidate via the lifecycle route (`POST /api/internal/user-map/candidates/[id]/lifecycle` with `newStatus: "superseded"`).
- This changes `candidateLifecycleStatus` to `superseded` but does NOT change `visibility` or `status`.
- If the candidate has already been published (`visibility: user_visible`), lifecycle supersession should still be allowed — it means the dark engine has a better candidate, but the user's conclusion remains visible.

**Interaction between publishing and supersession:**

| Scenario | `visibility` | `candidateLifecycleStatus` | `status` | Behavior |
|----------|-------------|---------------------------|----------|----------|
| Published, then lifecycle-superseded | `user_visible` | `superseded` | unchanged | Conclusion stays visible. Dark engine considers it replaced. User can still see it. |
| Published, then user-superseded | `user_visible` | `promoted` | `superseded` | Conclusion stays visible. User marked it as superseded. Dark engine still considers it promoted. |
| Published, then both superseded | `user_visible` | `superseded` | `superseded` | Both systems agree it's superseded. Conclusion stays visible for lineage. |
| Not published, lifecycle-superseded | `internal_only` | `superseded` | unchanged | Cannot be published (precondition fails). Must be re-proposed via new cycle. |

**Key rule:** Publishing does not change supersession behavior. Supersession is orthogonal to visibility.

---

### 4.9 What must public/mobile routes expose or hide?

**Decision:** After publishing, the conclusion becomes visible on all user-facing routes. No additional filtering by `candidateLifecycleStatus` is needed.

**Routes that will expose the published conclusion:**

| Route | Current filter | After publish |
|-------|---------------|---------------|
| `GET /api/user-map/conclusions` | `visibility: user_visible` | ✅ Conclusion appears |
| `GET /api/user-map/conclusions/[id]` | `visibility: user_visible` | ✅ Conclusion is accessible |
| `PATCH /api/user-map/conclusions/[id]` | `visibility: user_visible` | ✅ Conclusion can be modified |
| `listYourMapPublicEvidenceContinuity` | `visibility: user_visible` | ✅ Evidence links become visible |
| `resolvePublicLinkedObjectHrefs` | `visibility: user_visible` | ✅ Conclusion href becomes resolvable |

**What must NOT change:**
- `candidateLifecycleStatus` must NOT be exposed in user-facing API responses. The user does not need to know about dark-engine lifecycle state.
- User-facing routes must NOT filter by `candidateLifecycleStatus`. They filter by `visibility: user_visible` only.
- The internal review route (`GET /api/internal/user-map/review-candidates`) must continue to filter by `visibility: internal_only`. Published candidates should disappear from the internal review page.

**Mobile projection:**
- The mobile app (MindLabs-app) accesses conclusions via the same user-facing API routes.
- After publishing, the conclusion will appear in the mobile app's Your Map surface.
- No mobile-specific changes are needed — the existing API contract handles this.

**What remains internal-only:**
- `candidateLifecycleStatus` — never exposed to user-facing or mobile routes
- Raw `snippet`/`quote` in evidence links — per Phase 2E policy
- Internal review page — still shows only `internal_only` candidates

---

### 4.10 What is the safest next implementation slice after this contract?

**Decision:** Phase 2Q — Publish Action (Internal API)

**Goal:** Create an internal API action that publishes a promoted candidate by changing `visibility` from `internal_only` to `user_visible`.

**Allowed:**
- Create an internal API route (e.g., `POST /api/internal/user-map/candidates/[id]/publish`) that:
  - Checks `candidateLifecycleStatus === "promoted"` (precondition)
  - Checks `visibility === "internal_only"` (precondition)
  - Updates `visibility` to `user_visible`
  - Updates `updatedAt`
  - Returns the updated conclusion (safe response — no lifecycle fields leaked)
- Add tests for the route covering:
  - Auth (401/403)
  - Precondition failures (not promoted, already published, null lifecycle status)
  - Success path
  - Error mapping
  - Response safety (no lifecycle fields leaked)

**Forbidden:**
- No changes to user-facing routes (`/api/user-map/conclusions`)
- No changes to `status` (`UserMapConclusionStatus`)
- No changes to `candidateLifecycleStatus`
- No ModelUpdate creation
- No public/mobile projection changes
- No schema changes
- No UI changes
- No unpublish action (deferred)
- No batch publish (deferred)

**Verification:**
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`

---

## 5. Publish Semantics Summary

| Aspect | Decision |
|--------|----------|
| Precondition 1 | `candidateLifecycleStatus` must be `promoted` |
| Precondition 2 | `visibility` must be `internal_only` |
| Precondition 3 | `candidateLifecycleStatus` must be non-null |
| Precondition 4 | Conclusion must belong to authenticated user |
| Precondition 5 | User must be allowlisted internal reviewer |
| Field changes | `visibility`: `internal_only` → `user_visible`; `updatedAt` updated |
| `status` changes | ❌ No — `UserMapConclusionStatus` is unchanged |
| `candidateLifecycleStatus` changes | ❌ No — remains `promoted` |
| ModelUpdate creation | ❌ No — deferred to future phase |
| Evidence preservation | ✅ All evidence links remain attached and become publicly queryable |
| Reversible? | ✅ Yes, via separate "unpublish" action (deferred) |
| Supersession after publish | ✅ Allowed — lifecycle supersession and user supersession are orthogonal |
| Public/mobile exposure | ✅ Conclusion appears on all user-facing routes automatically |
| `candidateLifecycleStatus` in responses | ❌ No — must never be exposed to user-facing routes |

---

## 6. Forbidden Premature Behaviors

The following behaviors are explicitly forbidden in this slice and must not be implemented:

| Behavior | Why forbidden |
|----------|---------------|
| Changing `status` (`UserMapConclusionStatus`) on publish | Orthogonal concern; `status` is user-facing maturity, not visibility |
| Changing `candidateLifecycleStatus` on publish | Publishing is a visibility change, not a lifecycle change |
| Creating ModelUpdate records on publish | Requires separate design phase for summary generation and visibility |
| Exposing `candidateLifecycleStatus` in user-facing API responses | Would leak internal dark-engine state |
| Filtering user-facing routes by `candidateLifecycleStatus` | User-facing routes filter by `visibility: user_visible` only |
| Auto-publishing promoted candidates | Publishing must be an explicit deliberate action |
| Batch publishing | Each candidate should be reviewed individually |
| Unpublish action | Deferred to future phase |
| Deleting or detaching evidence links on publish | Provenance must be preserved |
| Adding lifecycle fields to other families | Deferred per Phase 2I recommendation |
| UI changes for publish workflow | This slice is API-only; UI is a separate phase |

---

## 7. Open Questions (Deferred)

1. **ModelUpdate on publish:** What `userFacingSummary` should be generated? Should it be `conclusion_added` or `conclusion_strengthened`? Should the ModelUpdate be `isMeaningful: true`?
2. **Unpublish action:** Should unpublishing be a separate route or a parameter on the publish route? Should unpublishing create a ModelUpdate?
3. **Status on publish:** Should publishing automatically set `status` to a default value (e.g., `emerging` for promoted candidates)?
4. **User notification:** Should publishing trigger a notification to the user (e.g., "A new conclusion has been added to your map")?
5. **Batch operations:** Should the publish action support batch publishing (e.g., "publish all promoted candidates")?
6. **Publish reason:** Should published candidates store a publish reason/code for audit?
7. **Publish to specific surfaces:** Should publishing support targeting specific surfaces (e.g., Your Map only, or also Today/Explore)?

---

## 8. Recommended Next Implementation Slice

### Phase 2Q — Publish Action (Internal API)

**Goal:** Create an internal API action that publishes a promoted candidate by changing `visibility` from `internal_only` to `user_visible`.

**Allowed:**
- Create an internal API route (e.g., `POST /api/internal/user-map/candidates/[id]/publish`)
- Check preconditions: `candidateLifecycleStatus === "promoted"`, `visibility === "internal_only"`
- Update `visibility` to `user_visible` and `updatedAt`
- Return safe response (no lifecycle fields leaked)
- Add tests for auth, precondition failures, success, error mapping, response safety

**Forbidden:**
- No changes to user-facing routes
- No changes to `status` or `candidateLifecycleStatus`
- No ModelUpdate creation
- No public/mobile projection changes
- No schema changes
- No UI changes
- No unpublish action
- No batch publish

**Verification:**
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
