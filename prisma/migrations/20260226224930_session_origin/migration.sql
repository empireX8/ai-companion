-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'native';

-- CreateIndex
CREATE INDEX "ContradictionNode_userId_lastEscalatedAt_idx" ON "ContradictionNode"("userId", "lastEscalatedAt");

-- CreateIndex
CREATE INDEX "ContradictionNode_userId_createdAt_idx" ON "ContradictionNode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_origin_idx" ON "Session"("userId", "origin");
