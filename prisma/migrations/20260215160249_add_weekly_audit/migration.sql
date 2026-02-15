-- CreateTable
CREATE TABLE "WeeklyAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeReferenceCount" INTEGER NOT NULL,
    "openContradictionCount" INTEGER NOT NULL,
    "totalContradictionCount" INTEGER NOT NULL,
    "top3AvgComputedWeight" DOUBLE PRECISION NOT NULL,
    "top3Ids" TEXT[],
    "totalAvoidanceCount" INTEGER NOT NULL,
    "totalSnoozeCount" INTEGER NOT NULL,
    "contradictionDensity" DOUBLE PRECISION NOT NULL,
    "stabilityProxy" DOUBLE PRECISION NOT NULL,
    "top3Snapshot" JSONB,

    CONSTRAINT "WeeklyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyAudit_userId_generatedAt_idx" ON "WeeklyAudit"("userId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAudit_userId_weekStart_key" ON "WeeklyAudit"("userId", "weekStart");
