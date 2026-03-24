-- AlterTable
ALTER TABLE "PatternClaim" ADD COLUMN     "needsReevaluation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PatternClaim_userId_needsReevaluation_idx" ON "PatternClaim"("userId", "needsReevaluation");
