# Phase 2O — Internal Candidate Lifecycle Route Audit/Closeout

**Status:** AUDIT COMPLETE  
**Date:** 2026-05-29  
**Scope:** Audit Phase 2N internal lifecycle mutation route against Phase 2M semantics contract. Docs only — no runtime changes.

---

## Audit Questions

### Q1: Does the route only mutate `candidateLifecycleStatus`?

**YES.** The route calls `updateCandidateLifecycleStatus(userId, id, newStatus)` which performs a Prisma `update` with only:

```typescript
data: {
  candidateLifecycleStatus: nextStatus,
  updatedAt: now,
}
```

No other fields (`visibility`, `status`, `evidenceLinks`, etc.) are touched. The Prisma `update` uses `where: { id: conclusionId }` with no additional data mutations.

**Finding:** Clean. Only `candidateLifecycleStatus` is mutated.

---

### Q2: Does it preserve `visibility`/`status`/evidence?

**YES.** The persistence helper (`updateCandidateLifecycleStatus`) does not select, read, or write `visibility`, `status`, or any evidence-related fields. The Prisma `select` clause only requests:

```typescript
select: {
  id: true,
  userId: true,
  candidateLifecycleStatus: true,
  updatedAt: true,
}
```

The `update` `data` only sets `candidateLifecycleStatus` and `updatedAt`. Evidence links are never queried or modified.

**Finding:** Clean. Visibility, status, and evidence are fully preserved.

---

### Q3: Does it obey internal auth/allowlist expectations?

**YES.** The route follows the exact same auth pattern as the existing `app/api/internal/user-map/review-candidates/route.ts`:

1. Calls `auth()` from `@clerk/nextjs/server`
2. Returns `401` with `UNAUTHORIZED` if `userId` is null
3. Calls `isInternalUserMapReviewer(userId)` which checks `INTERNAL_USER_MAP_REVIEWER_IDS` env var
4. Returns `403` with `FORBIDDEN` if not an allowlisted reviewer

The `isInternalUserMapReviewer` function (in `lib/internal-review-auth.ts`) handles:
- Null/undefined userId → false
- Empty allowlist → false
- Non-matching userId → false

**Finding:** Clean. Auth pattern matches existing internal routes exactly.

---

### Q4: Does it use `updateCandidateLifecycleStatus` rather than duplicating transition logic?

**YES.** The route imports and calls `updateCandidateLifecycleStatus` from `lib/candidate-lifecycle-persistence.ts`. It does not:

- Import or call `transitionOrThrow` directly
- Import or call `canTransition` directly
- Implement any transition logic inline
- Access Prisma directly

All transition enforcement is delegated to the Phase 2K/2L stack:
- Route → `updateCandidateLifecycleStatus` (Phase 2L) → `transitionOrThrow` (Phase 2K)

**Finding:** Clean. No duplication of transition logic.

---

### Q5: Does it map errors safely?

**YES.** Error mapping is clean and complete:

| Error Code | HTTP Status | Notes |
|------------|-------------|-------|
| `UNAUTHORIZED` | 401 | No userId from Clerk |
| `FORBIDDEN` | 403 | Not in allowlist or empty allowlist |
| `VALIDATION_ERROR` | 400 | Invalid JSON or invalid `newStatus` value |
| `CONCLUSION_NOT_FOUND` | 404 | Conclusion doesn't exist or wrong user |
| `NULL_LIFECYCLE_STATUS` | 404 | Legacy record with null lifecycle status |
| `FORBIDDEN_TRANSITION` | 422 | Transition not allowed by Phase 2K policy |
| `INTERNAL_ERROR` | 500 | Unexpected errors (caught by catch-all) |

The `catch` block correctly uses `instanceof LifecyclePersistenceError` to distinguish expected errors from unexpected ones. Unexpected errors are logged with a descriptive prefix (`[INTERNAL_CANDIDATE_LIFECYCLE_POST_ERROR]`) and return a generic 500.

**Finding:** Clean. Error mapping is safe and complete.

---

### Q6: Does the response avoid leaking evidence/private fields?

**YES.** The response body contains only:

```typescript
{
  id: result.id,
  previousStatus: result.previousStatus,
  newStatus: result.newStatus,
  updatedAt: result.updatedAt.toISOString(),
}
```

No `visibility`, `status`, `evidence`, `evidenceLinks`, `snippet`, `quote`, `confidence`, `area`, or any other private/internal fields are included.

The test at line 314-350 explicitly verifies this:
```typescript
expect(body).not.toHaveProperty("visibility");
expect(body).not.toHaveProperty("status");
expect(body).not.toHaveProperty("evidence");
expect(body).not.toHaveProperty("evidenceLinks");
```

**Finding:** Clean. Response is minimal and safe.

---

