# MindLab Understanding Engine — Step 4B Phase 1B Additive API Contract

**Date:** 2026-05-14  
**Type:** Doc-only API contract (no implementation)

## 1. Purpose of Phase 1B

Phase 1B defines the additive API foundation after Phase 1A schema lock and Phase 1A schema implementation.

- Phase 1A created storage foundations.
- Phase 1B exposes controlled, authenticated, user-scoped read/write access to those persisted objects.
- Phase 1B is not synthesis/derivation intelligence.
- Phase 1B is not UI/surface implementation.
- Phase 1B is not agent/objectivity-referee/domain-library implementation.

This remains additive. Existing APIs and surfaces stay intact.

## 2. Current Phase 1A Foundation Recap

Phase 1A schema foundation is available for:

- `UserMapConclusion`
- `Investigation`
- `ModelUpdate`
- `FieldworkAssignment`
- `UnderstandingEvidenceLink`

Supporting enums exist:

- `UserMapConclusionStatus`
- `UserMapConclusionArea`
- `UserMapConfidenceLevel`
- `InvestigationStatus`
- `InvestigationSeedType`
- `ModelUpdateType`
- `ModelUpdateVisibility`
- `FieldworkStatus`
- `UnderstandingLinkTargetType`
- `UnderstandingLinkSourceType`
- `UnderstandingLinkRole`

User-facing mapping remains:

- `UserMapConclusion` -> Your Map / Current Understanding item
- `Investigation` -> Active Question
- `ModelUpdate` -> What Changed
- `FieldworkAssignment` -> Watch For
- `UnderstandingEvidenceLink` -> evidence/provenance glue

## 3. API Design Principles

1. Additive only.
2. Authenticated and user-scoped.
3. No cross-user reads/writes.
4. No automatic intelligence generation.
5. No backend object names leaked into UI copy.
6. Pagination required on list endpoints.
7. Stable response envelopes for all new Phase 1B routes.
8. Strict enum validation.
9. Explicit lifecycle/status transition validation.
10. No hard delete for core objects in Phase 1B.
11. Typed/auditable evidence links only.
12. Empty states are valid.
13. No fabricated/synthetic data.

## 4. Route Naming Convention Review

### 4.1 Current repo convention findings (from `app/api`)

- Existing routes are noun-oriented and App Router based.
- Multiword route naming exists (`check-ins`, `model-like` patterns via hyphenated names).
- Both root collection routes and legacy `*/list` patterns exist.
- Response envelopes vary across existing routes (raw arrays, `{ items, nextCursor }`, page envelopes).

### 4.2 Phase 1B naming recommendation

Use clean collection + detail routes for all new Understanding Engine objects, with room for future `/summary`/`/stats` additions:

- `/api/user-map/conclusions`
- `/api/user-map/conclusions/[id]`
- `/api/investigations`
- `/api/investigations/[id]`
- `/api/model-updates`
- `/api/model-updates/[id]`
- `/api/fieldwork`
- `/api/fieldwork/[id]`
- `/api/understanding/evidence-links`

Why this scheme:

- Matches existing noun route style.
- Avoids overloading `/api/user-map` for both map summary and atomic conclusions.
- Keeps object-level API explicit for controlled create/update operations.
- Preserves a clean Phase 1C path for additive links onto existing endpoints.

## 5. Endpoint Contract Table

### 5.1 UserMapConclusion endpoints

| Method | Path | Purpose | Model | Capability | Auth | Required params | Response | Pagination | Validation | Forbidden behavior | Phase notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/user-map/conclusions` | List conclusions | `UserMapConclusion` | Read | Required | Query filters + pagination | `200 { items, pageInfo }` | Cursor | Enum + filter validation | no cross-user reads | Core Phase 1B read path |
| GET | `/api/user-map/conclusions/[id]` | Fetch one conclusion | `UserMapConclusion` | Read | Required | `id` path | `200 { item }` | N/A | ownership check | no cross-user reads | Detail path for later UI |
| POST | `/api/user-map/conclusions` | Explicit/manual creation path | `UserMapConclusion` | Create | Required | Body fields | `201 { item }` | N/A | field + enum validation | no auto synthesis | Controlled/manual/internal only |
| PATCH | `/api/user-map/conclusions/[id]` | Update status/corrections/supersession/notes | `UserMapConclusion` | Update | Required | `id` + body patch | `200 { item }` | N/A | lifecycle + ownership + supersession checks | no hard delete/history loss | Supports correction/supersession contract |

### 5.2 Investigation endpoints

| Method | Path | Purpose | Model | Capability | Auth | Required params | Response | Pagination | Validation | Forbidden behavior | Phase notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/investigations` | List investigations | `Investigation` | Read | Required | Query filters + pagination | `200 { items, pageInfo }` | Cursor | enum/filter checks | no cross-user reads | Core list path |
| GET | `/api/investigations/[id]` | Fetch investigation detail | `Investigation` | Read | Required | `id` | `200 { item }` | N/A | ownership check | no cross-user reads | Detail path |
| POST | `/api/investigations` | Explicit/manual investigation create | `Investigation` | Create | Required | Body | `201 { item }` | N/A | body + enum + json-shape checks | no auto generation from contradictions in Phase 1B | Controlled create only |
| PATCH | `/api/investigations/[id]` | Update status/evidenceNeeded/competingTheories/resolution/reopen | `Investigation` | Update | Required | `id` + body | `200 { item }` | N/A | lifecycle + ownership + resolved link checks | no auto resolution | Resolution only via explicit request |

