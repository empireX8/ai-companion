# Phase 2S — ModelUpdate Creation on Publish Design Contract

**Status:** CONTRACT COMPLETE (DOCS ONLY)  
**Date:** 2026-05-29  
**Scope:** Docs-only design contract defining whether and how publishing a promoted `UserMapConclusion` candidate should create a `ModelUpdate` record. No code, schema, routes, UI, or runtime behavior changes.

---

## 1. Purpose

This contract answers 11 questions about ModelUpdate creation on publish, grounded in the current implemented truth of the schema, routes, and tests. It defines the semantic decisions, failure/idempotency policy, and the safest next implementation slice.

---

## 2. Files Inspected

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` (lines 725–878) | `ModelUpdate` model, `ModelUpdateType` enum, `ModelUpdateVisibility` enum |
| `lib/candidate-publish-helper.ts` | Phase 2Q publish helper (current behavior: no ModelUpdate creation) |
| `app/api/internal/user-map/candidates/[id]/publish/route.ts` | Phase 2Q publish route |
| `app/api/model-updates/route.ts` | User-facing ModelUpdate GET (filters by visibility) and POST (creates with user-supplied data) |
| `app/api/model-updates/[id]/route.ts` | User-facing ModelUpdate GET/PATCH |
| `lib/understanding-engine-api.ts` (lines 199–212) | `modelUpdateCreateSchema` — required fields for ModelUpdate creation |
| `lib/__tests__/what-changed-route.test.ts` | Tests for What Changed surface (consumes ModelUpdates) |
| `lib/__tests__/what-changed-evidence-route.test.ts` | Tests for What Changed evidence route |
| `lib/__tests__/today-intelligence-updates-route.test.ts` | Tests for Today surface (consumes ModelUpdates) |
| `lib/__tests__/today-surface.test.ts` | Tests for Today surface |
| `lib/__tests__/phase3-what-changed-page.test.ts` | Tests for What Changed page |
| `lib/__tests__/understanding-engine-phase1b-api.test.ts` | Tests for ModelUpdate route |
| `docs/phase2p-publish-acceptance-semantics-contract.md` | Phase 2P contract (defers ModelUpdate creation) |
| `docs/phase2r-internal-candidate-publish-route-audit.md` | Phase 2R audit (confirms Phase 2Q is clean) |
| `docs/engineering-ledger.md` | Current ledger state |

---

## 3. Current Implemented Truth

### 3.1 ModelUpdate Schema

```prisma
enum ModelUpdateType {
  conclusion_added
  conclusion_strengthened
  conclusion_weakened
  conclusion_disputed
  conclusion_superseded
  investigation_opened
  investigation_progressed
  investigation_resolved
  investigation_reopened
  fieldwork_assigned
  fieldwork_completed
  action_outcome_recorded
  strategy_adjusted
  correction_applied
  link_detected
}

enum ModelUpdateVisibility {
  internal_only
  candidate
  user_visible
}

