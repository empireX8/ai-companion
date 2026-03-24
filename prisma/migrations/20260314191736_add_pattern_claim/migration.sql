-- CreateEnum
CREATE TYPE "PatternType" AS ENUM ('trigger_condition', 'inner_critic', 'repetitive_loop', 'contradiction_drift', 'recovery_stabilizer');

-- CreateEnum
CREATE TYPE "PatternClaimStatus" AS ENUM ('candidate', 'active', 'paused', 'dismissed');

-- CreateEnum
CREATE TYPE "StrengthLevel" AS ENUM ('tentative', 'developing', 'established');

-- CreateTable
CREATE TABLE "PatternClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patternType" "PatternType" NOT NULL,
    "strengthLevel" "StrengthLevel" NOT NULL DEFAULT 'tentative',
    "status" "PatternClaimStatus" NOT NULL DEFAULT 'candidate',
    "summary" TEXT NOT NULL,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'derivation',
    "sessionId" TEXT,
    "messageId" TEXT,
    "quote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatternClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatternClaim_userId_status_idx" ON "PatternClaim"("userId", "status");

-- CreateIndex
CREATE INDEX "PatternClaim_userId_patternType_idx" ON "PatternClaim"("userId", "patternType");

-- CreateIndex
CREATE INDEX "PatternClaim_userId_createdAt_idx" ON "PatternClaim"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PatternClaimEvidence_claimId_idx" ON "PatternClaimEvidence"("claimId");

-- AddForeignKey
ALTER TABLE "PatternClaimEvidence" ADD CONSTRAINT "PatternClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PatternClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
