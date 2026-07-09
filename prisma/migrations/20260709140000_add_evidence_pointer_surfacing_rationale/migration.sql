-- CreateTable
CREATE TABLE "EvidencePointerSurfacingRationale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceObjectType" "UnderstandingLinkSourceType" NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "whyResurfaced" TEXT,
    "sourceEvidenceId" TEXT,
    "authoredFrom" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidencePointerSurfacingRationale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidencePointerSurfacingRationale_userId_sourceObjectType_sourceObjectId_key" ON "EvidencePointerSurfacingRationale"("userId", "sourceObjectType", "sourceObjectId");

-- CreateIndex
CREATE INDEX "EvidencePointerSurfacingRationale_userId_sourceObjectType_sourceObjectId_idx" ON "EvidencePointerSurfacingRationale"("userId", "sourceObjectType", "sourceObjectId");