model ModelUpdate {
  id                   String                      @id @default(cuid())
  userId               String
  updateType           ModelUpdateType
  visibility           ModelUpdateVisibility
  affectedObjectType   UnderstandingLinkTargetType
  affectedObjectId     String
  userFacingSummary    String
  isMeaningful         Boolean
  beforeSummary        String?
  afterSummary         String?
  confidenceDelta      Float?
  meaningfulDeltaScore Float?
  sourceRunId          String?
  internalNotes        String?
  createdAt            DateTime                    @default(now())

  @@index([userId, visibility, createdAt])
  @@index([userId, updateType, createdAt])
  @@index([userId, affectedObjectType, affectedObjectId])
}
```

### 3.2 ModelUpdate Create Schema (Zod)

```typescript
export const modelUpdateCreateSchema = z.object({
  updateType: z.nativeEnum(ModelUpdateType),           // required
  visibility: z.nativeEnum(ModelUpdateVisibility),     // required
  affectedObjectType: z.nativeEnum(UnderstandingLinkTargetType), // required
  affectedObjectId: nonEmptyStringSchema,              // required
  userFacingSummary: nonEmptyStringSchema,             // required
  isMeaningful: z.boolean(),                           // required
  beforeSummary: z.string().trim().min(1).optional(),
  afterSummary: z.string().trim().min(1).optional(),
  confidenceDelta: z.number().optional(),
  meaningfulDeltaScore: z.number().optional(),
  sourceRunId: z.string().trim().min(1).optional(),
  internalNotes: z.string().trim().min(1).optional(),
});
```

### 3.3 Current ModelUpdate Visibility Semantics

| Visibility | Meaning | Used by |
|------------|---------|---------|
| `internal_only` | Not user-facing | Default filter exclusion in GET |
| `candidate` | Candidate for user review | Available but not default-visible |
| `user_visible` | User-facing | Default filter inclusion in GET |

The `GET /api/model-updates` route filters by `visibility: { not: "internal_only" }` by default, meaning both `candidate` and `user_visible` ModelUpdates are returned unless a specific visibility filter is provided.

### 3.4 Current ModelUpdate Consumption

- **What Changed surface** (`GET /api/what-changed/[id]`): Consumes ModelUpdates via `GET /api/model-updates` filtered by `affectedObjectId` and `affectedObjectType`.
- **Today surface** (`GET /api/today/intelligence-updates`): Consumes recent ModelUpdates with `visibility: user_visible` and `isMeaningful: true`.
- **Evidence continuity**: ModelUpdates can be linked to evidence via `UnderstandingEvidenceLink` records with `targetType: model_update`.

### 3.5 Current Publish Behavior

The Phase 2Q publish helper (`lib/candidate-publish-helper.ts`) performs exactly two mutations:
1. `visibility`: `internal_only` → `user_visible`
2. `updatedAt`: updated to current timestamp

No ModelUpdate record is created. No side effects occur.

---

## 4. Semantic Decisions

### Q1: Should publish create a ModelUpdate at all?

**Decision:** **Yes.** Publishing a promoted candidate is a significant event — a new conclusion appears on the user's map. This should create a `ModelUpdate` of type `conclusion_added` to:
- Appear on the What Changed surface so the user knows a new conclusion was added.
- Appear on the Today surface (if `isMeaningful: true`) so the user sees it in their daily intelligence update.
- Provide an audit trail of when and why the conclusion was published.

**Rationale:**
- The Phase 2P contract §4.5 explicitly deferred this decision, noting that ModelUpdate creation introduces complexity but is the correct eventual behavior.
- The existing `ModelUpdateType` enum already includes `conclusion_added`, which is the semantically correct type for a newly published conclusion.
- The existing `ModelUpdateVisibility` enum includes `user_visible`, which is the correct visibility for a published conclusion.
- The existing `UnderstandingLinkTargetType` enum includes `usermap_conclusion`, which is the correct `affectedObjectType`.

---

### Q2: If yes, is creation synchronous with publish or deferred?

**Decision:** **Synchronous.** The ModelUpdate should be created in the same database transaction as the visibility change.

**Rationale:**
- If the publish succeeds but ModelUpdate creation fails (and is not rolled back), the conclusion becomes user-visible without a corresponding ModelUpdate. This creates an inconsistency where the conclusion appears on the user's map but does not appear on the What Changed or Today surfaces.
- Synchronous creation in a transaction ensures atomicity: either both the visibility change and ModelUpdate creation succeed, or neither does.
- The publish action is an internal reviewer action, not a high-throughput user-facing action. Latency is acceptable.
- Deferred creation (e.g., via a queue or cron job) would introduce complexity (queue management, retry logic, eventual consistency) without clear benefit.

**Concrete approach:**
```typescript
// Pseudocode — inside publishCandidate, after precondition checks
const [updated, modelUpdate] = await prismadb.$transaction([
  prismadb.userMapConclusion.update({
    where: { id: conclusionId },
    data: { visibility: UserMapConclusionVisibility.user_visible, updatedAt: now },
  }),
  prismadb.modelUpdate.create({
    data: {
      userId,
      updateType: ModelUpdateType.conclusion_added,
      visibility: ModelUpdateVisibility.user_visible,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: conclusionId,
      userFacingSummary: generatePublishSummary(conclusion),
      isMeaningful: true,
      // beforeSummary and afterSummary are optional — see Q5
    },
  }),
]);
```

---

### Q3: What `ModelUpdateType` should be used?

**Decision:** **`conclusion_added`** for the initial publish of a candidate.

**Rationale:**
- The candidate was previously `internal_only` (not visible to the user). Publishing makes it `user_visible` for the first time. This is semantically a "conclusion added" event.
- `conclusion_strengthened` is reserved for when an already-visible conclusion gains stronger evidence or confidence. This is a different semantic event.
- If a candidate was previously published, then unpublished, then re-published, the type should still be `conclusion_added` (the conclusion is being added to the user's map again).

**Future consideration:** If the publish action is extended to support re-publishing an unpublished conclusion, the type could remain `conclusion_added` or could be a new type (e.g., `conclusion_restored`). This is deferred.

---

### Q4: What should `userFacingSummary` contain?

**Decision:** A template-based summary string that includes the conclusion title and a brief description of the event.

**Recommended format:**
```
"New conclusion: {title}"
```

**Examples:**
- `"New conclusion: I value autonomy over stability in my career"`
- `"New conclusion: My creative energy peaks in the morning"`

**Rationale:**
- The conclusion `title` is already a user-facing string (set by the dark engine or the user).
- A template-based approach avoids LLM calls during publish, keeping the action synchronous and predictable.
- The summary is concise and informative — the user can see what was added and click through to the conclusion for details.

**Alternative considered:** LLM-generated summary. Rejected because:
- LLM calls add latency and potential failure modes to a synchronous action.
- The conclusion `title` and `summary` fields already contain the relevant information.
- LLM generation can be added later if needed (e.g., for richer What Changed descriptions).

**Implementation note:** The helper should accept an optional `userFacingSummary` override parameter, defaulting to the template. This allows callers (e.g., a future UI) to provide a custom summary if desired.

---

### Q5: What should `beforeSummary` and `afterSummary` contain?

**Decision:** **`beforeSummary`: `null` (not set). `afterSummary`: `null` (not set).**

**Rationale:**
- `beforeSummary` and `afterSummary` are optional fields in the schema.
- For a `conclusion_added` event, there is no meaningful "before" state — the conclusion did not exist on the user's map before publish.
- The `afterSummary` could theoretically contain the conclusion's `summary` field, but this would duplicate information already available via the conclusion itself.
- Setting these to `null` keeps the ModelUpdate lean and avoids data duplication.

**Future consideration:** If the publish action is extended to support re-publishing, `beforeSummary` could contain the conclusion's current `summary` and `afterSummary` could contain the updated `summary` (if the summary changed during the unpublished period). This is deferred.

---

### Q6: Should `isMeaningful` be true by default?

**Decision:** **Yes.** Publishing a promoted candidate is a meaningful event — a new conclusion is being added to the user's map.

**Rationale:**
- The Today surface filters ModelUpdates by `isMeaningful: true`. Setting this to `true` ensures the published conclusion appears in the user's daily intelligence update.
- Publishing is an explicit deliberate action by an internal reviewer. It should be treated as meaningful.
- If a future phase introduces auto-publishing or batch publishing, the `isMeaningful` decision may need to be revisited (e.g., batch-published conclusions might not all be individually meaningful).

---

### Q7: How should evidence/provenance be linked or referenced?

**Decision:** **No additional evidence linking is needed.** The existing evidence links are already associated with the `UserMapConclusion` via `UnderstandingEvidenceLink` records. The ModelUpdate references the conclusion via `affectedObjectId`, and the conclusion's evidence is queryable through the existing evidence projection.

**Rationale:**
- The Phase 2P contract §4.6 confirms that evidence links remain attached through publishing.
- The public evidence projection (`listYourMapPublicEvidenceContinuity`) filters by `visibility: user_visible` on the target conclusion. After publishing, the conclusion's evidence becomes queryable.
- The ModelUpdate does not need to duplicate or re-link evidence — it references the conclusion, and the conclusion has its own evidence links.
- If a future phase wants to link evidence directly to the ModelUpdate (e.g., to show "this update was triggered by this evidence"), that can be done via `UnderstandingEvidenceLink` records with `targetType: model_update`. This is deferred.

---

### Q8: Should duplicate ModelUpdates be prevented if publish is retried?

**Decision:** **Yes.** If the publish action is called multiple times for the same conclusion (e.g., due to a network retry or user double-click), duplicate ModelUpdates must be prevented.

**Approach:** Use the conclusion's `visibility` as a guard. If `visibility` is already `user_visible`, the publish helper already throws `ALREADY_VISIBLE` (Phase 2Q behavior). This means:

1. First call: `visibility` is `internal_only` → publish succeeds → ModelUpdate created.
2. Second call: `visibility` is now `user_visible` → publish throws `ALREADY_VISIBLE` → no ModelUpdate created.

**This is already handled by the existing precondition check.** No additional idempotency mechanism is needed.

**Edge case:** If the publish succeeds (visibility changes to `user_visible`) but the ModelUpdate creation fails (e.g., database error), the transaction rolls back (see Q9). The caller can retry safely — the conclusion is still `internal_only` and the precondition check will pass again.

**Future consideration:** If the publish action is extended to support re-publishing (unpublish → publish), the `ALREADY_VISIBLE` guard would need to be revisited. This is deferred.

---

### Q9: What happens if ModelUpdate creation fails after visibility changes?

**Decision:** **The entire operation rolls back.** The visibility change and ModelUpdate creation must be in the same database transaction.

**Rationale:**
- If visibility changes to `user_visible` but the ModelUpdate is not created, the conclusion appears on the user's map without a corresponding What Changed entry. This is a data inconsistency.
- If the ModelUpdate is created but visibility does not change, the user sees a What Changed entry for a conclusion they cannot access. This is also a data inconsistency.
- A Prisma `$transaction` with an array of operations ensures atomicity: if either operation fails, both are rolled back.

**Concrete behavior:**
```typescript
// Inside publishCandidate, after precondition checks
const [updated, modelUpdate] = await prismadb.$transaction([
  prismadb.userMapConclusion.update({
    where: { id: conclusionId },
    data: { visibility: UserMapConclusionVisibility.user_visible, updatedAt: now },
    select: { id: true, userId: true, visibility: true, updatedAt: true },
  }),
  prismadb.modelUpdate.create({
    data: {
      userId,
      updateType: ModelUpdateType.conclusion_added,
      visibility: ModelUpdateVisibility.user_visible,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: conclusionId,
      userFacingSummary: `New conclusion: ${conclusionTitle}`,
      isMeaningful: true,
    },
    select: { id: true, updateType: true, userFacingSummary: true, createdAt: true },
  }),
]);
```

**Error handling:**
- If the transaction fails (e.g., database connection error), both operations are rolled back. The conclusion remains `internal_only`. The caller receives an error and can retry.
- The existing `INTERNAL_ERROR` catch in the route handles this case.

---

### Q10: Does ModelUpdate creation affect public/mobile routes immediately?

**Decision:** **Yes, immediately.** Once the ModelUpdate is created with `visibility: user_visible`, it becomes queryable through:

1. **`GET /api/model-updates`** — Returns the ModelUpdate (filtered by `visibility: { not: "internal_only" }` by default).
2. **`GET /api/what-changed/[id]`** — Returns the ModelUpdate when filtered by `affectedObjectId` and `affectedObjectType`.
3. **`GET /api/today/intelligence-updates`** — Returns the ModelUpdate if `isMeaningful: true` and `visibility: user_visible`.

**No additional route changes are needed.** The existing routes already handle ModelUpdates with `visibility: user_visible` and `affectedObjectType: usermap_conclusion`.

**Mobile projection:**
- The mobile app accesses ModelUpdates via the same user-facing API routes.
- After publish, the ModelUpdate will appear in the mobile app's What Changed and Today surfaces.
- No mobile-specific changes are needed.

---

### Q11: What is the safest implementation slice after this contract?

**Decision:** **Phase 2T — ModelUpdate Creation on Publish (Implementation)**

**Goal:** Modify `lib/candidate-publish-helper.ts` to create a `ModelUpdate` record synchronously in a transaction with the visibility change.

**Allowed:**
- Modify `lib/candidate-publish-helper.ts` to:
  - Accept an optional `userFacingSummary` parameter (defaulting to `"New conclusion: {title}"`)
  - Create a `ModelUpdate` record in a `$transaction` with the visibility update
  - Return the ModelUpdate ID in the `PublishCandidateResult` (optional — see below)
- Update `lib/__tests__/phase2q-internal-candidate-publish-route.test.ts` to:
  - Test that a ModelUpdate is created on successful publish
  - Test that the ModelUpdate has the correct `updateType`, `visibility`, `affectedObjectType`, `affectedObjectId`, `userFacingSummary`, and `isMeaningful`
  - Test that the transaction rolls back if ModelUpdate creation fails
  - Test that the `ALREADY_VISIBLE` precondition still prevents duplicate ModelUpdates
- Update `docs/engineering-ledger.md`

**Forbidden:**
- No schema changes (no new fields, no new enums)
- No changes to `ModelUpdateType` or `ModelUpdateVisibility` enums
- No changes to user-facing routes (`/api/model-updates`, `/api/what-changed`, `/api/today`)
- No changes to `status` (`UserMapConclusionStatus`)
- No changes to `candidateLifecycleStatus`
- No public/mobile projection changes
- No UI changes
- No unpublish action (deferred)
- No batch publish (deferred)
- No LLM-generated summaries (deferred)
- No evidence linking to ModelUpdate (deferred)

**Verification:**
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`

