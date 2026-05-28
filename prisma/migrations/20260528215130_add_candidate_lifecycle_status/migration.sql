-- CreateEnum
CREATE TYPE "CandidateLifecycleStatus" AS ENUM ('proposed', 'held_for_more_evidence', 'rejected', 'promoted', 'superseded', 'expired');

-- AlterTable
ALTER TABLE "UserMapConclusion" ADD COLUMN     "candidateLifecycleStatus" "CandidateLifecycleStatus";
