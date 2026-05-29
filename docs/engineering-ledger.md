# Engineering Ledger — MindLab

> Factual record of agent-driven development phases.
> Each entry is written by the Closeout Agent after a phase completes.
> No exaggeration. No speculation.

---

## Agent Control Files Setup

- **Status:** complete

- **Scope:** repo workflow/docs/scripts only
- **Runtime behavior:** unchanged
- **Files created:**
  - `AGENTS.md` — agent operating system rules and role definitions
  - `docs/agent-workflow.md` — operating loop documentation
  - `docs/engineering-ledger.md` — this file (initialized)
  - `prompts/architect.md` — architect agent prompt
  - `prompts/implementer.md` — implementation agent prompt
  - `prompts/auditor.md` — audit agent prompt
  - `prompts/test-fixer.md` — test repair agent prompt
  - `prompts/closeout.md` — closeout agent prompt
  - `scripts/verify-mindlab.sh` — unified verification script
- **Verification:** pending (files created, verification script ready)
- **What remains partial:** N/A — this is the setup phase
- **Next step after this:** Phase 2I Candidate Lifecycle/Schema Design Audit

---

## Phase 2I — Candidate Lifecycle/Schema Design Audit

- **Status:** complete
- **Scope:** docs-only audit of current implemented truth vs. required candidate lifecycle
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2i-candidate-lifecycle-schema-design-audit.md` — created (audit document)
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: skipped (no code changes)
  - `npx vitest run`: skipped (no code changes)
  - `npm run build`: skipped (no code changes)
  - `bash scripts/check-trust-language.sh`: skipped (no code changes)
  - `bash scripts/check-legacy-surfaces.sh`: skipped (no code changes)
- **What remains partial:** N/A — this is a docs-only audit. No implementation was attempted.
- **Next step:** Review the recommended implementation slice (add `candidateLifecycleStatus` to `UserMapConclusion` only) and decide whether to proceed with schema migration.

---

## Phase 2I — Candidate Lifecycle Implementation

- **Status:** complete
- **Scope:** Add `CandidateLifecycleStatus` enum and `candidateLifecycleStatus` field to `UserMapConclusion` model, with migration, persistence code update, and tests.
- **Runtime behavior:** New candidates are created with `candidateLifecycleStatus = proposed`. Existing records remain nullable (backward compatible).
- **Files changed:**
  - `prisma/schema.prisma` — added `CandidateLifecycleStatus` enum, added `candidateLifecycleStatus` field to `UserMapConclusion`
  - `prisma/migrations/20260528215130_add_candidate_lifecycle_status/` — new migration
  - `lib/understanding-dark-engine/user-map-candidate-persistence.ts` — import `CandidateLifecycleStatus`, set `candidateLifecycleStatus: CandidateLifecycleStatus.proposed` on create
  - `lib/__tests__/understanding-dark-engine-user-map-candidate-persistence.test.ts` — updated `InMemoryConclusion` type, mock create, seed data, and added assertion for `candidateLifecycleStatus: "proposed"`
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (136 files, 2279 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - `Investigation`, `ModelUpdate`, and `FieldworkAssignment` still lack lifecycle status (deferred per audit recommendation)
  - No candidate promotion/rejection workflow yet
  - No candidate expiry/cleanup yet
  - No cross-family candidate query yet
  - No user-facing candidate review UI yet
- **Next step:** Phase 2J — Candidate Promotion/Rejection Workflow Design

---

## Phase 2K — Candidate Lifecycle Transition Policy/Helpers

- **Status:** complete
- **Scope:** Define safe lifecycle transition semantics for `UserMapConclusion.candidateLifecycleStatus` before building promotion/rejection workflows.
- **Runtime behavior:** unchanged — no existing code calls the new helpers yet
- **Files changed:**
  - `lib/candidate-lifecycle-transitions.ts` — created (lifecycle transition policy module)
  - `lib/__tests__/candidate-lifecycle-transitions.test.ts` — created (51 focused unit tests)
- **Transition rules added:**
  - `proposed → held_for_more_evidence` (evidence exists but insufficient confidence)
  - `proposed → rejected` (gates fail definitively)
  - `proposed → expired` (timeout without sufficient evidence)
  - `held_for_more_evidence → proposed` (new evidence arrives)
  - `held_for_more_evidence → rejected` (gates fail after re-evaluation)
  - `held_for_more_evidence → expired` (timeout)
  - `held_for_more_evidence → promoted` (gates pass)
  - `rejected → proposed` (only via new candidate cycle)
  - `promoted → superseded` (replaced by newer candidate)
  - `expired → proposed` (only via new candidate cycle)
- **Null semantics:** `null` means legacy/pre-lifecycle/not lifecycle-managed. Transitions from `null` are forbidden — must set an explicit initial status first.
- **Exported functions:**
  - `canTransition(from, to)` → `LifecycleTransitionResult` (discriminated union)
  - `transitionOrThrow(from, to)` → returns next status or throws
  - `getAllowedNextStatuses(status)` → `Set<CandidateLifecycleStatus>`
  - `isTerminalStatus(status)` → boolean (only `superseded` is terminal)
  - `isDeadEndStatus(status)` → boolean (`rejected`, `expired`, `superseded`)
- **Tests added/changed:**
  - 51 new tests covering all allowed transitions, all forbidden transitions, null semantics, terminal/dead-end detection, and error handling
- **What did not change:**
  - No schema changes (no new fields, no new enums)
  - No changes to `Investigation`, `ModelUpdate`, or `FieldworkAssignment`
  - No public/mobile projection
  - No user-facing review UI
  - No ModelUpdate records created
  - No automatic promotion/rejection
  - No message/import route behavior changes
  - No dark-run execution behavior changes
  - No unrelated lifecycle code refactored
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (137 files, 2330 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No promotion/rejection workflow yet (next step)
  - No candidate expiry/cleanup yet
  - No cross-family candidate query yet
  - No user-facing candidate review UI yet
- **Next step:** Phase 2L — Candidate Promotion/Rejection Workflow (use `transitionOrThrow` to gate promotion/rejection actions)

---

## Phase 2L — UserMapConclusion Candidate Lifecycle Persistence Helper

- **Status:** complete
- **Scope:** Create a narrow internal persistence helper for changing `UserMapConclusion.candidateLifecycleStatus` safely using the Phase 2K transition policy.
- **Runtime behavior:** unchanged — no existing code calls the new helper yet
- **Files changed:**
  - `lib/candidate-lifecycle-persistence.ts` — created (lifecycle persistence helper)
  - `lib/__tests__/candidate-lifecycle-persistence.test.ts` — created (15 focused unit tests)
- **Helper added:**
  - `updateCandidateLifecycleStatus(userId, conclusionId, newStatus, options?)` — async function that:
    1. Fetches the conclusion with ownership check (`findFirst` with `userId` + `id`)
    2. Enforces non-null existing status (null = legacy/pre-lifecycle)
    3. Enforces legal transition via `transitionOrThrow` from Phase 2K
    4. Performs the Prisma `update` with `candidateLifecycleStatus` and `updatedAt`
    5. Returns `UpdateLifecycleStatusResult` with `id`, `userId`, `previousStatus`, `newStatus`, `updatedAt`
- **Error types:**
  - `LifecyclePersistenceError` with machine-readable `code` field
  - `CONCLUSION_NOT_FOUND` — conclusion doesn't exist or wrong user
  - `NULL_LIFECYCLE_STATUS` — existing status is null (legacy/pre-lifecycle)
  - `FORBIDDEN_TRANSITION` — transition not allowed by Phase 2K policy
- **Transition enforcement behavior:**
  - Uses `transitionOrThrow` from Phase 2K to enforce all legal/forbidden transitions
  - Wraps plain `Error` from `transitionOrThrow` into `LifecyclePersistenceError` with code `FORBIDDEN_TRANSITION`
- **Null/legacy behavior:**
  - `null` means legacy/pre-lifecycle/not lifecycle-managed
  - Helper throws `LifecyclePersistenceError` with code `NULL_LIFECYCLE_STATUS` if existing `candidateLifecycleStatus` is null
  - Legacy records must be explicitly initialized before lifecycle management
- **Tests added/changed:**
  - 15 new tests covering:
    - 7 valid transitions (proposed→rejected, held→promoted, proposed→held, proposed→expired, promoted→superseded, rejected→proposed, expired→proposed)
    - 3 invalid transitions (promoted→proposed, superseded→any, proposed→promoted)
    - Null legacy records (null candidateLifecycleStatus)
    - Missing records (conclusion not found)
    - Wrong user ownership
    - Error code verification (NULL_LIFECYCLE_STATUS, CONCLUSION_NOT_FOUND)
- **What did not change:**
  - No schema changes (no new fields, no new enums)
  - No changes to `Investigation`, `ModelUpdate`, or `FieldworkAssignment`
  - No public/mobile API route
  - No user-facing review UI
  - No ModelUpdate records created
  - No automatic promotion/rejection from dark-run output
  - No message/import route behavior changes
  - No dark-run execution behavior changes
  - No promoted candidates made user-visible
  - No unrelated lifecycle code refactored
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (138 files, 2345 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No promotion/rejection workflow yet (next step)
  - No candidate expiry/cleanup yet
  - No cross-family candidate query yet
  - No user-facing candidate review UI yet
- **Next step:** Phase 2M — Candidate Promotion/Rejection Semantics Contract (docs-only)

---

## Phase 2M — Candidate Promotion/Rejection Semantics Contract

- **Status:** complete
- **Scope:** Docs-only semantic contract defining what promotion, rejection, expiry, hold, and supersession mean for `UserMapConclusion` candidates. No code, schema, routes, UI, or runtime behavior changes.
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2m-candidate-promotion-rejection-semantics-contract.md` — created (semantic contract)
- **Files inspected (14):**
  - `prisma/schema.prisma` — current schema state
  - `lib/candidate-lifecycle-transitions.ts` — Phase 2K transition policy
  - `lib/candidate-lifecycle-persistence.ts` — Phase 2L persistence helper
  - `lib/understanding-dark-engine/user-map-candidate-persistence.ts` — dark-engine candidate creation
  - `lib/understanding-engine-api.ts` — existing `UserMapConclusionStatus` transition rules
  - `lib/internal-user-map-review-candidates.ts` — internal review candidate query
  - `lib/public-evidence-continuity.ts` — public evidence projection
  - `lib/public-linked-object-continuity.ts` — public linked object projection
  - `app/api/user-map/conclusions/route.ts` — user-facing GET/POST
  - `app/api/user-map/conclusions/[id]/route.ts` — user-facing GET/PATCH
  - `app/api/model-updates/route.ts` — ModelUpdate creation route
  - `app/api/internal/user-map/review-candidates/route.ts` — internal review route
  - `docs/phase2e-candidate-storage-policy-contract.md` — Phase 2E storage/lifecycle policy
  - `docs/phase2i-candidate-lifecycle-schema-design-audit.md` — Phase 2I lifecycle/schema audit