---

## 5. ModelUpdate Creation Semantics Summary

| Aspect | Decision |
|--------|----------|
| Should publish create a ModelUpdate? | ✅ Yes |
| Creation timing | Synchronous (same transaction) |
| `ModelUpdateType` | `conclusion_added` |
| `ModelUpdateVisibility` | `user_visible` |
| `affectedObjectType` | `usermap_conclusion` |
| `affectedObjectId` | The published conclusion's ID |
| `userFacingSummary` | Template: `"New conclusion: {title}"` (overridable) |
| `isMeaningful` | `true` |
| `beforeSummary` | `null` (not set) |
| `afterSummary` | `null` (not set) |
| `confidenceDelta` | `null` (not set) |
| `meaningfulDeltaScore` | `null` (not set) |
| `sourceRunId` | `null` (not set) |
| `internalNotes` | `null` (not set) |
| Evidence linking | None needed — conclusion's existing evidence links suffice |
| Duplicate prevention | Handled by existing `ALREADY_VISIBLE` precondition |
| Failure handling | Transaction rollback — both operations or neither |
| Public/mobile impact | Immediate — ModelUpdate appears on all user-facing routes |

---

## 6. Failure/Idempotency Policy

| Scenario | Behavior |
|----------|----------|
| Publish succeeds, ModelUpdate creation fails | Transaction rolls back. Conclusion remains `internal_only`. Caller receives error. |
| ModelUpdate creation succeeds, publish fails | Transaction rolls back. No ModelUpdate visible. Caller receives error. |
| Retry after transaction failure | Precondition check passes again (conclusion is still `internal_only`). Publish and ModelUpdate creation retry. |
| Retry after successful publish | Precondition check fails (`ALREADY_VISIBLE`). No duplicate ModelUpdate created. |
| Database connection error during transaction | Both operations fail. Conclusion unchanged. Caller receives `INTERNAL_ERROR`. |

