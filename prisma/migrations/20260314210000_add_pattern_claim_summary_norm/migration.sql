-- AlterTable: add summaryNorm to PatternClaim
ALTER TABLE "PatternClaim" ADD COLUMN "summaryNorm" TEXT NOT NULL DEFAULT '';

-- Update existing rows (none in dev, but safe)
UPDATE "PatternClaim" SET "summaryNorm" = lower(regexp_replace(regexp_replace("summary", '[^\w\s]', '', 'g'), '\s+', ' ', 'g')) WHERE "summaryNorm" = '';

-- Remove the default now that we've back-filled
ALTER TABLE "PatternClaim" ALTER COLUMN "summaryNorm" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "PatternClaim_userId_patternType_summaryNorm_key" ON "PatternClaim"("userId", "patternType", "summaryNorm");