- **Semantic decisions:**
  1. **`promoted` changes only `candidateLifecycleStatus`** — does NOT change `visibility` or `status`. Promotion and user-visibility are separate gates.
  2. **Promoted candidates cannot become user-visible immediately** — requires an explicit separate action (future "publish" or "accept" workflow).
  3. **Promotion does NOT create ModelUpdate records** — never in this slice. ModelUpdate creation is deferred until a candidate becomes user-visible.
  4. **`rejected`** = dark engine determined candidate does not meet gates. Remains queryable. Evidence preserved. Can re-propose via new cycle.
  5. **`held_for_more_evidence`** = passed baseline gates but insufficient for promotion. Waiting for more evidence.
  6. **`expired`** = timed out without sufficient evidence. Remains queryable. Can re-propose via new cycle. Expiry policy (timeout duration) deferred.
  7. **`superseded`** = replaced by newer candidate. Terminal state. Evidence preserved. Orthogonal to `UserMapConclusionStatus.superseded`.
  8. **Evidence/provenance must remain attached** through all lifecycle transitions. No transition may delete or detach evidence links.
- **Forbidden premature behaviors (10):**
  - Changing `visibility` on promotion, changing `status` on lifecycle transition
  - Creating `ModelUpdate` records, soft-deleting/hiding rejected/expired candidates
  - Deleting evidence links, auto-expiring via scheduler/cron
  - Exposing `candidateLifecycleStatus` in user-facing API responses
  - Filtering user-facing routes by `candidateLifecycleStatus`
  - Creating a promotion/rejection API route (next slice)
  - Adding lifecycle to other families
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (138 files, 2345 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No promotion/rejection API route yet (next step)
  - No candidate expiry/cleanup yet
  - No cross-family candidate query yet
  - No user-facing candidate review UI yet
- **Next step:** Phase 2N — Candidate Promotion/Rejection Action (Internal API) — wire `updateCandidateLifecycleStatus` into an internal API route

---

## Phase 2N — Internal UserMapConclusion Candidate Lifecycle Route

- **Status:** complete
- **Scope:** Internal-only lifecycle mutation route for UserMapConclusion candidates
- **Runtime behavior:** adds internal POST route only; no public/mobile projection
- **Files changed:**
  - `app/api/internal/user-map/candidates/[id]/lifecycle/route.ts` — created internal route
  - `lib/__tests__/phase2n-internal-candidate-lifecycle-route.test.ts` — created focused route tests
- **Route behavior:**
  - `POST /api/internal/user-map/candidates/[id]/lifecycle` — transitions candidate lifecycle status
  - Auth: Clerk-based, restricted to `INTERNAL_USER_MAP_REVIEWER_IDS` allowlist
  - Validation: Zod schema validates `newStatus` against `CandidateLifecycleStatus` enum
  - Error mapping:
    - `401` — unauthenticated
    - `403` — non-allowlisted user or empty allowlist
    - `400` — invalid JSON or invalid status value
    - `404` — `CONCLUSION_NOT_FOUND` or `NULL_LIFECYCLE_STATUS`
    - `422` — `FORBIDDEN_TRANSITION`
    - `500` — unexpected errors
  - Safe response: returns only `{ id, previousStatus, newStatus, updatedAt }` — no visibility, status, or evidence links leaked
- **Tests added/changed:**
  - 12 new tests covering: auth (401/403), validation (400), success transitions, error mapping (404/422/500), and response safety (no visibility/status/evidence fields)
- **What did not change:**
  - No schema changes (no new fields, no new enums)
  - No changes to `Investigation`, `ModelUpdate`, or `FieldworkAssignment`
  - No public/mobile API route
  - No user-facing review UI
  - No ModelUpdate records created
  - No automatic promotion/rejection from dark-run output
  - No message/import route behavior changes
  - No dark-run execution behavior changes
  - No promoted candidates made user-visible
  - No unrelated lifecycle code refactored
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (139 files, 2357 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No public review UI
  - No publish/user-visible acceptance workflow
  - No ModelUpdate creation
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Phase 2O internal route audit/closeout or Phase 2P publish/acceptance semantics contract

---

## Phase 2O — Internal Candidate Lifecycle Route Audit/Closeout

- **Status:** complete
- **Scope:** Audit Phase 2N internal lifecycle mutation route against Phase 2M semantics contract. Docs only — no runtime changes.
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2o-internal-candidate-lifecycle-route-audit.md` — created (audit document)
- **Audit verdict:** **PASS** — all 9 audit questions pass. No scope violations, no product drift, no evidence-gate bypass, no fake/static output, no schema/route changes outside the named slice, and no unrelated refactors.
- **Key findings:**
  1. Route only mutates `candidateLifecycleStatus` — clean
  2. Visibility/status/evidence fully preserved — clean
  3. Auth pattern matches existing internal routes — clean
  4. Uses `updateCandidateLifecycleStatus` — no duplication
  5. Error mapping is safe and complete — clean
  6. Response avoids leaking private fields — clean
  7. Tests cover important boundaries — clean (minor gaps acceptable)
  8. Ledger entry is accurate — clean
  9. Blocked capabilities correctly documented — clean
- **Risks:** None identified
- **Repair prompt:** None required
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (139 files, 2357 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No public review UI
  - No publish/user-visible acceptance workflow
  - No ModelUpdate creation
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Phase 2P — Publish/Acceptance Semantics Contract (docs only)

---

## Phase 2P — Publish/Acceptance Semantics Contract

- **Status:** complete
- **Scope:** Docs-only semantic contract defining what it means to turn a promoted `UserMapConclusion` candidate into a user-visible conclusion. No code, schema, routes, UI, or runtime behavior changes.
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2p-publish-acceptance-semantics-contract.md` — created (semantic contract)
- **Files inspected (12):**
  - `prisma/schema.prisma` — current schema state
  - `lib/candidate-lifecycle-transitions.ts` — Phase 2K transition policy
  - `lib/candidate-lifecycle-persistence.ts` — Phase 2L persistence helper
  - `app/api/internal/user-map/candidates/[id]/lifecycle/route.ts` — Phase 2N internal lifecycle route
  - `app/api/user-map/conclusions/route.ts` — user-facing GET/POST
  - `app/api/user-map/conclusions/[id]/route.ts` — user-facing GET/PATCH
  - `app/api/model-updates/route.ts` — ModelUpdate creation route
  - `lib/public-evidence-continuity.ts` — public evidence projection
  - `lib/public-linked-object-continuity.ts` — public linked object projection
  - `docs/phase2m-candidate-promotion-rejection-semantics-contract.md` — Phase 2M semantics contract
  - `docs/phase2o-internal-candidate-lifecycle-route-audit.md` — Phase 2O audit
  - `docs/engineering-ledger.md` — current ledger state
- **Semantic decisions (10):**
  1. **Preconditions for publishing:** `candidateLifecycleStatus` must be `promoted`, `visibility` must be `internal_only`, `candidateLifecycleStatus` must be non-null, conclusion must belong to authenticated user, user must be allowlisted internal reviewer.
  2. **Publishing requires `candidateLifecycleStatus = promoted`** — only dark-engine-verified candidates may be published.
  3. **Field changes on publish:** `visibility`: `internal_only` → `user_visible`; `updatedAt` updated. No other fields change.
  4. **Publishing changes `visibility` only** — does NOT change `status` (`UserMapConclusionStatus`) or `candidateLifecycleStatus`.
  5. **ModelUpdate creation deferred** — publishing does NOT create ModelUpdate records. Deferred to Phase 2R or later.
  6. **Evidence/provenance must remain attached** — all evidence links preserved. After publish, evidence becomes queryable via public evidence projection.
  7. **Publishing is reversible** — via separate "unpublish" action (deferred). Unpublishing changes `visibility` back to `internal_only`.
  8. **Supersession after publishing is orthogonal** — lifecycle supersession and user supersession are independent of visibility.
  9. **Public/mobile routes expose automatically** — no additional filtering by `candidateLifecycleStatus`. `candidateLifecycleStatus` must never be exposed in user-facing responses.
  10. **Next slice:** Phase 2Q — Publish Action (Internal API).
- **Forbidden premature behaviors (11):**
  - Changing `status` on publish, changing `candidateLifecycleStatus` on publish
  - Creating ModelUpdate records on publish
  - Exposing `candidateLifecycleStatus` in user-facing API responses
  - Filtering user-facing routes by `candidateLifecycleStatus`
  - Auto-publishing promoted candidates, batch publishing
  - Unpublish action (deferred)
  - Deleting or detaching evidence links on publish
  - Adding lifecycle fields to other families
  - UI changes for publish workflow
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (139 files, 2357 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No publish API route yet (next step)
  - No ModelUpdate creation on publish
  - No unpublish action
  - No user-facing publish UI
  - No batch publish
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Phase 2Q — Publish Action (Internal API)

---

## Phase 2Q — Internal UserMapConclusion Candidate Publish Action

- **Status:** complete
- **Scope:** Internal-only publish action for promoted UserMapConclusion candidates
- **Runtime behavior:** adds internal POST route only; no public/mobile projection
- **Files changed:**
  - `lib/candidate-publish-helper.ts` — created (publish helper with precondition enforcement)
  - `app/api/internal/user-map/candidates/[id]/publish/route.ts` — created (internal publish route)
  - `lib/__tests__/phase2q-internal-candidate-publish-route.test.ts` — created (10 focused route tests)
- **Helper added:**
  - `publishCandidate(userId, conclusionId, options?)` — async function that:
    1. Fetches the conclusion with ownership check (`findFirst` with `userId` + `id`)
    2. Enforces non-null `candidateLifecycleStatus` (null = legacy/pre-lifecycle)
    3. Enforces `candidateLifecycleStatus === "promoted"`
    4. Enforces `visibility === "internal_only"`
    5. Performs the Prisma `update` with `visibility: user_visible` and `updatedAt`
    6. Returns `PublishCandidateResult` with `id`, `userId`, `previousVisibility`, `newVisibility`, `updatedAt`
- **Error types:**
  - `PublishCandidateError` with machine-readable `code` field
  - `CONCLUSION_NOT_FOUND` — conclusion doesn't exist or wrong user
  - `NULL_LIFECYCLE_STATUS` — existing status is null (legacy/pre-lifecycle)
  - `NOT_PROMOTED` — candidateLifecycleStatus is not "promoted"
  - `ALREADY_VISIBLE` — visibility is already "user_visible"
- **Route behavior:**
  - `POST /api/internal/user-map/candidates/[id]/publish` — publishes a promoted candidate
  - Auth: Clerk-based, restricted to `INTERNAL_USER_MAP_REVIEWER_IDS` allowlist
  - Error mapping:
    - `401` — unauthenticated
    - `403` — non-allowlisted user or empty allowlist
    - `404` — `CONCLUSION_NOT_FOUND` or `NULL_LIFECYCLE_STATUS`
    - `422` — `NOT_PROMOTED` or `ALREADY_VISIBLE`
    - `500` — unexpected errors
  - Safe response: returns only `{ id, previousVisibility, newVisibility, updatedAt }` — no `candidateLifecycleStatus`, `status`, `evidence`, or `userId`
- **Tests added/changed:**
  - 10 new tests covering: auth (401/403), empty allowlist (403), success transition, missing conclusion (404), null lifecycle (404), non-promoted (422), already visible (422), unexpected error (500), and response safety (no lifecycle/status/evidence fields)
- **What did not change:**
  - No schema changes (no new fields, no new enums)
  - No changes to `UserMapConclusion.status`
  - No changes to `candidateLifecycleStatus`
  - No ModelUpdate records created
  - No changes to `Investigation`, `ModelUpdate`, or `FieldworkAssignment`
  - No public/mobile API route
  - No user-facing publish UI
  - No unpublish action
  - No batch publish
  - No expiry scheduler
  - No lifecycle fields for other families
  - No evidence links altered
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (140 files, 2367 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No ModelUpdate creation on publish
  - No unpublish action
  - No user-facing publish UI
  - No batch publish
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Phase 2R — ModelUpdate Creation on Publish (or audit/closeout)

---

## Phase 2R — Internal Candidate Publish Route Audit/Closeout

- **Status:** complete
- **Scope:** Audit Phase 2Q publish helper and route against Phase 2P publish/acceptance semantics contract. Docs only — no runtime changes.
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2r-internal-candidate-publish-route-audit.md` — created (audit document)
- **Audit verdict:** **PASS** — all 9 audit questions pass. No scope violations, no product drift, no evidence-gate bypass, no fake/static output, no schema/route changes outside the named slice, and no unrelated refactors.
- **Key findings:**
  1. Requires `candidateLifecycleStatus = promoted` — clean
  2. Requires `visibility = internal_only` — clean
  3. Mutates only `visibility` and `updatedAt` — clean
  4. Preserves `status`, `candidateLifecycleStatus`, evidence, and ownership — clean
  5. Response avoids leaking private fields — clean
  6. No public exposure of `candidateLifecycleStatus` — clean
  7. Tests cover auth, preconditions, errors, and response safety — clean
  8. Ledger entry is accurate — clean
  9. Blocked capabilities correctly documented — clean
- **Risks:** None identified
- **Repair prompt:** None required
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (140 files, 2367 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No ModelUpdate creation on publish
  - No unpublish action
  - No user-facing publish UI
  - No batch publish
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Phase 2S — ModelUpdate Creation on Publish Design Contract (docs only)

---

## Phase 2S — ModelUpdate Creation on Publish Design Contract

- **Status:** complete
- **Scope:** Docs-only design contract defining whether and how publishing a promoted `UserMapConclusion` candidate should create a `ModelUpdate` record. No code, schema, routes, UI, or runtime behavior changes.
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2s-modelupdate-creation-on-publish-design-contract.md` — created (design contract)
- **Files inspected (15):**
  - `prisma/schema.prisma` — `ModelUpdate` model, `ModelUpdateType` enum, `ModelUpdateVisibility` enum
  - `lib/candidate-publish-helper.ts` — Phase 2Q publish helper
  - `app/api/internal/user-map/candidates/[id]/publish/route.ts` — Phase 2Q publish route
  - `app/api/model-updates/route.ts` — user-facing ModelUpdate GET/POST
  - `app/api/model-updates/[id]/route.ts` — user-facing ModelUpdate GET/PATCH
  - `lib/understanding-engine-api.ts` — `modelUpdateCreateSchema`
  - `lib/__tests__/what-changed-route.test.ts` — What Changed surface tests
  - `lib/__tests__/what-changed-evidence-route.test.ts` — What Changed evidence tests
  - `lib/__tests__/today-intelligence-updates-route.test.ts` — Today surface tests
  - `lib/__tests__/today-surface.test.ts` — Today surface tests
  - `lib/__tests__/phase3-what-changed-page.test.ts` — What Changed page tests
  - `lib/__tests__/understanding-engine-phase1b-api.test.ts` — ModelUpdate route tests
  - `docs/phase2p-publish-acceptance-semantics-contract.md` — Phase 2P contract
  - `docs/phase2r-internal-candidate-publish-route-audit.md` — Phase 2R audit
  - `docs/engineering-ledger.md` — current ledger state
- **Semantic decisions (11 questions answered):**
  1. **Should publish create a ModelUpdate?** ✅ Yes — `conclusion_added` type
  2. **Synchronous or deferred?** ✅ Synchronous (same transaction)
  3. **What `ModelUpdateType`?** `conclusion_added`
  4. **What `userFacingSummary`?** Template: `"New conclusion: {title}"` (overridable)
  5. **What `beforeSummary`/`afterSummary`?** Both `null` (not set)
  6. **Should `isMeaningful` be true?** ✅ Yes
  7. **Evidence linking?** None needed — conclusion's existing evidence links suffice
  8. **Duplicate prevention?** Handled by existing `ALREADY_VISIBLE` precondition
  9. **Failure handling?** Transaction rollback — both operations or neither
  10. **Public/mobile impact?** Immediate — ModelUpdate appears on all user-facing routes
  11. **Safest next slice?** Phase 2T — ModelUpdate Creation on Publish (Implementation)
- **Failure/idempotency policy:**
  - Transaction failure: both operations roll back, caller can retry
  - Retry after success: `ALREADY_VISIBLE` prevents duplicate ModelUpdates
  - Database error: both operations fail, caller receives `INTERNAL_ERROR`
- **Forbidden premature behaviors (10):**
  - Schema changes to `ModelUpdate` model or enums
  - LLM-generated summaries
  - Evidence linking to ModelUpdate
  - Async/deferred ModelUpdate creation
  - ModelUpdate creation for unpublish or batch publish
  - Changes to user-facing routes or public/mobile projection
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (140 files, 2367 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No ModelUpdate creation on publish (next step)
  - No unpublish action
  - No user-facing publish UI
  - No batch publish
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Phase 2T — ModelUpdate Creation on Publish (Implementation)

---

## Phase 2T — ModelUpdate Creation on Publish

- **Status:** complete
- **Scope:** Create a `ModelUpdate` synchronously when a promoted `UserMapConclusion` candidate is published via the internal publish helper.
- **Runtime behavior:** Successful publish now atomically sets `visibility: user_visible` and creates a `conclusion_added` ModelUpdate (`isMeaningful: true`). Transaction failure rolls back both mutations.
- **Files changed:**
  - `lib/candidate-publish-helper.ts` — publish + ModelUpdate creation in `$transaction`
  - `lib/__tests__/phase2t-candidate-publish-helper.test.ts` — created (7 focused helper tests)
  - `lib/__tests__/phase2q-internal-candidate-publish-route.test.ts` — extended response-safety assertions
  - `docs/engineering-ledger.md` — this entry
- **Helper behavior:**
  - Fetches conclusion `title` for default summary template: `New conclusion: {title}`
  - Optional `userFacingSummary` override in `publishCandidate` options
  - `ModelUpdateType.conclusion_added`, `ModelUpdateVisibility.user_visible`, `affectedObjectType: usermap_conclusion`
  - `beforeSummary` / `afterSummary` left unset
  - Duplicate ModelUpdates prevented by existing `ALREADY_VISIBLE` precondition and a conditional `updateMany` guard inside the publish transaction (concurrency-safe)
- **Tests added/changed:**
  - Helper: successful ModelUpdate creation, transactional coupling, rollback on ModelUpdate failure, duplicate prevention, summary override, precondition errors
  - Route: response still omits ModelUpdate internals
- **What did not change:**
  - No schema changes
  - No public/mobile route changes
  - No UI changes
  - No changes to `UserMapConclusion.status`, `candidateLifecycleStatus`, or evidence links
  - No unpublish, expiry/scheduler, or lifecycle fields on other families
  - `scripts/verify-mindlab.sh` unchanged
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (141 files, 2374 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No unpublish action
  - No user-facing publish UI
  - No batch publish
  - No expiry scheduler
  - No lifecycle fields for other families
- **Next step:** Audit Phase 2T repair (concurrency-safe publish), then closeout if clean

### Phase 2T repair — concurrency-safe publish (2026-05-29)

- **Issue:** Two concurrent publish requests could both pass the pre-transaction visibility precheck and each create a `conclusion_added` ModelUpdate.
- **Fix:** Replaced unconditional `update` with conditional `updateMany` inside an interactive `$transaction`. ModelUpdate creation runs only when the guarded update affects exactly one row; zero rows throws `ALREADY_VISIBLE`.
- **Tests:** Added/adjusted helper tests for call ordering, zero-row guard, and concurrent publish simulation.

---

*Future entries will be appended below this line.*
