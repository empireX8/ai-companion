# MindLab Step 7 — Hidden Internal User Map Review Page Contract

## 1. Purpose

This contract defines the first hidden internal web page for reviewing `internal_only` `UserMapConclusion` candidates.

Purpose:
- internal review/debug/quality-control only
- read-only inspection of persisted internal candidates and evidence summaries
- no public User Map exposure

Not in scope:
- public user-facing User Map
- mobile surface
- promotion/edit/delete/reject actions
- runtime trigger wiring

## 2. Hidden Route Path

Locked path for the first page:
- `/internal/user-map/review`

Route visibility rules:
- must not be linked from normal navigation
- must not be added to public product entry points
- direct URL access only for authorized internal reviewers

## 3. Access Model

The page must use the same reviewer gate as the internal review API:
- authenticated user required
- reviewer allowlist via `INTERNAL_USER_MAP_REVIEWER_IDS`
- missing/empty allowlist denies everyone
- no cross-user override

Failure behavior should follow app conventions:
- unauthenticated: route-level unauthorized handling
- authenticated non-reviewer: route-level forbidden/not-found handling

## 4. Data Source

The page must read from:
- `GET /api/internal/user-map/review-candidates`

Safety constraints:
- do not query `internal_only` candidates via public `/api/user-map/conclusions` routes
- do not rely on client-only filtering for safety
- server API filtering/access gate remains the source of truth

## 5. Data Contract for the Page

### Allowed to render

From each candidate:
- `id`
- `title`
- `summary`
- `area`
- `status`
- `confidenceLevel`
- `visibility`
- `createdAt`
- `updatedAt`

Evidence / provenance summary only (no raw text):
- `evidence.linkCount`
- `evidence.sourceTypes` (counts by source type)
- `evidence.safetyLevels` (counts by `meta.publicSafetyLevel` when recorded on links)
- `evidence.linkedSources` (`sourceType`, `sourceId`, optional `safetyLevel` per link — IDs only)

Diagnostics references only (safe persisted fields):
- `diagnostics.latestRunId`
- `diagnostics.latestArtifactId`
- `diagnostics.latestArtifactType`
- `diagnostics.processorVersion` (when present on diagnostics artifact payload)
- `diagnostics.blockedWriteReasons` (when present)
- `diagnostics.warnings` (when present)

### Blocked from rendering

- raw evidence quotes/snippets/message body content
- promotion controls
- edit/delete/reject controls
- review-state mutation controls
- runtime generation controls
- cross-user data
- `user_visible` rows

## 6. UI Scope (First Iteration)

Minimum implementation scope:
- read-only list/table
- loading state
- forbidden/unauthorized state handling
- error state
- empty state

Deferred in this step:
- detail drawer/page
- charts/advanced visualizations
- any write-capable controls

## 7. Required Tests for Implementation

Implementation must include tests for:
- hidden route is not exposed in normal navigation
- reviewer gate enforced on page access
- reviewer can view internal candidates
- `user_visible` rows are not shown on this page
- raw evidence content fields are not rendered
- no write actions/forms/buttons exist
- backing internal API remains `GET`-only/read-only
- public `/api/user-map/conclusions` routes still hide `internal_only`
- no mobile files/surfaces changed

## 8. Non-Goals Lock

Locked non-goals for this step:
- no promotion flow
- no candidate editing
- no delete/reject workflow
- no runtime triggers
- no public User Map surface
- no mobile parity
- no agents/lenses
- no Intelligence Library/domain retrieval

## 9. Required Scope for Next Implementation Prompt

When implementation is requested, scope should be limited to:
- add hidden page at `/internal/user-map/review`
- fetch/read internal candidates from `GET /api/internal/user-map/review-candidates`
- render read-only candidate + evidence summary list
- keep public routes unchanged
- keep all candidate generation/promotion/write logic out of the page