### Q7: Do tests cover the important boundaries?

**YES.** The 12 tests cover:

| Test | Boundary |
|------|----------|
| 401 unauthenticated | Auth gate |
| 403 non-allowlisted user | Auth gate |
| 403 empty allowlist | Auth gate edge case |
| 400 invalid JSON | Input validation |
| 400 invalid status value | Input validation |
| 200 valid transition (proposed → rejected) | Success path |
| 200 held_for_more_evidence → promoted | Success path (promotion) |
| 404 CONCLUSION_NOT_FOUND | Error mapping |
| 404 NULL_LIFECYCLE_STATUS | Error mapping (legacy) |
| 422 FORBIDDEN_TRANSITION | Error mapping |
| 500 unexpected errors | Error mapping |
| Response safety (no visibility/status/evidence) | Leak prevention |

**Coverage gaps (minor, acceptable):**
- No test for `proposed → held_for_more_evidence` success path (only `proposed → rejected` and `held_for_more_evidence → promoted` are tested). This is acceptable because the route delegates to `updateCandidateLifecycleStatus` which is exhaustively tested in Phase 2L (15 tests covering all transition types).
- No test for `proposed → expired` success path. Same reasoning — covered by Phase 2L tests.
- No test for `promoted → superseded` success path. Same reasoning.

**Finding:** Clean. Tests cover all important boundaries. The gaps are acceptable because the underlying persistence helper is exhaustively tested.

---

### Q8: Is the ledger accurate?

**YES.** The Phase 2N entry in `docs/engineering-ledger.md` accurately records:

- Status: complete
- Scope: internal-only lifecycle mutation route
- Runtime behavior: adds internal POST route only
- Files changed: correct (2 new files)
- Route behavior: accurate description
- Tests added: 12 tests, correct description
- What did not change: comprehensive list
- Verification results: all pass
- What remains partial: accurate
- Next step: Phase 2O or Phase 2P

**Finding:** Clean. Ledger entry is factual and complete.

---

### Q9: What remains blocked before public/user-visible candidate publishing?

The following capabilities are **blocked** and require future phases:

| Capability | Blocked by | Required Phase |
|------------|-----------|----------------|
| Public review UI | No user-facing candidate review page | Future UI phase |
| Publish/accept workflow | No route to change `visibility` to `user_visible` | Phase 2P+ |
| ModelUpdate creation on publish | No automatic ModelUpdate creation | Phase 2P+ |
| Expiry scheduler | No trigger-based or time-based expiry | Future phase |
| Cross-family lifecycle | `Investigation`, `ModelUpdate`, `FieldworkAssignment` lack lifecycle fields | Deferred per Phase 2I |
| Batch lifecycle operations | No batch transition endpoint | Future phase |
| Rejection reason storage | No `rejectionReason` field on `UserMapConclusion` | Future phase |
| User notification of promoted candidates | No notification system | Future phase |

**None of these are Phase 2N scope violations.** They are correctly listed as "what remains partial" in the ledger.

---

## Audit Verdict

### PASS

All 9 audit questions pass. No scope violations, no product drift, no evidence-gate bypass, no fake/static output, no schema/route changes outside the named slice, and no unrelated refactors.

### Findings Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | Route only mutates `candidateLifecycleStatus` — clean | ✅ |
| 2 | Visibility/status/evidence fully preserved — clean | ✅ |
| 3 | Auth pattern matches existing internal routes — clean | ✅ |
| 4 | Uses `updateCandidateLifecycleStatus` — no duplication | ✅ |
| 5 | Error mapping is safe and complete — clean | ✅ |
| 6 | Response avoids leaking private fields — clean | ✅ |
| 7 | Tests cover important boundaries — clean (minor gaps acceptable) | ✅ |
| 8 | Ledger entry is accurate — clean | ✅ |
| 9 | Blocked capabilities correctly documented — clean | ✅ |

### Risks

**No risks identified.** The Phase 2N implementation is narrow, safe, and fully compliant with the Phase 2M semantics contract.

---

## Repair Prompt

**None required.** Audit passes cleanly.

---

## Recommended Next Phase

### Phase 2P — Publish/Acceptance Semantics Contract (Docs Only)

**Goal:** Define the semantic contract for making a promoted candidate user-visible. This is the next logical step after the lifecycle foundation is complete.

**Key questions to resolve:**
1. Should there be a separate "accept" action that changes `visibility` to `user_visible`?
2. Should acceptance create a `ModelUpdate` record automatically?
3. Should acceptance trigger a notification to the user?
4. What happens to the candidate's `status` (`UserMapConclusionStatus`) when accepted?
5. Should there be a "reject after promotion" action (revert)?

**Alternative:** Phase 2Q — Internal Route Audit/Closeout (this document) is already done. Proceed directly to Phase 2P.