### 5.3 ModelUpdate endpoints

| Method | Path | Purpose | Model | Capability | Auth | Required params | Response | Pagination | Validation | Forbidden behavior | Phase notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/model-updates` | List model updates | `ModelUpdate` | Read | Required | Query filters + pagination | `200 { items, pageInfo }` | Cursor | enum/filter validation | no cross-user reads; default excludes internal_only | No random feed behavior |
| GET | `/api/model-updates/[id]` | Fetch update detail | `ModelUpdate` | Read | Required | `id` | `200 { item }` | N/A | ownership + visibility checks | no cross-user reads | Detail for later Today/Timeline |
| POST | `/api/model-updates` | Explicit create path | `ModelUpdate` | Create | Required | Body | `201 { item }` | N/A | enum/field checks | no auto meaningfulness calc | Internal/manual path only |
| PATCH | `/api/model-updates/[id]` | Visibility and metadata update | `ModelUpdate` | Update | Required | `id` + body | `200 { item }` | N/A | lifecycle + ownership checks | no auto promotion to user-visible | Candidate -> user_visible must be explicit |

### 5.4 FieldworkAssignment endpoints

| Method | Path | Purpose | Model | Capability | Auth | Required params | Response | Pagination | Validation | Forbidden behavior | Phase notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/fieldwork` | List fieldwork assignments | `FieldworkAssignment` | Read | Required | Query filters + pagination | `200 { items, pageInfo }` | Cursor | enum/filter checks | no cross-user reads | Core list path |
| GET | `/api/fieldwork/[id]` | Fetch one assignment | `FieldworkAssignment` | Read | Required | `id` | `200 { item }` | N/A | ownership check | no cross-user reads | Detail path |
| POST | `/api/fieldwork` | Explicit/manual assignment create | `FieldworkAssignment` | Create | Required | Body | `201 { item }` | N/A | enum + required fields | no auto assignment | Manual/internal creation only |
| PATCH | `/api/fieldwork/[id]` | Status/update/complete/dismiss/expire | `FieldworkAssignment` | Update | Required | `id` + body | `200 { item }` | N/A | lifecycle + completion validation | no action-semantic merge | Fieldwork remains observation |

### 5.5 UnderstandingEvidenceLink endpoints

