-- CreateTable
CREATE TABLE "PatternClaimAction" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outcomeSignal" TEXT,
    "reflectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PatternClaimAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatternClaimAction_claimId_idx" ON "PatternClaimAction"("claimId");

-- CreateIndex
CREATE INDEX "PatternClaimAction_userId_status_idx" ON "PatternClaimAction"("userId", "status");

-- CreateIndex
CREATE INDEX "PatternClaimAction_userId_createdAt_idx" ON "PatternClaimAction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PatternClaimAction" ADD CONSTRAINT "PatternClaimAction_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PatternClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
