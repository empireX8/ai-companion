-- CreateEnum
CREATE TYPE "InvestigationVisibility" AS ENUM ('user_visible', 'internal_only');

-- AlterTable
ALTER TABLE "Investigation" ADD COLUMN     "candidateLifecycleStatus" "CandidateLifecycleStatus",
ADD COLUMN     "visibility" "InvestigationVisibility" NOT NULL DEFAULT 'user_visible';

-- CreateIndex
CREATE INDEX "Investigation_userId_visibility_status_updatedAt_idx" ON "Investigation"("userId", "visibility", "status", "updatedAt");