---

## 7. Forbidden Premature Behaviors

| Behavior | Why forbidden |
|----------|---------------|
| Changing `ModelUpdateType` or `ModelUpdateVisibility` enums | Schema change — not allowed in this slice |
| Adding new fields to `ModelUpdate` model | Schema change — not allowed in this slice |
| LLM-generated `userFacingSummary` | Adds latency and failure modes; template is sufficient |
| Evidence linking to ModelUpdate | Not needed — conclusion's existing evidence links suffice |
| Creating multiple ModelUpdates for a single publish | Would violate idempotency |
| Async/deferred ModelUpdate creation | Adds complexity without clear benefit |
| ModelUpdate creation for unpublish | Unpublish action is deferred |
| ModelUpdate creation for batch publish | Batch publish is deferred |
| Changes to user-facing routes | No route changes needed — existing routes handle `user_visible` ModelUpdates |
| Changes to public/mobile projection | No projection changes needed |

---

## 8. Open Questions (Deferred)

1. **Re-publish after unpublish:** Should re-publishing create a `conclusion_added` ModelUpdate or a new type (e.g., `conclusion_restored`)?
2. **Batch publish:** Should batch-publishing create one ModelUpdate per conclusion or a single aggregated ModelUpdate?
3. **LLM summaries:** Should a future phase replace the template-based `userFacingSummary` with an LLM-generated summary for richer What Changed descriptions?
4. **Evidence linking to ModelUpdate:** Should a future phase link evidence directly to the ModelUpdate (via `UnderstandingEvidenceLink` with `targetType: model_update`)?
5. **ModelUpdate for lifecycle transitions:** Should other lifecycle transitions (e.g., `promoted → superseded`) also create ModelUpdates?

---

## 9. Recommended Next Implementation Slice

### Phase 2T — ModelUpdate Creation on Publish (Implementation)

**Goal:** Modify `lib/candidate-publish-helper.ts` to create a `ModelUpdate` record synchronously in a transaction with the visibility change.

**Allowed:**
- Modify `lib/candidate-publish-helper.ts` to:
  - Accept an optional `userFacingSummary` parameter (defaulting to `"New conclusion: {title}"`)
  - Create a `ModelUpdate` record in a `$transaction` with the visibility update
  - Return the ModelUpdate ID in the `PublishCandidateResult` (optional)
- Update `lib/__tests__/phase2q-internal-candidate-publish-route.test.ts` to:
  - Test ModelUpdate creation on successful publish
  - Test correct ModelUpdate field values
  - Test transaction rollback on failure
  - Test duplicate prevention via `ALREADY_VISIBLE`
- Update `docs/engineering-ledger.md`

**Forbidden:**
- No schema changes
- No route changes
- No UI changes
- No unpublish or batch publish
- No LLM summaries
- No evidence linking to ModelUpdate

**Verification:**
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`

---

*Contract written by Phase 2S design process. See `docs/engineering-ledger.md` for the full ledger entry.*
