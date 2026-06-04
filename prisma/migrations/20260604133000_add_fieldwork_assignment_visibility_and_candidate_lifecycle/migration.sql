-- CreateEnum
CREATE TYPE "FieldworkAssignmentVisibility" AS ENUM ('user_visible', 'internal_only');

-- AlterTable
ALTER TABLE "FieldworkAssignment" ADD COLUMN     "candidateLifecycleStatus" "CandidateLifecycleStatus",
ADD COLUMN     "visibility" "FieldworkAssignmentVisibility" NOT NULL DEFAULT 'user_visible';

-- CreateIndex
CREATE INDEX "FieldworkAssignment_userId_visibility_status_updatedAt_idx" ON "FieldworkAssignment"("userId", "visibility", "status", "updatedAt");
