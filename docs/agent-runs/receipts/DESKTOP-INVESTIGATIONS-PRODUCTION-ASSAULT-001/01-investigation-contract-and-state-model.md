# Investigation Contract And State Model

## Canonical durable contract enforced in code

Primary durable row:

- Prisma model: `Investigation`
- Fields used for production identity and lifecycle:
  - `id`
  - `userId`
  - `title`
  - `organizingQuestion`
  - `status`
  - `visibility`
  - `seedType`
  - `competingTheories`
  - `evidenceNeeded`
  - `resolutionSummary`
  - `resolvedAt`
  - `resolvedIntoUserMapConclusionId`
  - `reopenedAt`
  - `reopenReason`
  - `priority`
  - `createdAt`
  - `updatedAt`

Linked durable rows:

- `FieldworkAssignment`
  - `id`
  - `userId`
  - `prompt`
  - `reason`
  - `status`
  - `linkedObjectType`
  - `linkedObjectId`
  - `observationNote`
  - `observationOutcome`
  - `completedAt`
  - `expiresAt`
  - `createdAt`
  - `updatedAt`
- `UnderstandingEvidenceLink`
  - `id`
  - `userId`
  - `targetType`
  - `targetId`
  - `sourceType`
  - `sourceId`
  - `role`
  - `summary`
  - `snippet`
  - `quote`
  - `weight`
  - `confidenceContribution`
  - `meta`
  - `createdAt`
- `EvidenceSpan`
  - durable source evidence identity for investigation links

## Canonical read model added

New file:

- `lib/investigation-production-detail.ts`

Functions:

- `loadProductionInvestigationDetail({ userId, id })`
- `listAvailableEvidenceSpansForUser({ userId, investigationId })`

This file is the single production detail read contract for:

- investigation identity
- evidence linkage
- fieldwork linkage
- outcome
- closure
- public continuity hrefs
- Inspector depth

## Lifecycle contract used

Existing route validation preserved from `lib/understanding-engine-api.ts`:

- `open -> gathering_evidence | abandoned`
- `gathering_evidence -> testing | abandoned`
- `testing -> resolving | abandoned`
- `resolving -> resolved | abandoned`
- `resolved -> reopened`
- `reopened -> gathering_evidence | testing | resolving | resolved | abandoned`

Current production closure implementation:

- outcome saved via `PATCH /api/investigations/[id]` with `resolutionSummary`
- explicit closure via `PATCH /api/investigations/[id]` with `status: "resolved"` and `resolvedAt`

Current production reopen implementation status:

- durable model supports `reopenedAt` and `reopenReason`
- production UI does not expose reopen controls
- production UI now states this honestly: `Reopening is not exposed on this production surface.`

## Schema / migration result

- Prisma schema change required: `NO`
- New Prisma migration required: `NO`
- Exact SQL checked in: `NONE`
- `prisma db push` used as solution: `NO`

## Final closeout confirmation on 2026-07-16

- authenticated browser proof completed without changing the durable contract above
- no schema changes were introduced during closeout
- final schema / migration result remains: `NONE`
