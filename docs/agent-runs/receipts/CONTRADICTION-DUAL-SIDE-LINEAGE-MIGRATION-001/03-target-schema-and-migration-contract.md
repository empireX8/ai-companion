# 03 — Target schema and migration contract

## Prisma shape (Design A)

### ContradictionNode additions

- `sideASourceSpanId String?`
- `sideBSourceSpanId String?`
- `sideASourceSpan EvidenceSpan? @relation("ContradictionNodeSideASourceSpan", …, onDelete: Restrict)`
- `sideBSourceSpan EvidenceSpan? @relation("ContradictionNodeSideBSourceSpan", …, onDelete: Restrict)`
- `@@index([sideASourceSpanId])`
- `@@index([sideBSourceSpanId])`

### EvidenceSpan additions

- `contradictionNodesAsSideA ContradictionNode[] @relation("ContradictionNodeSideASourceSpan")`
- `contradictionNodesAsSideB ContradictionNode[] @relation("ContradictionNodeSideBSourceSpan")`

### Retained legacy fields

- `sourceSessionId` / `sourceMessageId` / `ContradictionEvidence` unchanged.

## Migration directory

`prisma/migrations/20260721003000_add_contradiction_dual_side_span_lineage/`

## Migration invariants (satisfied)

- Nullable columns → existing rows remain valid
- Foreign keys to `EvidenceSpan.id`
- Indexes on both FK columns
- Preserve all existing rows
- No INSERT / UPDATE / DELETE FROM / DROP TABLE|INDEX|TYPE|CONSTRAINT
- No fabricated backfill / data rewrite
- No drop of existing contradiction provenance fields
- No status mutation

## Database constraints (SQL; not encoded by Prisma alone)

1. `ContradictionNode_dual_side_span_lineage_both_or_neither_check`
   - both null **or** both non-null
2. `ContradictionNode_dual_side_span_distinct_check`
   - Side A span id ≠ Side B span id when both present

Prisma schema alone does not encode CHECK constraints; the SQL migration is authoritative for these invariants.

## Versioning

- Added `CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION = "contradiction-dual-side-lineage-v1"`
- Did **not** bump adjudication prompt/schema versions, Objectivity Referee interface version, or shared kernel version

## Application status

**Migration was not applied.** No `prisma migrate deploy|dev|reset`, no `db push`, no live SQL against Kay’s database.