| Method | Path | Purpose | Model | Capability | Auth | Required params | Response | Pagination | Validation | Forbidden behavior | Phase notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/understanding/evidence-links` | List links by target or source | `UnderstandingEvidenceLink` | Read | Required | `targetType+targetId` or `sourceType+sourceId` | `200 { items, pageInfo }` | Cursor | typed enum + scoped lookup checks | no free-form types | Must support both target and source queries |
| POST | `/api/understanding/evidence-links` | Create explicit typed link | `UnderstandingEvidenceLink` | Create | Required | Body | `201 { item }` or `409` dedupe | N/A | enum + dedupe + ownership checks | no auto link generation | Contractual provenance path |
| PATCH | `/api/understanding/evidence-links/[id]` (optional) | Metadata-only corrections (`summary`/`snippet`/`quote`/`meta`) | `UnderstandingEvidenceLink` | Update | Required | `id` + body | `200 { item }` | N/A | ownership + field-allowlist checks | no target/source/role mutation | Optional in Phase 1B if needed |

Phase 1B default stance: no delete route for core objects or links. If delete for links becomes necessary, defer to explicit follow-up contract.

## 6. Read vs Write Policy

Evaluated options:

1. Read-only APIs only.
2. Full CRUD APIs.
3. Controlled create/update APIs with no hard delete.

### Recommendation: Option 3

- Keep read + controlled create/update paths for seeding, internal tooling, and early controlled workflows.
- Avoid hard deletes to preserve longitudinal trust and auditability.
- Avoid full CRUD destructiveness before lifecycle and correction semantics are mature.
- Phase 1B may expose create/update route handlers, but those handlers are controlled backend endpoints, not broad product-surface behavior.
- In Phase 1B, create/update paths are intended for controlled internal/admin/development/engine-preparation usage until later UI phases explicitly expose corresponding behavior.
- User-facing surfaces must not automatically create conclusions, investigations, model updates, fieldwork, or evidence links in Phase 1B.
- Authenticated user scoping remains mandatory even for controlled endpoints.
- Do not add new admin infrastructure unless current repo conventions already require it for similar routes.
- Do not add feature-flag infrastructure unless current repo conventions already use it for comparable endpoints.
- Phase 1B implementation should keep behavior controlled via route scope, strict validation, lifecycle constraints, and absence of UI callers.

Policy:

- Read: allowed for all five models.
- Create: allowed via explicit manual/internal calls.
- Update: allowed for lifecycle-safe fields.
- Hard delete: not part of Phase 1B.

## 7. Authentication and User Scoping

Use existing route convention:

- Resolve user via `const { userId } = await auth()`.
- If unauthenticated: return `401`.

Required scoping rules:

1. Never trust body `userId`.
2. All reads include `where: { userId }`.
3. All creates attach authenticated `userId` server-side.
4. All updates verify row ownership by authenticated `userId`.
5. Evidence link creation checks same-user ownership for resolvable source/target objects.
6. Cross-user access returns `404` (preferred privacy default) or repo-consistent unauthorized pattern where required.

## 8. Validation Contract

### 8.1 UserMapConclusion

- `title`: required, trimmed, non-empty.
- `summary`: required, trimmed, non-empty.
- `confidenceScore`: number in `[0,1]`.
- `status`: valid `UserMapConclusionStatus`.
- `area`: valid `UserMapConclusionArea`.
- `confidenceLevel`: valid `UserMapConfidenceLevel`.
- `evidenceCount`, `sourceDiversity`, `timeSpreadDays`: integer, `>=0`.
- `correctionCount`: integer, `>=0`.
- `supersededById`/`supersedesId` (if provided): must reference same-user conclusions.

### 8.2 Investigation

- `title`: required, non-empty.
- `organizingQuestion`: required, non-empty.
- `status`: valid `InvestigationStatus`.
- `seedType`: valid `InvestigationSeedType`.
- `competingTheories`: JSON array-like shape.
- `evidenceNeeded`: JSON array-like shape.
- `priority`: optional integer.
- `resolvedIntoUserMapConclusionId`: if provided, must belong to same user.
- `resolvedAt`: only valid when status is lifecycle-compatible (`resolving`/`resolved`/`reopened` rules).

### 8.3 ModelUpdate

- `updateType`: valid `ModelUpdateType`.
- `visibility`: valid `ModelUpdateVisibility`.
- `affectedObjectType`: valid `UnderstandingLinkTargetType`.
- `affectedObjectId`: required non-empty string.
- `userFacingSummary`: required non-empty string.
- `isMeaningful`: required boolean.
- `confidenceDelta`: optional number.
- `meaningfulDeltaScore`: optional number.
- No automatic meaningfulness calculation in Phase 1B.

### 8.4 FieldworkAssignment

- `prompt`: required, non-empty.
- `reason`: required, non-empty.
- `status`: valid `FieldworkStatus`.
- `linkedObjectType`: valid `UnderstandingLinkTargetType`.
- `linkedObjectId`: required non-empty string.
- `observationNote`/`observationOutcome`: optional.
- If status becomes `completed`, require `observationNote` and/or `observationOutcome`.
- `expiresAt`: optional; if provided, must be future timestamp at write time.

### 8.5 UnderstandingEvidenceLink

- `targetType`/`sourceType`/`role`: strict enums only.
- `targetId`/`sourceId`: required non-empty strings.
- `summary`/`snippet`/`quote`: optional.
- `weight`: nullable numeric.
- `confidenceContribution`: nullable numeric.
- `meta`: optional JSON.
- Dedupe unique conflict handled as `409` with structured error.
- Target/source ownership validation required where source/target is resolvable in Phase 1B.

## 9. Lifecycle Transition Policy

Phase 1B enforces basic valid transitions. Deeper intelligence rules remain Phase 2+.

### 9.1 UserMapConclusion status transitions

Allowed:

- `hypothesis -> tentative`
- `tentative -> emerging`
- `emerging -> supported`
- Any of `hypothesis|tentative|emerging|supported -> disputed`
- Any non-`superseded` -> `superseded`
- From `disputed`, explicit controlled updates may keep status `disputed`, move to `superseded`, or downgrade/rebuild to `tentative` or `emerging` only with new evidence and correction rationale.

Disallowed examples:

- `superseded -> supported` (requires new conclusion row, not in-place rollback)
- direct history deletion instead of supersession
- `disputed -> supported` direct transition in Phase 1B

Guidance:

- `disputed` does not silently recover to `supported`.
- In Phase 1B, prefer supersession or downgrade over silent recovery.
- Direct recovery to `supported` should wait for later gated engine-phase evidence review rules.

### 9.2 Investigation status transitions

Allowed baseline:

- `open -> gathering_evidence -> testing -> resolving -> resolved`
- `resolved -> reopened`
- `reopened -> gathering_evidence|testing|resolving|resolved`
- `open|gathering_evidence|testing|resolving|reopened -> abandoned`

Disallowed:

- `abandoned -> resolved` without reopening
- automatic resolution without explicit PATCH input

### 9.3 Fieldwork status transitions

Allowed baseline:

- `assigned -> active`
- `assigned|active -> completed`
- `assigned|active -> dismissed`
- `assigned|active -> expired`

Disallowed:

- `completed -> active`
- `dismissed -> completed`
- completion without observation payload

### 9.4 ModelUpdate visibility transitions

Allowed baseline:

- `internal_only -> candidate` through explicit controlled update
- `candidate -> user_visible`
- `candidate -> internal_only`
- `user_visible -> internal_only` (manual demotion path)

Disallowed:

- `internal_only -> user_visible` direct transition in Phase 1B
- implicit visibility promotion from unspecified behavior
- automatic `candidate -> user_visible` in Phase 1B

Additional constraints:

- `candidate -> user_visible` is allowed only through explicit controlled update.
- `user_visible -> internal_only` is allowed for rollback/safety correction.
- No automatic visibility promotion in Phase 1B.
- No meaningful-delta calculation in Phase 1B.

## 10. Evidence Link Integrity

`UnderstandingEvidenceLink` integrity rules:

1. Enums only for source/target/role.
2. Unique dedupe index enforced.
3. User scoping mandatory.
4. Validate ownership consistency for known source/target objects.
5. Validate referenced IDs exist where practical in-app layer.
6. If source ownership cannot be resolved in current phase (certain polymorphic cases), reject by default or require explicit internal override path with logged reason.
7. No automatic link generation.
8. `import_record` remains enum contract label, not a fake model relation.
9. No domain-knowledge source types in Phase 1B.

## 11. Response Shape Contract

Current repo responses are mixed. Phase 1B should standardize new routes while leaving old routes unchanged.

### 11.1 Success envelopes

List success:

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "limit": 20,
    "hasMore": false
  }
}
```

