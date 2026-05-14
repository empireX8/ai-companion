-- CreateEnum
CREATE TYPE "UserMapConclusionStatus" AS ENUM ('hypothesis', 'tentative', 'emerging', 'supported', 'disputed', 'superseded');

-- CreateEnum
CREATE TYPE "UserMapConclusionArea" AS ENUM ('operating_logic', 'state_ecology', 'tension_architecture', 'recovery_architecture', 'meaning_system', 'relational_field', 'developmental_vector', 'current_frontier');

-- CreateEnum
CREATE TYPE "UserMapConfidenceLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('open', 'gathering_evidence', 'testing', 'resolving', 'resolved', 'reopened', 'abandoned');

-- CreateEnum
CREATE TYPE "InvestigationSeedType" AS ENUM ('contradiction', 'pattern', 'state_switch', 'user_curiosity', 'action_failure', 'fieldwork_result', 'model_uncertainty', 'user_correction');

-- CreateEnum
CREATE TYPE "ModelUpdateType" AS ENUM ('conclusion_added', 'conclusion_strengthened', 'conclusion_weakened', 'conclusion_disputed', 'conclusion_superseded', 'investigation_opened', 'investigation_progressed', 'investigation_resolved', 'investigation_reopened', 'fieldwork_assigned', 'fieldwork_completed', 'action_outcome_recorded', 'strategy_adjusted', 'correction_applied', 'link_detected');

-- CreateEnum
CREATE TYPE "ModelUpdateVisibility" AS ENUM ('internal_only', 'candidate', 'user_visible');

-- CreateEnum
CREATE TYPE "FieldworkStatus" AS ENUM ('assigned', 'active', 'completed', 'dismissed', 'expired');

-- CreateEnum
CREATE TYPE "UnderstandingLinkTargetType" AS ENUM ('usermap_conclusion', 'investigation', 'model_update', 'fieldwork_assignment', 'surfaced_action', 'pattern_claim', 'contradiction_node');

-- CreateEnum
CREATE TYPE "UnderstandingLinkSourceType" AS ENUM ('pattern_claim', 'pattern_claim_evidence', 'contradiction_node', 'contradiction_evidence', 'profile_artifact', 'evidence_span', 'reference_item', 'surfaced_action', 'quick_check_in', 'journal_entry', 'session', 'message', 'timeline_aggregation', 'import_record', 'user_correction');

-- CreateEnum
CREATE TYPE "UnderstandingLinkRole" AS ENUM ('supports', 'contradicts', 'context', 'seed', 'outcome', 'correction', 'temporal_anchor', 'derived_from');

-- CreateTable
CREATE TABLE "UserMapConclusion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "UserMapConclusionArea" NOT NULL,
    "status" "UserMapConclusionStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" "UserMapConfidenceLevel" NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "sourceDiversity" INTEGER NOT NULL DEFAULT 0,
    "timeSpreadDays" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersededById" TEXT,
    "supersedesId" TEXT,
    "firstEvidenceAt" TIMESTAMP(3),
    "lastEvidenceAt" TIMESTAMP(3),
    "lastUserCorrectionAt" TIMESTAMP(3),
    "lastUserCorrectionLabel" TEXT,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMapConclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizingQuestion" TEXT NOT NULL,
    "status" "InvestigationStatus" NOT NULL,
    "seedType" "InvestigationSeedType" NOT NULL,
    "competingTheories" JSONB NOT NULL,
    "evidenceNeeded" JSONB NOT NULL,
    "resolutionSummary" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedIntoUserMapConclusionId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelUpdate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updateType" "ModelUpdateType" NOT NULL,
    "visibility" "ModelUpdateVisibility" NOT NULL,
    "affectedObjectType" "UnderstandingLinkTargetType" NOT NULL,
    "affectedObjectId" TEXT NOT NULL,
    "userFacingSummary" TEXT NOT NULL,
    "isMeaningful" BOOLEAN NOT NULL,
    "beforeSummary" TEXT,
    "afterSummary" TEXT,
    "confidenceDelta" DOUBLE PRECISION,
    "meaningfulDeltaScore" DOUBLE PRECISION,
    "sourceRunId" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldworkAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FieldworkStatus" NOT NULL,
    "linkedObjectType" "UnderstandingLinkTargetType" NOT NULL,
    "linkedObjectId" TEXT NOT NULL,
    "observationNote" TEXT,
    "observationOutcome" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnderstandingEvidenceLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "UnderstandingLinkTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "sourceType" "UnderstandingLinkSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "role" "UnderstandingLinkRole" NOT NULL,
    "summary" TEXT,
    "snippet" TEXT,
    "quote" TEXT,
    "weight" DOUBLE PRECISION,
    "confidenceContribution" DOUBLE PRECISION,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnderstandingEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMapConclusion_userId_area_status_idx" ON "UserMapConclusion"("userId", "area", "status");

-- CreateIndex
CREATE INDEX "UserMapConclusion_userId_confidenceScore_idx" ON "UserMapConclusion"("userId", "confidenceScore");

-- CreateIndex
CREATE INDEX "UserMapConclusion_userId_updatedAt_idx" ON "UserMapConclusion"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "UserMapConclusion_userId_supersededById_idx" ON "UserMapConclusion"("userId", "supersededById");

-- CreateIndex
CREATE INDEX "Investigation_userId_status_updatedAt_idx" ON "Investigation"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Investigation_userId_seedType_createdAt_idx" ON "Investigation"("userId", "seedType", "createdAt");

-- CreateIndex
CREATE INDEX "Investigation_userId_resolvedAt_idx" ON "Investigation"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ModelUpdate_userId_visibility_createdAt_idx" ON "ModelUpdate"("userId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "ModelUpdate_userId_updateType_createdAt_idx" ON "ModelUpdate"("userId", "updateType", "createdAt");

-- CreateIndex
CREATE INDEX "ModelUpdate_userId_affectedObjectType_affectedObjectId_idx" ON "ModelUpdate"("userId", "affectedObjectType", "affectedObjectId");

-- CreateIndex
CREATE INDEX "FieldworkAssignment_userId_status_updatedAt_idx" ON "FieldworkAssignment"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FieldworkAssignment_userId_linkedObjectType_linkedObjectId_idx" ON "FieldworkAssignment"("userId", "linkedObjectType", "linkedObjectId");

-- CreateIndex
CREATE INDEX "FieldworkAssignment_userId_createdAt_idx" ON "FieldworkAssignment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UnderstandingEvidenceLink_userId_targetType_targetId_idx" ON "UnderstandingEvidenceLink"("userId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "UnderstandingEvidenceLink_userId_sourceType_sourceId_idx" ON "UnderstandingEvidenceLink"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "UnderstandingEvidenceLink_userId_targetType_role_idx" ON "UnderstandingEvidenceLink"("userId", "targetType", "role");

-- CreateIndex
CREATE INDEX "UnderstandingEvidenceLink_userId_createdAt_idx" ON "UnderstandingEvidenceLink"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnderstandingEvidenceLink_userId_targetType_targetId_source_key" ON "UnderstandingEvidenceLink"("userId", "targetType", "targetId", "sourceType", "sourceId", "role");

-- AddForeignKey
ALTER TABLE "UserMapConclusion" ADD CONSTRAINT "UserMapConclusion_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "UserMapConclusion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMapConclusion" ADD CONSTRAINT "UserMapConclusion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "UserMapConclusion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_resolvedIntoUserMapConclusionId_fkey" FOREIGN KEY ("resolvedIntoUserMapConclusionId") REFERENCES "UserMapConclusion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

