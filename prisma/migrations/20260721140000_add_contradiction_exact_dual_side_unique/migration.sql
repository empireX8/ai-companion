-- CEQR-007 / CONTRADICTION-DUPLICATE-PREVENTION-001
-- Exact ordered repaired dual-side ContradictionNode uniqueness.
-- Additive UNIQUE only. No DML, no backfill, no destructive DDL.
--
-- PostgreSQL UNIQUE semantics: NULL values are distinct, so legacy rows with
-- null sideASourceSpanId / sideBSourceSpanId remain permitted in any number.
-- Complete repaired rows (both span FKs non-null) become unique per
-- (userId, sideASourceSpanId, sideBSourceSpanId).

-- CreateIndex
CREATE UNIQUE INDEX "ContradictionNode_user_sideA_sideB_span_uniq"
ON "ContradictionNode"("userId", "sideASourceSpanId", "sideBSourceSpanId");
