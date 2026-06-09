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

## Build Slice 4 — Internal Candidate Operator Workbench

- **Status:** complete
- **Scope:** Connect the internal User Map review page to existing candidate lifecycle and publish internal APIs.
- **Runtime behavior:** Internal reviewers can promote, hold, reject, and publish `internal_only` `UserMapConclusion` candidates from `/internal/user-map/review`; successful actions refresh the server-rendered list.
- **Files changed:**
  - `lib/internal-user-map-review-candidates.ts` — include `candidateLifecycleStatus` in internal list payloads
  - `lib/internal-user-map-review-operator-actions.ts` — operator action eligibility helpers
  - `lib/internal-user-map-review-operator-client.ts` — internal fetch client for lifecycle/publish routes
  - `app/(root)/(routes)/internal/user-map/review/_components/InternalUserMapReviewWorkbench.tsx` — client operator controls
  - `app/(root)/(routes)/internal/user-map/review/page.tsx` — wire workbench component
  - `lib/__tests__/internal-user-map-review-operator-actions.test.ts` — created
  - `lib/__tests__/internal-user-map-review-operator-client.test.ts` — created
  - `lib/__tests__/internal-user-map-review-workbench.test.ts` — created
  - `lib/__tests__/phase3-internal-user-map-review-page.test.ts` — updated for operator UI
  - `lib/__tests__/phase3-internal-user-map-review-api.test.ts` — updated for lifecycle field
- **Operator actions:**
  - Hold / Reject / Promote → `POST /api/internal/user-map/candidates/[id]/lifecycle` with `newStatus`
  - Publish → `POST /api/internal/user-map/candidates/[id]/publish` (only `promoted` + `internal_only`)
