# Phase 2R — Internal Candidate Publish Route Audit/Closeout

**Status:** AUDIT COMPLETE (DOCS ONLY)  
**Date:** 2026-05-29  
**Scope:** Audit Phase 2Q publish helper and route against Phase 2P publish/acceptance semantics contract. Docs only — no runtime changes.

---

## 1. Audit Questions

### Q1: Does publish require `candidateLifecycleStatus = promoted`?

**Result:** ✅ **PASS**

The helper (`lib/candidate-publish-helper.ts`, lines 102–108) explicitly checks:

```typescript
if (conclusion.candidateLifecycleStatus !== "promoted") {
  throw new PublishCandidateError(
    `Cannot publish UserMapConclusion id=${conclusionId}: candidateLifecycleStatus is '${conclusion.candidateLifecycleStatus}', expected 'promoted'.`,
    "NOT_PROMOTED"
  );
}
```

This matches Phase 2P contract §4.1 precondition 1 and §4.2.

---

### Q2: Does publish require `visibility = internal_only`?

**Result:** ✅ **PASS**

The helper (`lib/candidate-publish-helper.ts`, lines 111–116) explicitly checks:

```typescript
if (conclusion.visibility !== "internal_only") {
  throw new PublishCandidateError(
    `Cannot publish UserMapConclusion id=${conclusionId}: visibility is '${conclusion.visibility}', expected 'internal_only'.`,
    "ALREADY_VISIBLE"
  );
}
```

This matches Phase 2P contract §4.1 precondition 2.

---

### Q3: Does publish mutate only `visibility` and `updatedAt`?

**Result:** ✅ **PASS**

The helper (`lib/candidate-publish-helper.ts`, lines 119–131) performs:

```typescript
const updated = await db.userMapConclusion.update({
  where: { id: conclusionId },
  data: {
    visibility: UserMapConclusionVisibility.user_visible,
    updatedAt: now,
  },
  select: {
    id: true,
    userId: true,
    visibility: true,
    updatedAt: true,
  },
});
```

Only `visibility` and `updatedAt` are set in the `data` object. No other fields are touched. This matches Phase 2P contract §4.3.

---

### Q4: Does it preserve `status`, `candidateLifecycleStatus`, evidence, and user ownership?

**Result:** ✅ **PASS**

- **`status` (`UserMapConclusionStatus`):** Not included in the `data` object — unchanged. Matches §4.4.
- **`candidateLifecycleStatus`:** Not included in the `data` object — unchanged. Matches §4.4.
- **Evidence links:** The helper does not touch `UnderstandingEvidenceLink` records. The `select` clause does not include evidence fields. Matches §4.6.
- **User ownership:** The `findFirst` query (line 72–83) includes `userId` in the `where` clause, enforcing ownership. Matches §4.1 precondition 4.

---

### Q5: Does it avoid leaking private fields in the response?

**Result:** ✅ **PASS**

The route (`app/api/internal/user-map/candidates/[id]/publish/route.ts`, lines 30–35) returns:

```typescript
return Response.json({
  id: result.id,
  previousVisibility: result.previousVisibility,
  newVisibility: result.newVisibility,
  updatedAt: result.updatedAt.toISOString(),
});
```

The response contains only `id`, `previousVisibility`, `newVisibility`, and `updatedAt`. No `candidateLifecycleStatus`, `status`, `evidence`, `evidenceLinks`, or `userId` is exposed.

The test (`lib/__tests__/phase2q-internal-candidate-publish-route.test.ts`, lines 258–292) explicitly verifies this:

```typescript
expect(body).not.toHaveProperty("candidateLifecycleStatus");
expect(body).not.toHaveProperty("status");
expect(body).not.toHaveProperty("evidence");
expect(body).not.toHaveProperty("evidenceLinks");
expect(body).not.toHaveProperty("userId");
```

This matches Phase 2P contract §4.9.

---

### Q6: Does it avoid exposing `candidateLifecycleStatus` publicly?

**Result:** ✅ **PASS**

- The publish route is internal-only (`/api/internal/user-map/candidates/[id]/publish`), gated by `isInternalUserMapReviewer` (line 21).
- The response does not include `candidateLifecycleStatus`.
- The helper's `select` clause fetches `candidateLifecycleStatus` for precondition checking but does not return it in the result type (`PublishCandidateResult`).
- No changes were made to user-facing routes (`/api/user-map/conclusions`).
- User-facing routes continue to filter by `visibility: user_visible` only (confirmed: `GET /api/user-map/conclusions/[id]` line 40, `listYourMapPublicEvidenceContinuity` line 257).

This matches Phase 2P contract §4.9.

---

### Q7: Do tests cover auth, preconditions, errors, and response safety?

**Result:** ✅ **PASS**

The test file (`lib/__tests__/phase2q-internal-candidate-publish-route.test.ts`) contains 10 tests:

