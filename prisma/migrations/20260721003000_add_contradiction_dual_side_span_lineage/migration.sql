-- CEQR-005 / CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001
-- Additive dual-side exact EvidenceSpan lineage on ContradictionNode.
-- Nullable columns preserve legacy pre-repair cohort (both null).
-- Schema-only: no DML, no backfill, no data rewrite, no destructive DDL.

-- AlterTable
ALTER TABLE "ContradictionNode" ADD COLUMN "sideASourceSpanId" TEXT,
ADD COLUMN "sideBSourceSpanId" TEXT;

-- CreateIndex
CREATE INDEX "ContradictionNode_sideASourceSpanId_idx" ON "ContradictionNode"("sideASourceSpanId");

-- CreateIndex
CREATE INDEX "ContradictionNode_sideBSourceSpanId_idx" ON "ContradictionNode"("sideBSourceSpanId");

-- AddForeignKey (Restrict: do not silently null or cascade away repaired lineage)
ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_sideASourceSpanId_fkey" FOREIGN KEY ("sideASourceSpanId") REFERENCES "EvidenceSpan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_sideBSourceSpanId_fkey" FOREIGN KEY ("sideBSourceSpanId") REFERENCES "EvidenceSpan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level dual-null XOR dual-present invariant.
-- Prisma schema alone cannot encode CHECK constraints; this SQL is authoritative.
ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_dual_side_span_lineage_both_or_neither_check" CHECK (
  ("sideASourceSpanId" IS NULL AND "sideBSourceSpanId" IS NULL)
  OR ("sideASourceSpanId" IS NOT NULL AND "sideBSourceSpanId" IS NOT NULL)
);

-- Same EvidenceSpan may not serve as both opposing sides.
ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_dual_side_span_distinct_check" CHECK (
  "sideASourceSpanId" IS NULL
  OR "sideBSourceSpanId" IS NULL
  OR "sideASourceSpanId" <> "sideBSourceSpanId"
);
