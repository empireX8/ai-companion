-- CreateEnum
CREATE TYPE "SurfacedActionBucket" AS ENUM ('stabilize', 'build');

-- CreateEnum
CREATE TYPE "SurfacedActionStatus" AS ENUM ('not_started', 'done', 'helped', 'didnt_help');

-- CreateTable
CREATE TABLE "SurfacedAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surfaceKey" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "bucket" "SurfacedActionBucket" NOT NULL,
    "linkedFamily" "PatternType",
    "linkedClaimId" TEXT,
    "linkedGoalRefId" TEXT,
    "status" "SurfacedActionStatus" NOT NULL DEFAULT 'not_started',
    "note" TEXT,
    "surfacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurfacedAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurfacedAction_userId_surfaceKey_key" ON "SurfacedAction"("userId", "surfaceKey");

-- CreateIndex
CREATE INDEX "SurfacedAction_userId_bucket_updatedAt_idx" ON "SurfacedAction"("userId", "bucket", "updatedAt");

-- CreateIndex
CREATE INDEX "SurfacedAction_userId_linkedClaimId_idx" ON "SurfacedAction"("userId", "linkedClaimId");

-- CreateIndex
CREATE INDEX "SurfacedAction_userId_linkedGoalRefId_idx" ON "SurfacedAction"("userId", "linkedGoalRefId");
