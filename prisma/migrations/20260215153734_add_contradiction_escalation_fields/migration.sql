-- AlterTable
ALTER TABLE "ContradictionNode" ADD COLUMN     "avoidanceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAvoidedAt" TIMESTAMP(3),
ADD COLUMN     "lastEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "recommendedRung" "ProbeRung";

-- CreateIndex
CREATE INDEX "ContradictionNode_userId_escalationLevel_weight_idx" ON "ContradictionNode"("userId", "escalationLevel", "weight");
