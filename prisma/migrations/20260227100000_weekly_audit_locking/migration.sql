-- AlterTable: WeeklyAudit — add locking fields
ALTER TABLE "WeeklyAudit" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "WeeklyAudit" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "WeeklyAudit" ADD COLUMN "inputHash" TEXT;

-- CreateIndex: WeeklyAudit status
CREATE INDEX "WeeklyAudit_userId_status_idx" ON "WeeklyAudit"("userId", "status");
