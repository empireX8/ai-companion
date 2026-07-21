# 03 — Schema and migration contract

## Prisma

```prisma
/// CEQR-007: exact ordered repaired dual-side identity.
/// PostgreSQL UNIQUE treats NULLs as distinct, so legacy both-null rows remain permitted.
@@unique([userId, sideASourceSpanId, sideBSourceSpanId], map: "ContradictionNode_user_sideA_sideB_span_uniq")
```

## Migration

Path: `prisma/migrations/20260721140000_add_contradiction_exact_dual_side_unique/migration.sql`

- Additive `CREATE UNIQUE INDEX` only
- No DML, no backfill, no destructive DDL
- Applied only after read-only duplicate preflight returned **0** complete-pair duplicate groups

## PostgreSQL NULL semantics

A normal UNIQUE index treats NULL values as distinct. Legacy rows with null `sideASourceSpanId` / `sideBSourceSpanId` remain permitted in any number. Complete repaired rows (both span FKs non-null) become unique per `(userId, sideASourceSpanId, sideBSourceSpanId)`.

## Apply order

1. Read-only preflight (passed: 0 duplicate groups)
2. `npx prisma migrate deploy`
3. Confirm index present in `pg_indexes`
