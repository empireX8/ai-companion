-- CreateEnum
CREATE TYPE "ExploreMovementProposalStatus" AS ENUM ('proposed', 'published', 'rejected');

-- CreateTable
CREATE TABLE "ExploreMovementProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "assistantMessageId" TEXT NOT NULL,
    "userMessageId" TEXT NOT NULL,
    "status" "ExploreMovementProposalStatus" NOT NULL DEFAULT 'proposed',
    "affectedObjectType" "UnderstandingLinkTargetType" NOT NULL,
    "affectedObjectId" TEXT NOT NULL,
    "beforeSummary" TEXT NOT NULL,
    "afterSummary" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "userFacingSummary" TEXT NOT NULL,
    "sourcesJson" JSONB NOT NULL,
    "modelUpdateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreMovementProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExploreMovementProposal_modelUpdateId_key" ON "ExploreMovementProposal"("modelUpdateId");

-- CreateIndex
CREATE INDEX "ExploreMovementProposal_userId_conversationId_status_createdAt_idx" ON "ExploreMovementProposal"("userId", "conversationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExploreMovementProposal_userId_status_createdAt_idx" ON "ExploreMovementProposal"("userId", "status", "createdAt");