- **What did not change:**
  - No schema changes
  - No public/mobile routes or UI
  - No unpublish, batch publish, expiry automation, or other-family lifecycle
  - No raw evidence exposure
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (144 files, 2388 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No expiry scheduler
  - Legacy `null` lifecycle rows cannot use operator lifecycle buttons
- **Next step:** Operator expiry/legacy-row hardening only if product requests; UserMap proposal/bridge path code-complete in PR #11–#16 with unresolved runtime persistence caveat (see ledger entries below)

---

## Candidate Ladder Foundation — Four-Family Bridge + Evidence-Link Safety Closeout

- **Status:** complete
- **Scope:** Docs-only closeout of the four-family candidate ladder (UserMapConclusion, Investigation, FieldworkAssignment, ModelUpdate) and the evidence-link internal candidate leak guard (PR #32). No production code changes.
- **Runtime behavior:** unchanged (docs-only)
- **Status summary:** Candidate creation ladder: `CLOSED / RUNTIME VALIDATED`; candidate lifecycle + operator publishing: `PARTIAL`; Phase 2 umbrella: `PARTIAL`
- **Files changed:**
  - `docs/engineering-ledger.md` — this entry
  - `docs/mindlab-roadmap-status-ledger.md` — updated Phase 2 status
- **Candidate ladder (PR #31 — `e386f58`):**
  - **UserMapConclusion** — proposal → internal persistence → APP/import bridge wiring (mature, with lifecycle + publish routes)
  - **Investigation** — proposal → internal persistence → bridge wiring (no lifecycle/publish routes yet)
  - **FieldworkAssignment** — proposal → internal persistence → bridge wiring (no lifecycle/publish routes yet)
  - **ModelUpdate** — proposal → internal persistence → bridge wiring (no lifecycle/publish routes; uses `visibility` + `isMeaningful` instead of `candidateLifecycleStatus`)
- **Candidate precedence (enforced at two levels):**
  1. Orchestrator (`dark-run-orchestrator.ts`): builds only one proposal per run — highest-priority eligible family
  2. Bridge persistence (`candidate-bridge-dark-run-persistence.ts`): processes proposals in cascade — returns immediately after first successful persistence
  - Precedence order: UserMap → Investigation → Fieldwork → ModelUpdate
- **Duplicate detection:**
  - All four families check for duplicates before creating (application-level, inside transaction)
  - Duplicates return `DUPLICATE_CANDIDATE` in `blockedWriteReasons` with `candidatesWritten: 0`
  - No DB-level unique constraints (race window exists for concurrent bridge runs)
- **Evidence link cap:**
  - All four families use shared `curatePersistableEvidenceLinksForCandidate()` with default cap of 50
  - Diagnostics track `evidenceLinksSelectedBeforeCap`, `evidenceLinksSelectedAfterCap`, `evidenceLinkCapApplied`, `evidenceLinkCapLimit`
- **Runtime validation status:**
  - UserMap: runtime validated after evidence-link cap fix (bridge persistence validated on dev)
  - Investigation: bridge runtime validated (unit tests + integration)
  - Fieldwork: bridge runtime validated (unit tests + integration)
  - ModelUpdate: bridge runtime validated (unit tests + integration)
- **Evidence-link safety repair (PR #32 — `56bf048`):**
  - **Generic evidence-links GET** (`app/api/understanding/evidence-links/route.ts`): filters non-public/internal candidate targets
  - **Source-anchored evidence-links pagination**: preserves public eligible rows after filtering
  - **Generic evidence-links POST**: rejects non-public/internal targets
  - **relatedUnderstanding projections**: filter internal candidate target IDs
  - **Candidate persistence snippet/quote safety:**
    - UserMap: no longer writes `snippet`/`quote` to evidence links
    - Investigation: no longer writes `snippet`/`quote` to evidence links
    - Fieldwork: no longer writes `snippet`/`quote` to evidence links
    - ModelUpdate: already snippet/quote-free (unchanged)
- **Operational migration warning:**
  Environments must apply Investigation/Fieldwork visibility/lifecycle migrations before relying on runtime candidate persistence:
  - `20260602171545_add_investigation_visibility_and_candidate_lifecycle`
  - `20260604133000_add_fieldwork_assignment_visibility_and_candidate_lifecycle`
- **What remains partial:**
  - Candidate lifecycle + operator publishing remains partial for Investigation, Fieldwork, and ModelUpdate
  - Non-UserMap operator review UI (Investigation, Fieldwork, ModelUpdate candidates have no review surface)
  - Non-UserMap lifecycle routes (no lifecycle mutation endpoints for Investigation, Fieldwork, ModelUpdate)
  - Non-UserMap publish/promote routes (no publish endpoints for Investigation, Fieldwork, ModelUpdate)
  - ModelUpdate lacks `candidateLifecycleStatus` by design (uses `visibility` + `isMeaningful` instead)
  - Expiry scheduler absent (no automated cleanup of stale candidates)
  - DB-level duplicate uniqueness absent (application-level only; race window exists)
  - Mobile projection/operator surfaces not addressed
  - Docs/UX for operator provenance still incomplete
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: skipped (no code changes)
  - `npx vitest run`: skipped (no code changes)
  - `npm run build`: skipped (no code changes)
  - `bash scripts/check-trust-language.sh`: skipped (no code changes)
  - `bash scripts/check-legacy-surfaces.sh`: skipped (no code changes)
- **Next step:** Investigation lifecycle + publish route OR internal multi-family candidate review design. Should proceed only after this docs closeout is merged.

---

### Future entries will be appended below this line.

---

## Build Slice 4 — APP Message Internal Candidate Creation Bridge

- **Status:** complete
- **Scope:** Wire APP `journal_chat` / `explore_chat` message background path to a gated internal candidate bridge over existing no-write dark-run evaluation and candidate persistence.
- **Runtime behavior:** Eligible APP messages invoke the bridge in the message route background IIFE. The bridge runs trigger eligibility, no-write dark-run evaluation + harness, and calls `persistInternalUserMapConclusionCandidate` when structured `userMapCandidateProposal` data is present on dark-run output (orchestrator emits proposal since PR #11). Import-completion bridge follows the same pattern after pattern derivation (PR #12).
- **Files changed:**
  - `lib/understanding-dark-engine/app-message-candidate-bridge.ts` — created bridge module
  - `app/api/message/route.ts` — replaced no-op eligibility call with bridge invocation (fail-open)
  - `lib/__tests__/understanding-dark-engine-app-message-candidate-bridge.test.ts` — created focused bridge tests
  - `lib/__tests__/native-memory-reference-route.test.ts` — updated message route expectations for bridge wiring
  - `docs/engineering-ledger.md` — this entry
- **Bridge behavior:**
  - Session gate: APP + `journal_chat` or `explore_chat` only
  - Trigger gate: `resolveCandidateBridgeNoWriteTriggerEligibility` with `app_user_message` (runtime state from DerivationRun rows; PR #13)
  - Evaluation: `runNoWriteUnderstandingDarkRun` + `evaluateNoWriteDarkRunOutput`
  - Proposal gate: `extractStructuredUserMapCandidateProposal` requires explicit `userMapCandidateProposal` with `area`, `title`, `summary`, `target`
  - Persistence: `persistInternalUserMapConclusionCandidate` when gates pass and proposal exists
  - Fail-open: bridge errors logged; message stream unchanged
- **What did not change:**
  - No schema/UI/mobile changes
  - No user_visible writes or automatic publish from bridge paths
  - No ModelUpdate creation from bridge path
  - No invented candidate content in production
- **Superseded note:** Structured proposal emission and automatic bridge persistence were added in PR #11–#16; see ledger entries below.
- **Verification results (initial slice):**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (145 files, 2394 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass

---

## Internal Four-Family Candidate Review Workbench — Closeout (2026-06-06)

- **Status:** `CLOSED / VALIDATED` (operator review workflow; docs-only closeout)
- **Validation base:** `be38253` on `main`
- **Scope:** Hidden internal operator workbench at `/internal/user-map/review` for all four candidate families: `UserMapConclusion`, `Investigation`, `FieldworkAssignment`, and `ModelUpdate`.
- **Runtime behavior:** Allowlisted internal reviewers can list `internal_only` candidates per family, inspect safe provenance summaries (counts, source-type breakdown, linked source IDs, derivation run/artifact refs), run lifecycle actions where applicable, and publish to user-visible surfaces. Successful publish/lifecycle actions refresh the server-rendered list.
- **Public navigation:** Public nav does not expose internal review.
- **Family models:**

| Family | Candidate state | Lifecycle actions | Publish behavior | Review list filter |
|---|---|---|---|---|
| **UserMap** | `visibility: internal_only` + `candidateLifecycleStatus` | Promote / Hold / Reject → `POST /api/internal/user-map/candidates/[id]/lifecycle` | `POST /api/internal/user-map/candidates/[id]/publish` when `promoted` + `internal_only`; creates `conclusion_added` ModelUpdate | `internal_only` |
| **Investigation** | `visibility: internal_only` + non-null `candidateLifecycleStatus` | Promote / Hold / Reject → `POST /api/internal/investigations/candidates/[id]/lifecycle` | `POST /api/internal/investigations/candidates/[id]/publish` when `promoted` + `internal_only` + public Active Question status; creates `investigation_opened` ModelUpdate | `internal_only` |
| **Fieldwork** | `visibility: internal_only` + non-null `candidateLifecycleStatus` | Promote / Hold / Reject → `POST /api/internal/fieldwork/candidates/[id]/lifecycle` | `POST /api/internal/fieldwork/candidates/[id]/publish` when `promoted` + `internal_only` + Watch-For-visible status; creates `fieldwork_assigned` ModelUpdate | `internal_only` |
| **ModelUpdate** | `visibility: internal_only` + `isMeaningful: false` (no `candidateLifecycleStatus`) | **None** — no lifecycle buttons | `POST /api/internal/model-updates/candidates/[id]/publish` when `internal_only` + `!isMeaningful` + at least 1 user-owned `UnderstandingEvidenceLink` (`targetType: model_update`); flips the existing row only (`user_visible`, `isMeaningful: true`) and does **not** create another ModelUpdate | `internal_only` + `isMeaningful: false` |

- **Evidence safety (review + publish):**
  - Review list APIs and workbench cards expose provenance summaries only: link counts, source-type counts, safety levels from link meta, linked `sourceType`/`sourceId` pairs, derivation run/artifact refs, safe diagnostics fields.
  - No raw `snippet`, `quote`, `message body`, link `summary`, or raw `internalNotes` rendered in review payloads or cards.
  - Candidate persistence strips `snippet`/`quote` on UserMap, Investigation, and Fieldwork evidence-link writes; ModelUpdate persistence was already snippet/quote-free (PR #32).
  - Public evidence guards from PR #32 remain intact on generic evidence-links routes and public continuity projections.
  - ModelUpdate publish rejects rows without provenance (`MODEL_UPDATE_MISSING_EVIDENCE` → 422) before visibility flip.
  - Client operator modules avoid `prismadb` and server-helper imports; Fieldwork publishability uses client-safe `lib/fieldwork-status-publishability.ts`.
- **Workbench surfaces shipped:**
  - User Map tab — lifecycle + publish
  - Investigation tab — lifecycle + publish
  - Fieldwork tab — lifecycle + publish
  - ModelUpdate tab — publish-only; no Promote/Hold/Reject buttons
- **Key backend routes/helpers:**
  - List: `GET /api/internal/user-map/review-candidates`, `GET /api/internal/investigations/review-candidates`, `GET /api/internal/fieldwork/review-candidates`, `GET /api/internal/model-updates/review-candidates`
  - Publish: family-specific `POST .../candidates/[id]/publish` routes above
  - Loaders: `lib/internal-user-map-review-candidates.ts`, `lib/internal-investigation-review-candidates.ts`, `lib/internal-fieldwork-review-candidates.ts`, `lib/internal-model-update-review-candidates.ts`
  - Operator helpers: `lib/internal-user-map-review-operator-actions.ts`, `lib/internal-user-map-review-operator-client.ts`
  - UI: `app/(root)/(routes)/internal/user-map/review/page.tsx`, `InternalUserMapReviewWorkbench.tsx`
- **Published ModelUpdate visibility:** After publish, rows appear on public What Changed / Today intelligence / Timeline model layers (`user_visible` + `isMeaningful: true` filters). UserMap/Investigation/Fieldwork publish also creates a separate meaningful ModelUpdate receipt row.
- **What remains partial:**
  - No unified cross-family candidate queue
  - No expiry scheduler / automated stale-candidate cleanup
  - No DB-level duplicate uniqueness (application-level dedupe only; race window remains)
  - No mobile operator surface
  - ModelUpdate has **no reject/archive route** unless separately designed (unpublishable rows remain `internal_only`)
  - Legacy UserMap rows with `candidateLifecycleStatus: null` still lack lifecycle buttons
  - Phase 2 umbrella remains **PARTIAL** — broader gated persistence/model movement, scheduler/cron, and other Phase 2 scope items are not closed by this operator slice
- **Files changed:** `docs/engineering-ledger.md`, `docs/mindlab-roadmap-status-ledger.md`
- **Verification (this docs closeout):** clean working tree; `git diff --check`: pass; `npx tsc --noEmit`: pass; workbench tests: pass; page tests: pass; `npx vitest run`: pass (2757 tests); `npm run build`: pass; `bash scripts/check-trust-language.sh`: pass; `bash scripts/check-legacy-surfaces.sh`: pass

---

## UserMapConclusion internal candidate loop — PR #11–#16 closeout (2026-06-02)

- **Status:** proposal/bridge path code-complete with unresolved runtime persistence caveat on `main` @ `7b871ad` (PR #11–#16 merged; fresh e2e persistence validation still pending)
- **Scope:** Internal `UserMapConclusion` candidate path (code): structured proposal → APP/import bridges → runtime trigger state → operator provenance readout → proposal title/summary hardening.

### PR #11 — Structured UserMap candidate proposal output (`3670988`, `cc3aea9`)

- **Commits:** `3670988` — Emit structured user map candidate proposals; merge `cc3aea9` — PR #11
- **Behavior:** `buildStructuredUserMapCandidateProposal()` attaches `userMapCandidateProposal` to `runNoWriteUnderstandingDarkRun` output when gates pass and a safe-summary anchor exists.
- **Files:** `lib/understanding-dark-engine/user-map-candidate-proposal.ts`, `lib/understanding-dark-engine/dark-run-orchestrator.ts`, bridge extractors, focused tests.

### PR #12 — Import-completion candidate bridge (`22a3cd2`, `0718bab`, `1390fe1`)

- **Commits:** `22a3cd2` — Wire import completion to candidate bridge; repair `0718bab` — Run import candidate bridge after pattern derivation; merge `1390fe1` — PR #12
- **Behavior:** `tryCreateInternalUserMapCandidateFromImportCompletion()` on successful import completion; runs **after** `patternBatchOrchestrator.runForUser({ trigger: "import" })` so packet assembly sees derived pattern evidence; fail-open.
- **Files:** `lib/understanding-dark-engine/import-completion-candidate-bridge.ts`, `lib/import-upload-queue.ts`, tests.

### PR #13 — No-write trigger eligibility runtime state (`90212c6`, `73e2c38`, `9b6d77b`)

- **Commits:** `90212c6` — Wire no-write trigger eligibility runtime state; repair `73e2c38` — Use run window end for no-write evidence cutoff; merge `9b6d77b` — PR #13
- **Behavior:** `resolveCandidateBridgeNoWriteTriggerEligibility()` loads `DerivationRun` state (`lastRunAt` from `createdAt`, no-new-evidence cutoff from `windowEnd` with `createdAt` fallback); wired into APP and import bridges; fail-open on load errors.
- **Files:** `lib/understanding-dark-engine/no-write-trigger-runtime-state.ts`, both bridges, tests.

### PR #14 — Internal candidate provenance readout (`50e4ef0`, `7da8706`, `5af58db`)

- **Commits:** `50e4ef0` — Add internal candidate provenance readout; repair `7da8706` — Fix internal candidate provenance normalization; merge `5af58db` — PR #14
- **Behavior:** Internal review list API and workbench show safe provenance: evidence counts, source-type breakdown, linked source IDs, safety levels from link meta, derivation run/artifact refs, safe diagnostics payload fields; no raw snippets/quotes.
- **Files:** `lib/internal-user-map-review-candidates.ts`, `InternalUserMapReviewWorkbench.tsx`, tests.

### PR #15 — Candidate proposal title hardening (`8d05926`, `4fea1ef`)

- **Commits:** `8d05926` — Harden user map candidate proposal titles; merge `4fea1ef` — PR #15
- **Behavior:** Titles use word-boundary truncation (120 char max), whitespace normalization, deterministic evidence-selection ordering before anchor pick.
- **Files:** `lib/understanding-dark-engine/user-map-candidate-proposal.ts`, tests.

### PR #16 — Candidate proposal summary shaping (`154dd3b`, `a26c6a9`, `7b871ad`)

- **Commits:** `154dd3b` — Shape user map candidate proposal summaries; repair `a26c6a9` — Filter proposal summary wording sources; merge `7b871ad` — PR #16
- **Behavior:** `buildProposalSummary()` combines distinct safe summaries from wording-eligible source types (`pattern_claim`, `contradiction_node` only); single-summary fallback unchanged; excludes `import_record` and other metadata/admin types from persisted summary text; 600 char cap.

### Post-PR #16 runtime validation caveat (2026-06-02, dev DB)

Ephemeral validation against local dev DB on auto-selected user `user_34TUYA53pI1QRLK73O22Kve1a1G` at `7b871ad`:

- **Proposal path validated:** trigger eligibility; dry-run gates `pass`; `userMapCandidateProposal` present; title shaping (≤120 chars, normalized); summary shaping (600 chars, distinct from title); targeted proposal + bridge unit tests (21 passed).
- **Bridge persistence not re-proven on this dev user:** `skipped_persistence_blocked` with `blockedWriteReasons: ["LINK_WRITE_FAILED"]` — no `UserMapConclusion` row or evidence links observed. Orphan `DerivationRun` / diagnostics artifact from the attempt were removed after validation. `LINK_WRITE_FAILED` is unresolved (catch-all for evidence-link write exceptions other than ownership mapping to `UNRESOLVED_OWNERSHIP` in `persistInternalUserMapConclusionCandidate`); **LINK_WRITE_FAILED follow-up debug recommended** in a separate targeted slice before claiming fresh end-to-end persistence validation.
- **Docs-only audit:** no production code change from this closeout pass.

### What remains partial

- **Fresh e2e persistence validation still pending** (bridge write path on dev/prod-like data after post-PR #16 run)
- No expiry scheduler for `internal_only` candidates
- Legacy `candidateLifecycleStatus: null` rows lack operator lifecycle buttons
- No other candidate families (Investigation, FieldworkAssignment, ModelUpdate candidates, agents, Intelligence Library)

### Verification (docs closeout)

- `git diff --check`: pass (docs-only)

---

## Investigation candidate schema + public leak guard (investigation-candidate-schema-guard)

- **Status:** complete (schema guard only; no dark-engine Investigation candidates)
- **Scope:** Add `InvestigationVisibility` + nullable `candidateLifecycleStatus` on `Investigation`; filter Active Questions public surfaces to `user_visible` rows with null or `promoted` lifecycle only.
- **Schema:** `InvestigationVisibility` enum (`user_visible`, `internal_only`); `Investigation.visibility` defaults `user_visible`; `Investigation.candidateLifecycleStatus` nullable; index `[userId, visibility, status, updatedAt]`.
- **Migration:** `20260602171545_add_investigation_visibility_and_candidate_lifecycle`
- **Runtime behavior:** Public Active Questions list/detail/evidence queries use `buildPublicActiveInvestigationWhere()`; only `user_visible` investigations with `candidateLifecycleStatus` in `PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES` (`null`, `promoted`) are eligible. Prisma OR filters and `isPublicActiveInvestigationCandidateLifecycle()` share that single allow-list (fail-closed; `undefined` ineligible).
- **Files changed:** `prisma/schema.prisma`, migration above, `lib/investigation-public-visibility.ts`, `lib/active-questions.ts`, Active Questions API routes/pages, `lib/__tests__/investigation-public-visibility.test.ts`, `lib/__tests__/investigation-active-questions-public-guard.test.ts`, Active Questions route/page tests, `lib/__tests__/understanding-engine-phase1a-schema.test.ts`.
- **Verification results:** `git diff --check`, `npx prisma generate`, `npx tsc --noEmit`, targeted Investigation/Active Questions vitest, `npm run verify` — pass on branch after CodeRabbit repair.
- **What remains partial:** dark-engine Investigation proposal/persistence/bridges; internal Investigation review UI; Fieldwork/ModelUpdate candidate lifecycle; generic Candidate table.
- **Next step:** Investigation no-write proposal slice, then `persistInternalInvestigationCandidate`, then bridge fork on UserMap abstain.

---

## LINK_WRITE_FAILED diagnostics classification (fix-link-write-failed-diagnostics)

- **Status:** complete (implementation + tests; runtime root-cause still unknown)
- **Scope:** Narrow transaction catch diagnostics in `persistInternalUserMapConclusionCandidate`; no schema, UI, or bridge changes.
- **Runtime behavior:** Public/user-facing outcomes unchanged; transaction rollback unchanged. Internal diagnostics artifact payload and notes gain transaction-failure fields; blocked reasons split by failure path.
- **Blocked reason changes:**
  - `CONCLUSION_WRITE_FAILED` — transaction error before any evidence link attempt (`evidenceLinksAttempted === 0` at catch)
  - `EVIDENCE_LINK_DUPLICATE` — `UnderstandingEvidenceLinkDuplicateError`
  - `UNRESOLVED_OWNERSHIP` — `UnderstandingEvidenceLinkValidationError` (unchanged semantics)
  - `LINK_WRITE_FAILED` — generic failures after at least one link attempt only
- **Diagnostics payload fields added:** `transactionFailureErrorName`, `transactionFailureErrorMessage`, `transactionFailurePrismaCode`, `transactionFailureBeforeAnyLinkAttempt`, `transactionFailureEvidenceLinksAttempted` (mirrored in `notes` with `transactionFailure*` prefixes).
- **Files changed:**
  - `lib/understanding-dark-engine/user-map-candidate-persistence.ts`
  - `lib/__tests__/understanding-dark-engine-user-map-candidate-persistence.test.ts`
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run lib/__tests__/understanding-dark-engine-user-map-candidate-persistence.test.ts`: pass (11 tests)
  - `npx vitest run`: pass (149 files, 2437 tests on branch)
  - `npm run build`: pass (after clean `.next`; first verify attempt hit transient `routes.js` / manifest flake)
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:** Post-PR #16 dev `LINK_WRITE_FAILED` root cause not fixed; **runtime validation on dev user still required** after merge to read new blocked reason + transaction failure fields from the next bridge persistence attempt.
- **Next step:** Re-run import/APP candidate bridge persistence on dev; inspect diagnostics artifact for classified `blockedWriteReasons` and `transactionFailure*` fields.

---

## Product Polish + Runtime Confidence Block — Closeout (2026-06-07)

- **Status:** `CLOSED / VALIDATED` (docs-only closeout)
- **Validation base:** `f5c64d5` on `main` (post PR #47 merge)
- **Scope:** Five merged polish/validation slices. No new schema, routes, lifecycle semantics, or production behavior from this closeout.

### Slices closed

1. **Public provenance polish** (PR #43) — standardized public-safe linked object/evidence labels and fallback copy; `PublicLinkedObjectContinuity`; applied across Your Map, Active Questions, Watch For, What Changed, Today, and Timeline; no raw snippet/quote/message body/internalNotes exposure.
2. **Internal operator workflow polish** (PR #45) — four-family internal review workbench triage filters, family counts, readiness labels, grouped cards, clearer empty states, pending/error display; UserMap / Investigation / Fieldwork remain lifecycle-managed; ModelUpdate remains publish-only; no new lifecycle semantics.
3. **Today / Timeline coherence** (PR #44) — unified Today Intelligence snapshot; unwired media affordance removed; Timeline model movement integrated into Activity & changes; partial failure states hardened; Europe/London timeline date grouping fixed.
4. **Public understanding surfaces polish** (PR #46) — Your Map, Active Questions, and Watch For list/detail pages share clearer structure, intros, empty states, safe evidence/provenance framing, and cross-links; no route/API shape changes.
5. **Candidate-loop runtime smoke validation** (PR #47) — committed test-only proof in `lib/__tests__/candidate-loop-runtime-smoke.test.ts`: bridge persistence → lifecycle/publish → public visibility/provenance; UserMap full loop + Investigation companion path; in-memory only; no live DB or credentials.

### Verification (post PR #47)

- `npx vitest run lib/__tests__/candidate-loop-runtime-smoke.test.ts`: 4 passed
- `npx vitest run`: 181 files / 2778 tests passed
- `npx tsc --noEmit`: pass
- `npm run build`: pass
- `bash scripts/check-trust-language.sh`: pass
- `bash scripts/check-legacy-surfaces.sh`: pass

### What this closeout does not claim

- Phase 2 is **not** fully closed.
- Candidate lifecycle cleanup / stale candidate policy is **not** complete.
- Expiry scheduler, DB-level duplicate uniqueness, and ModelUpdate reject/archive semantics **do not** exist.

### What remains partial

- Candidate lifecycle cleanup / stale candidate policy
- Expiry scheduler
- DB-level duplicate uniqueness
- ModelUpdate reject/archive semantics
- Possible future mobile polish only if product review finds gaps
- Known unused-variable build warnings remain non-blocking

### Next exact step

Run a candidate lifecycle cleanup design audit covering stale-candidate policy, expiry scheduler sequencing, ModelUpdate reject/archive semantics, and whether DB-level duplicate uniqueness is warranted before implementing any lifecycle cleanup.

### Supersedes prior caveat

- PR #47 committed runtime smoke validates integrated candidate-loop seams in-memory (bridge → lifecycle/publish → public visibility/provenance). This supersedes earlier ledger notes that the assembled loop was unvalidated at the test harness level. Live-DB operator validation remains a separate operational concern.

- **Files changed:** `docs/engineering-ledger.md`, `docs/mindlab-roadmap-status-ledger.md`
- **Verification (this docs closeout):** `git diff --check`: pass

---

## Candidate Loop Runtime Validation Block — Closeout (2026-06-09)

- **Status:** `CLOSED / VALIDATED` (docs-only closeout)
- **Validation base:** `1762b85` on `main` (post PR #52 merge)
- **Scope:** Operational validation of candidate creation, lifecycle diagnostics, and review/publish on real imported dev data. No new schema, routes, UI, lifecycle policy, or production behavior from this closeout.

### Slices closed

1. **Candidate lifecycle diagnostics report** (PR #50, `e5b1b8b`) — read-only stale/duplicate diagnostics helper + `scripts/report-candidate-lifecycle-diagnostics.ts`; fingerprint-only output; no raw evidence/text.
2. **Candidate creation runtime validation** (PR #51, `72fb3ff`) — `lib/candidate-creation-runtime-validation.ts` + `scripts/run-candidate-creation-runtime-validation.ts`; dry-run default; `--execute` uses existing dark-run + bridge persistence via `manual_internal` override; counts internal candidate-lane rows only; uses latest **completed** import session for diagnosis.
3. **UserMap review/publish runtime validation** (PR #52, `1762b85`) — `lib/validate-user-map-candidate-review-publish-flow.ts` + `scripts/validate-user-map-candidate-review-publish-flow.ts`; dry-run default; `--execute` uses existing `updateCandidateLifecycleStatus` + `publishCandidate` helpers.

### Dev dataset confirmed (imported user `user_34TUYA53pI1QRLK73O22Kve1a1G`)

- Sessions: 640; messages: 18,582; evidenceSpans: 5,922; patternClaims: 7
- All sessions `IMPORTED_ARCHIVE`; zero APP bridge-eligible sessions
- Import completed **before** candidate bridge wiring — zero candidates until manual validation execute

### Candidate creation validation proved

- Dark-run harness passed; UserMap proposal present (`operating_logic`)
- Persistence works via existing bridge helper (`--execute` on creation validation script)
- Root cause of pre-validation zero candidates: **event-only triggers** (import completion + APP messages); no backfill for already-complete imports
- `candidateCountsBefore`/`After` count internal candidate lane only (not user-visible production rows)
- Diagnosis uses `latestCompletedImportSession` (`status: complete`), not pending/failed imports

### Real UserMapConclusion candidate (created by validation execute)

- id: `cmq6frqdx0000ql8h6nkavzue`
- area: `operating_logic`; status: `emerging`
- visibility: `internal_only` → `user_visible` (after publish validation)
- candidateLifecycleStatus: `proposed` → `held_for_more_evidence` → `promoted` (publish validation)
- confidenceScore: `0.85`; confidenceLevel: `medium`
- evidenceCount: `50`; sourceDiversity: `9`
- Lifecycle diagnostics after creation: UserMapConclusion total 1; stale 0; duplicate clusters 0; Investigation/Fieldwork/ModelUpdate candidates 0

### Review/publish validation proved (PR #52 execute on real candidate)

- Lifecycle path: `proposed → held_for_more_evidence → promoted` (direct `proposed → promoted` is **not** allowed per Phase 2K policy)
- Publish changes visibility `internal_only` → `user_visible`; `candidateLifecycleStatus` remains `promoted`; `status` remains `emerging`
- Evidence/provenance: 50 `understandingEvidenceLink` rows preserved
- Public Your Map visibility: true after publish
- Publish creates meaningful user-visible ModelUpdate: `updateType: conclusion_added`, `visibility: user_visible`, `isMeaningful: true` (id `cmq6h8ewn0000qlbwlg485jx1` on dev)

### What this closeout does not claim

- Phase 2 umbrella is **not** fully closed
- No automatic candidate backfill for legacy imports
- No expiry scheduler, DB-level duplicate uniqueness, or ModelUpdate reject/archive semantics
- Investigation/Fieldwork/ModelUpdate candidate creation on imported data not validated in this block
- Live-DB validation used dev scripts only; internal HTTP routes require Clerk reviewer auth (helpers are sufficient)

### What remains partial

- Candidate lifecycle cleanup / stale policy implementation (diagnostics exist; no scheduler/auto-expiry)
- Expiry scheduler
- DB-level duplicate uniqueness
- ModelUpdate reject/archive semantics
- Non-UserMap candidate backfill/validation on imported data
- Broader four-family live-DB operator validation beyond UserMap

### Next exact step

Decide the next product/backend slice separately. Candidate lifecycle cleanup (stale policy, expiry sequencing, ModelUpdate reject/archive, DB uniqueness) remains a design decision — not started by this closeout.

### Supersedes prior caveat

- PR #47 in-memory smoke + this block's live-DB validation together close the "candidate loop unvalidated" gap for UserMap on imported dev data. Prior Product Polish closeout "live-DB operator validation remains separate" is now addressed for UserMap create → review → publish.

- **Files changed:** `docs/engineering-ledger.md`, `docs/mindlab-roadmap-status-ledger.md`
- **Verification (this docs closeout):** `git diff --check`: pass; `npx tsc --noEmit`: pass; `npm run build`: pass; `bash scripts/check-trust-language.sh`: pass; `bash scripts/check-legacy-surfaces.sh`: pass. Docs-only — no test run required.

---

## Public UserMapConclusion API Projection Closeout (2026-06-09)

- **Status:** `CLOSED / VALIDATED` (docs-only closeout)
- **Validation base:** `2c54bce` on `main` (`origin/main` synced)
- **Scope:** Record the published UserMapConclusion read-model audit and the three-commit public API response projection fix. No new schema, candidate generation, internal review/publish semantics, routes, UI, or mobile changes in this closeout.

### Read-model audit findings (pre-fix)

1. **Web Your Map list/detail** — already safe: explicit Prisma `select` + `toYourMapListItem` / `toYourMapDetailItem` in `app/(root)/(routes)/your-map/**`.
2. **Evidence continuity** — safe: `listYourMapPublicEvidenceContinuity` allowlists verified `pattern_claim` / `contradiction_node` labels only; no raw snippets.
3. **Internal review pool exclusion** — worked: published candidates (`visibility: user_visible`) no longer appear in `internal_only` review queries.
4. **ModelUpdate surfaces** — worked: What Changed / Today / Timeline model layers consume `user_visible` + `isMeaningful: true` updates after publish.
5. **REST public UserMapConclusion API** — **leaked full Prisma rows** on success responses before projection fix.

### Response projection fixes (three commits)

| Commit | Message | Routes fixed |
|--------|---------|--------------|
| `0b4641d` | Project public user map API responses | `GET /api/user-map/conclusions`, `GET /api/user-map/conclusions/[id]` |
| `c2b4749` | Project public user map PATCH response | `PATCH /api/user-map/conclusions/[id]` |
| `2c54bce` | Project public user map POST response | `POST /api/user-map/conclusions` |

### Public response contract (post-fix)

Public GET/PATCH/POST responses now use `toUserMapConclusionPublicApiListItem` / `toUserMapConclusionPublicApiDetailItem` from `lib/public-intelligence-safe-slice.ts` with explicit Prisma `select`.

**Omitted from public responses:** `candidateLifecycleStatus`, `notes`, `confidenceScore`, `visibility`, `userId`, `version`, supersession fields, and other internal/schema fields.

**Exposed safe fields:** `id`, `title`, `summary`, `area`, `status`, `confidenceLevel`, `evidenceCount`, `sourceDiversity`, `timeSpreadDays`, `createdAt`, `updatedAt`.

### Phase 2P compliance

Phase 2P §4.9 requires that `candidateLifecycleStatus` must not appear in user-facing API responses. That requirement is now satisfied for all public UserMapConclusion routes (`GET` list/detail, `PATCH`, `POST`).

### What did not change

- No candidate creation or dark-engine generation semantics changed.
- No internal review routes, lifecycle routes, or publish helper semantics changed.
- No schema changes.
- No mobile code changed; mobile/API consumers now inherit safe projected backend responses automatically.

### POST product/governance note

- `POST /api/user-map/conclusions` remains a documented Phase 1B **manual-create** affordance (`docs/step4b-phase1b-additive-api-contract.md`).
- It can create `user_visible` conclusions directly, bypassing the candidate lifecycle.
- That bypass is a **product/governance** question, not a response-projection leak.
- Production intelligence flow remains: dark-engine candidate creation → internal review → publish (`POST /api/internal/user-map/candidates/[id]/publish`).
- **Optional future decision:** whether to keep, deprecate, or restrict the manual POST creation path.

### Code files changed (prior implementation commits)

- `app/api/user-map/conclusions/route.ts`
- `app/api/user-map/conclusions/[id]/route.ts`
- `lib/public-intelligence-safe-slice.ts`
- `lib/__tests__/understanding-engine-phase1b-api.test.ts`
- `lib/__tests__/phase3-internal-user-map-review-api.test.ts`
- `lib/__tests__/phase3-public-intelligence-safe-slice.test.ts`

### What remains partial

- Phase 2 umbrella remains **partial** (unchanged by this closeout).
- Optional product decision on manual `POST` path governance.
- Candidate lifecycle cleanup, expiry scheduler, DB-level duplicate uniqueness, and ModelUpdate reject/archive remain open (unchanged).

### Next exact step

No code follow-up required for UserMapConclusion public API projection. Optional docs-only follow-up: note in `docs/step4b-phase1b-additive-api-contract.md` that manual POST is legacy relative to the publish path.

- **Files changed (this closeout):** `docs/engineering-ledger.md`, `docs/mindlab-roadmap-status-ledger.md`
- **Verification (this docs closeout):** `git diff --check`: pass; `npx tsc --noEmit`: pass; `npm run build`: pass; `bash scripts/check-trust-language.sh`: pass; `bash scripts/check-legacy-surfaces.sh`: pass. Docs-only — no test run required.

---

## Internal Candidate Review Operator Workflow Audit Closeout (2026-06-09)

- **Status:** `CLOSED / VALIDATED` (docs-only audit closeout; no code changes)
- **Validation base:** `ce03ce8` on `main`
- **Scope:** Read-only audit confirming whether allowlisted internal reviewers can complete the UserMapConclusion candidate review/publish loop through existing app surfaces without ad hoc scripts. No schema, routes, UI, candidate generation, or runtime behavior changes in this closeout.

### Audit verdict

**The core UserMapConclusion operator loop is already usable through the app.** An allowlisted reviewer can list, hold, promote, reject, expire (where allowed), and publish `internal_only` candidates from the hidden four-family workbench at `/internal/user-map/review` without validation scripts.

`docs/step7-hidden-internal-user-map-review-page-closeout.md` describes an **older read-only** page checkpoint. It is **superseded** by the current operator workbench (Build Slice 4 + Internal Four-Family Candidate Review Workbench closeout on `be38253`). Do not treat Step 7 as the current capability ceiling.

### Current operator workflow

| Surface | Detail |
|---------|--------|
| **Hidden page** | `/internal/user-map/review` (not in public nav) |
| **Families** | UserMapConclusion, Investigation, FieldworkAssignment, ModelUpdate (tabbed workbench) |
| **Reviewer gate** | `INTERNAL_USER_MAP_REVIEWER_IDS` (empty allowlist denies all) |
| **List API** | `GET /api/internal/user-map/review-candidates` (+ parallel family list routes) |
| **Lifecycle API** | `POST /api/internal/user-map/candidates/[id]/lifecycle` with `newStatus` |
| **Publish API** | `POST /api/internal/user-map/candidates/[id]/publish` |

**UserMapConclusion operator path (UI + API):**

- `proposed → held_for_more_evidence` — Hold for more evidence
- `held_for_more_evidence → promoted` — Promote
- `promoted → publish` — Publish (when `internal_only`)
- Reject and Expire where Phase 2K transitions allow
- **Direct `proposed → promoted` remains intentionally disallowed** (matches PR #52 live validation)

Successful actions refresh the server-rendered list via `router.refresh()`.

### Publish behavior

- Requires `candidateLifecycleStatus: promoted` and `visibility: internal_only`
- Changes `visibility` to `user_visible` only (Phase 2P semantics unchanged)
- Creates meaningful `conclusion_added` ModelUpdate on publish
- Published candidates **disappear** from the `internal_only` review pool on refresh (code filter + prior PR #52 validation for `cmq6frqdx0000ql8h6nkavzue`)

### Evidence / provenance safety

- Internal workbench shows safe provenance: link counts, source-type breakdown, safety levels, linked `sourceType`/`sourceId` pairs, derivation run/artifact refs, safe diagnostics fields
- Does **not** render raw snippets, quotes, or message bodies on review cards
- Public UserMapConclusion routes are safely projected after `0b4641d`, `c2b4749`, `2c54bce` (no `candidateLifecycleStatus` or full Prisma row leakage on public GET/PATCH/POST)

### Scripts are dev/validation aids (not required for normal operator workflow)

| Script / helper | Role |
|-----------------|------|
| `scripts/validate-user-map-candidate-review-publish-flow.ts` | Live-DB validation bypassing Clerk HTTP |
| `lib/validate-user-map-candidate-review-publish-flow.ts` | Direct helper calls for CLI proof |
| `scripts/report-candidate-lifecycle-diagnostics.ts` | Read-only stale/duplicate diagnostics |

### Operational requirements

- Deployment must set `INTERNAL_USER_MAP_REVIEWER_IDS` with comma-separated Clerk user IDs
- Reviewers must know the hidden URL `/internal/user-map/review`
- Empty User Map candidate tab is **not** a workflow bug when all candidates are published or none exist
- Local DB was **unavailable** during this audit (`localhost:5432` unreachable); current live pool state was not rechecked. Published-candidate exclusion from the internal review pool is supported by code filters and prior PR #52 validation.

### Remaining optional follow-ups (not blockers)

- Document reviewer URL and allowlist setup in ops/runbook material
- Optionally show ModelUpdate ID / Your Map link in publish success message
- Optionally surface read-only stale/duplicate diagnostics on workbench header
- Optionally support legacy `candidateLifecycleStatus: null` initialization if legacy rows exist in production
- Optionally add supersede UI (`promoted → superseded`)

**No code implementation is required** for the core UserMap operator loop based on this audit.

### What did not change

- No schema, candidate generation, internal review routes, publish helper semantics, public routes, mobile, or UI changes in this closeout

### What remains partial (unchanged)

- Phase 2 umbrella remains **partial**
- No expiry scheduler, DB-level duplicate uniqueness, ModelUpdate reject/archive route
- Legacy `candidateLifecycleStatus: null` rows still lack lifecycle buttons
- No mobile operator surface

### Next exact step

No mandatory code follow-up from this audit. Optional ops/docs: reviewer allowlist + hidden URL runbook note.

- **Files changed (this closeout):** `docs/engineering-ledger.md`, `docs/mindlab-roadmap-status-ledger.md`, `docs/step7-hidden-internal-user-map-review-page-closeout.md` (supersession note only)
- **Verification (this docs closeout):** `git diff --check`: pass; `npx tsc --noEmit`: pass; `npm run build`: pass; `bash scripts/check-trust-language.sh`: pass; `bash scripts/check-legacy-surfaces.sh`: pass. Docs-only — no test run required.

---

## Mobile Published Intelligence Parser Parity Closeout (2026-06-09)

- **Status:** `CLOSED / VALIDATED` (docs-only closeout; mobile implementation already merged)
- **Validation base:** backend `6c9a4e3` on `main`; mobile `845fe7c — Align mobile intelligence update parsers` on `/Users/user/Mindlabs-app` `main`
- **Scope:** Record closure of the mobile/web published-intelligence parity gap for Today and Timeline ModelUpdate rows discovered in Agent 5 audit. No backend code, schema, routes, candidate generation, or mobile code changes in this closeout.

### Audit findings (Agent 5 — mobile/web parity)

| Surface | Web | Mobile |
|---------|-----|--------|
| Your Map list/detail | Wired and safe | Wired and safe; minor list-area label degradation only |
| What Changed | Wired and safe | Wired and safe |
| Today ModelUpdate | Wired and safe | Wired but **parser-incompatible** with current backend payload shape |
| Timeline ModelUpdate | Wired and safe | Wired but **parser-incompatible** with current backend payload shape |

**Root cause:** Backend Today/Timeline routes return label-shaped fields (`updateTypeLabel`, `affectedObjectTypeLabel`, `affectedObjectHref`, `userFacingSummary`, `createdAt`). Mobile parsers only accepted enum-shaped fields (`updateType`, `affectedObjectType`). Result: mobile Today and Timeline could **silently drop** backend-shaped ModelUpdate rows.

### Mobile fix (Agent 7 — `845fe7c`)

**Files changed (mobile repo):**

- `src/lib/backend-chat-api.ts`
- `src/components/MindLabPrototype.today-alignment.test.ts`
- `src/components/MindLabPrototype.timeline-model-layers-alignment.test.ts`

**What changed:**

- Today parser now accepts **enum-shaped rows and label-shaped backend rows**
- Timeline model-layer parser now accepts **enum-shaped rows and label-shaped backend rows**
- `userFacingSummary`, `createdAt`, and `affectedObjectHref` are preserved through parsing
- Internal fields remain not stored or rendered
- Optional Your Map list fallback now maps `area` before defaulting to `"Conclusion"`

**Backend was not changed.**

### Related prior closeout (unchanged)

Public UserMapConclusion API projection remains **closed** from the prior backend block (`0b4641d`, `c2b4749`, `2c54bce`). This closeout does not reopen or alter that projection work.

### What this closeout does not validate

- Investigation live validation
- Fieldwork live validation
- Independent ModelUpdate candidate-lane live validation
- Production trigger/backfill policy
- `POST /api/user-map/conclusions` manual-create governance documentation

These remain separate audit-wave / policy items.

### Mobile verification (recorded from implementation pass)

- `git diff --check`: pass
- Targeted alignment tests passed:
  - Today alignment
  - Timeline model layers alignment
  - What Changed alignment
  - Timeline model movement evidence projection
- `npm run verify` passed in mobile repo: 115 tests; production build

### What remains partial (unchanged)

- Phase 2 umbrella remains **partial**
- Investigation, Fieldwork, and ModelUpdate candidate-lane live validation remain open
- Production trigger/backfill policy and manual POST governance remain open
- Remaining Phase 6 deferred items (Investigations list/detail, dedicated What Changed/Timeline detail pages, etc.) remain deferred

### Next exact step

No backend code follow-up required for Today/Timeline parser parity. Remaining audit-wave items (Investigation live validation, Fieldwork live validation, ModelUpdate candidate-lane live validation, production trigger/backfill policy, POST manual-create governance docs) to be scheduled separately.

- **Files changed (this closeout):** `docs/engineering-ledger.md`, `docs/mindlab-roadmap-status-ledger.md`
- **Verification (this docs closeout):** `git diff --check`: pass; `npx tsc --noEmit`: pass; `npm run build`: pass; `bash scripts/check-trust-language.sh`: pass; `bash scripts/check-legacy-surfaces.sh`: pass. Docs-only — no test run required.