Detail success:

```json
{
  "item": {}
}
```

Create success:

```json
{
  "item": {}
}
```

Update success:

```json
{
  "item": {}
}
```

### 11.2 Error envelopes

Validation error (`400`):

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "status", "message": "Invalid status value" }
  ]
}
```

Auth error (`401`):

```json
{ "error": "Unauthorized", "code": "UNAUTHORIZED" }
```

Not found (`404`):

```json
{ "error": "Not found", "code": "NOT_FOUND" }
```

Dedupe conflict (`409`):

```json
{ "error": "Duplicate evidence link", "code": "DUPLICATE_LINK" }
```

Unsupported transition (`422`):

```json
{
  "error": "Unsupported lifecycle transition",
  "code": "UNSUPPORTED_TRANSITION"
}
```

## 12. Pagination, Filtering, and Sorting

Use cursor-based pagination on new Phase 1B list routes.

Shared query params:

- `limit` (default 20, max 100)
- `cursor` (opaque or timestamp/id cursor)
- `sortBy` (restricted allowlist per endpoint)
- `sortOrder` (`asc|desc`, default `desc`)

### 12.1 UserMapConclusion filters

- `area`
- `status`
- `confidenceLevel`
- `updatedBefore`
- `updatedAfter`

Default sort: `updatedAt desc`, tie-break `id desc`.

### 12.2 Investigation filters

- `status`
- `seedType`
- `priority`
- `updatedBefore`
- `updatedAfter`

Default sort: `updatedAt desc`, tie-break `id desc`.

### 12.3 ModelUpdate filters

- `visibility` (default exclude `internal_only`)
- `updateType`
- `affectedObjectType`
- `affectedObjectId`
- `createdBefore`
- `createdAfter`

Default sort: `createdAt desc`, tie-break `id desc`.

### 12.4 Fieldwork filters

- `status`
- `linkedObjectType`
- `linkedObjectId`
- `activeOnly`

Default sort: `updatedAt desc`, tie-break `id desc`.

### 12.5 UnderstandingEvidenceLink filters

- `targetType` + `targetId`
- `sourceType` + `sourceId`
- `role`

Default sort: `createdAt desc`, tie-break `id desc`.

## 13. Testing Contract for Phase 1B

Phase 1B implementation tests should cover:

1. Auth required on all new routes.
2. User-scoped list/detail behavior.
3. Create/update validation behavior.
4. Enum validation and rejection paths.
5. Lifecycle transition validation.
6. Evidence-link dedupe conflict behavior.
7. Same-user ownership checks for writes and polymorphic links.
8. Pagination/filter/sort behavior.
9. No cross-user data leakage.
10. Explicit non-generation behavior: routes never run synthesis/agents/AI outputs.
11. No forbidden routes/objects introduced.

Phase 1B tests must not cover:

- UI
- mobile
- agents
- Intelligence Library
- Objectivity Referee
- Phase 2 synthesis
- Explore runtime mode behavior
- Today cards

## 14. Existing Endpoint Preservation

Phase 1B must not break existing routes. In particular:

- journal
- sessions/messages
- patterns
- contradiction
- actions
- timeline
- library/evidence
- check-ins
- imports/uploads
- references

No response-shape rewrites for existing routes in this phase.

If additive links to existing endpoint payloads are needed, that belongs to Phase 1C.

## 15. Security and Privacy Guardrails

1. No cross-user reads/writes.
2. No unauthenticated access.
3. Internal-only `ModelUpdate` rows excluded by default user list path.
4. Sensitive fields (`internalNotes`) not returned by default user-facing list response.
5. Evidence snippets/quotes are user-owned and scoped.
6. Ownership checks on polymorphic link operations.
7. No public endpoint for Intelligence Library/domain knowledge.

## 16. What Phase 1B Must Not Do

Phase 1B explicitly excludes:

- AI generation
- model synthesis
- automatic conclusion creation
- automatic investigation creation
- automatic ModelUpdate creation
- automatic FieldworkAssignment creation
- automatic UnderstandingEvidenceLink generation
- agent implementations
- Intelligence Library implementation
- domain knowledge ingestion
- Objectivity Referee implementation
- Explore runtime modes
- Today cards/UI surface work
- Timeline model-event UI layers
- mobile work
- UI copy work
- any Prisma schema changes or migrations, including route-support schema changes
- destructive deletes unless later explicitly approved

## 17. Phase 1C Boundary

Phase 1C is where existing API responses may receive additive link fields. Examples:

- `/api/patterns` includes related `UserMapConclusion` / `Investigation` ids.
- `/api/contradiction` includes related `Investigation` ids.
- `/api/actions` includes related `FieldworkAssignment` / `ModelUpdate` ids.
- `/api/timeline` includes model-event layers.

Phase 1B must not modify existing endpoint response structures. If implementation finds this unavoidable, stop and report instead of changing existing endpoint contracts.

## 18. Phase 2 Boundary

Phase 2 is the dark engine + gates phase.

- Phase 1B routes are manual/controlled read/write access only.
- Phase 1B must not imply user understanding is being auto-generated.
- Phase 2 may later use these routes/models through internal services, but that behavior is out of Phase 1B scope.

## 19. Implementation Prompt Readiness

- **Phase 1B readiness:** Ready.
- **Blockers:** None blocking implementation. One alignment task at start of implementation: lock whether new routes use one shared zod module pattern or per-route schema files to match repo style.

Recommended implementation prompt title:

`Step 4 Prompt 2 — Understanding Engine Additive API Foundation (Phase 1B)`

That prompt must explicitly forbid:

1. Prisma schema changes and migrations in Phase 1B. If a schema issue is discovered, stop and report instead of changing schema. Any schema change requires a separate approved prompt.
2. synthesis/AI/agent/objectivity/domain knowledge behavior
3. UI/mobile work
4. modifications to existing endpoint response contracts (except explicitly approved additive Phase 1C work)
5. automatic generation flows for conclusions/investigations/model updates/fieldwork/evidence links
6. destructive deletes
7. commits
