-- CreateEnum
CREATE TYPE "ContradictionType" AS ENUM ('goal_behavior_gap', 'value_conflict', 'constraint_conflict', 'belief_conflict', 'pattern_loop', 'narrative_conflict');

-- CreateEnum
CREATE TYPE "ContradictionStatus" AS ENUM ('open', 'snoozed', 'explored', 'resolved', 'accepted_tradeoff', 'archived_tension');

-- CreateEnum
CREATE TYPE "ProbeRung" AS ENUM ('rung1_gentle_mirror', 'rung2_explicit_contradiction', 'rung3_evidence_pressure', 'rung4_forced_choice_framing', 'rung5_structured_probe_offer');

-- CreateTable
CREATE TABLE "ContradictionNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sideA" TEXT NOT NULL,
    "sideB" TEXT NOT NULL,
    "type" "ContradictionType" NOT NULL,
    "confidence" "ReferenceConfidence" NOT NULL DEFAULT 'low',
    "status" "ContradictionStatus" NOT NULL DEFAULT 'open',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rung" "ProbeRung",
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTouchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSessionId" TEXT,
    "sourceMessageId" TEXT,

    CONSTRAINT "ContradictionNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContradictionEvidence" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "messageId" TEXT,
    "quote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContradictionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContradictionNode_userId_status_weight_idx" ON "ContradictionNode"("userId", "status", "weight");

-- CreateIndex
CREATE INDEX "ContradictionNode_userId_lastTouchedAt_idx" ON "ContradictionNode"("userId", "lastTouchedAt");

-- CreateIndex
CREATE INDEX "ContradictionEvidence_nodeId_idx" ON "ContradictionEvidence"("nodeId");

-- AddForeignKey
ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContradictionEvidence" ADD CONSTRAINT "ContradictionEvidence_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ContradictionNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
