-- CreateEnum
CREATE TYPE "SurfacedEvidencePointerKind" AS ENUM ('pattern', 'tension', 'journal');

-- CreateEnum
CREATE TYPE "SurfacedEvidencePointerSurface" AS ENUM ('today_evidence_pointer');

-- CreateEnum
CREATE TYPE "SurfacedEvidencePointerStatus" AS ENUM ('active', 'expired', 'dismissed', 'hidden');

-- CreateTable
CREATE TABLE "SurfacedEvidencePointer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointerKind" "SurfacedEvidencePointerKind" NOT NULL,
    "surface" "SurfacedEvidencePointerSurface" NOT NULL DEFAULT 'today_evidence_pointer',
    "sourceObjectType" "UnderstandingLinkSourceType" NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "sourceEvidenceId" TEXT,
    "sourceText" TEXT NOT NULL,
    "sourceOrigin" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "whyResurfaced" TEXT,
    "libraryReceiptId" TEXT,
    "detailHref" TEXT,
    "publicEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" "SurfacedEvidencePointerStatus" NOT NULL DEFAULT 'active',
    "materializedFrom" TEXT,
    "meta" JSONB,
    "surfacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurfacedEvidencePointer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_key" ON "SurfacedEvidencePointer"("userId", "sourceObjectType", "sourceObjectId");

-- CreateIndex
CREATE INDEX "SurfacedEvidencePointer_userId_status_surfacedAt_idx" ON "SurfacedEvidencePointer"("userId", "status", "surfacedAt");

-- CreateIndex
CREATE INDEX "SurfacedEvidencePointer_userId_publicEligible_status_idx" ON "SurfacedEvidencePointer"("userId", "publicEligible", "status");

-- CreateIndex
CREATE INDEX "SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_idx" ON "SurfacedEvidencePointer"("userId", "sourceObjectType", "sourceObjectId");