| Test | Coverage | Line |
|------|----------|------|
| Returns 401 when unauthenticated | Auth | 40–57 |
| Returns 403 for non-allowlisted user | Auth | 59–76 |
| Returns 403 when allowlist is empty | Auth | 78–98 |
| Returns 200 for promoted + internal_only | Success path | 100–132 |
| Returns 404 for missing conclusion | Error: CONCLUSION_NOT_FOUND | 134–158 |
| Returns 404 for null lifecycle status | Error: NULL_LIFECYCLE_STATUS | 160–184 |
| Returns 422 for non-promoted candidate | Error: NOT_PROMOTED | 186–210 |
| Returns 422 for already visible candidate | Error: ALREADY_VISIBLE | 212–236 |
| Returns 500 for unexpected errors | Error: INTERNAL_ERROR | 238–256 |
| Does not expose private fields in response | Response safety | 258–292 |

All precondition errors from the Phase 2P contract are covered:
- `CONCLUSION_NOT_FOUND` (precondition 4: ownership)
- `NULL_LIFECYCLE_STATUS` (precondition 3: non-null lifecycle)
- `NOT_PROMOTED` (precondition 1: promoted status)
- `ALREADY_VISIBLE` (precondition 2: internal_only visibility)

Auth coverage includes unauthenticated, non-allowlisted, and empty allowlist.

Response safety is explicitly verified.

---

### Q8: Is the ledger accurate?

**Result:** ✅ **PASS**

The ledger entry (`docs/engineering-ledger.md`, Phase 2Q section) accurately records:

- **Status:** complete
- **Scope:** Internal-only publish action for promoted UserMapConclusion candidates
- **Runtime behavior:** adds internal POST route only; no public/mobile projection
- **Files changed:** 3 created (helper, route, tests), 1 modified (ledger)
- **Helper behavior:** Correctly described with all 6 steps
- **Error types:** All 5 error codes listed correctly
- **Route behavior:** Auth, error mapping, and safe response correctly documented
- **Tests:** 10 tests correctly described
- **What did not change:** 14 items listed, all accurate
- **Verification results:** All 6 checks pass
- **What remains partial:** 6 items listed, all accurate
- **Next step:** Phase 2R — ModelUpdate Creation on Publish (or audit/closeout)

No inaccuracies or exaggerations found.

---

### Q9: What remains blocked before ModelUpdate creation on publish?

**Result:** ✅ **DOCUMENTED**

The following capabilities remain blocked (deferred per Phase 2P contract §4.5 and §7):

1. **ModelUpdate creation on publish** — No `ModelUpdate` record is created when a candidate is published. The contract defers this to a future phase, noting open questions about `userFacingSummary`, `ModelUpdateType` (`conclusion_added` vs `conclusion_strengthened`), `isMeaningful`, and `beforeSummary`/`afterSummary` values.

2. **Unpublish action** — No route exists to reverse a publish. The contract §4.7 defines unpublish semantics but defers implementation.

3. **User-facing publish UI** — Publishing is API-only. No UI exists for internal reviewers to trigger publish from a web interface.

4. **Batch publish** — No support for publishing multiple candidates at once.

5. **Expiry scheduler** — No automatic expiry of `proposed` or `held_for_more_evidence` candidates.

6. **Lifecycle fields for other families** — `Investigation`, `ModelUpdate`, and `FieldworkAssignment` still lack lifecycle status.

7. **User notification** — No notification is triggered when a conclusion is published.

8. **Publish reason/audit trail** — No `publishReason` or audit log is stored.

---

## 2. Audit Verdict

**Verdict: ✅ PASS**

All 9 audit questions pass. No scope violations, no product drift, no evidence-gate bypass, no fake/static output, no schema/route changes outside the named slice, and no unrelated refactors.

### Summary of findings

| # | Question | Result |
|---|----------|--------|
| 1 | Requires `candidateLifecycleStatus = promoted` | ✅ PASS |
| 2 | Requires `visibility = internal_only` | ✅ PASS |
| 3 | Mutates only `visibility` and `updatedAt` | ✅ PASS |
| 4 | Preserves status, lifecycle, evidence, ownership | ✅ PASS |
| 5 | Avoids leaking private fields in response | ✅ PASS |
| 6 | Avoids exposing `candidateLifecycleStatus` publicly | ✅ PASS |
| 7 | Tests cover auth, preconditions, errors, safety | ✅ PASS |
| 8 | Ledger is accurate | ✅ PASS |
| 9 | Blocked capabilities documented | ✅ PASS |

### Risks

None identified. The implementation is narrow, well-scoped, and matches the contract precisely.

### Repair prompt

None required.

---

## 3. Recommended Next Phase

**Phase 2S — ModelUpdate Creation on Publish Design Contract (docs only)**

Before implementing ModelUpdate creation on publish, a design contract should answer:

1. What `ModelUpdateType` should be used? (`conclusion_added` for new conclusions, `conclusion_strengthened` for promoted candidates that were already visible?)
2. What `userFacingSummary` should be generated? (LLM-generated? Template-based? Both?)
3. Should the ModelUpdate be `isMeaningful: true`?
4. What `beforeSummary` and `afterSummary` values are appropriate?
5. What `visibility` should the ModelUpdate have? (`user_visible` since the conclusion is now user-visible)
6. Should the ModelUpdate be created synchronously or asynchronously?
7. Should publishing multiple candidates create separate ModelUpdates or a single aggregated one?

**Alternative:** If the team prefers to move directly to implementation, the next slice could be **Phase 2S — ModelUpdate Creation on Publish (Implementation)** with the design decisions made inline.

---

*Audit performed by Phase 2R audit process. See `docs/engineering-ledger.md` for the full ledger entry.*
