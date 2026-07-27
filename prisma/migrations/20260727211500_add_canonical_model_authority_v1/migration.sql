-- CreateEnum
CREATE TYPE "ExploreMovementAuthorityMode" AS ENUM ('legacy', 'canonical_v1');

-- CreateEnum
CREATE TYPE "CanonicalConceptLifecycleStatus" AS ENUM ('active');

-- CreateEnum
CREATE TYPE "CanonicalConceptDomain" AS ENUM ('operating_logic', 'state_ecology', 'tension_architecture', 'recovery_architecture', 'meaning_system', 'relational_field', 'developmental_vector', 'current_frontier', 'unknown');

-- CreateEnum
CREATE TYPE "CanonicalConceptSourceType" AS ENUM ('usermap_conclusion', 'pattern_claim', 'contradiction_node', 'reference_item', 'profile_artifact');

-- CreateEnum
CREATE TYPE "CanonicalConceptBindingRole" AS ENUM ('legacy_seed', 'related_interpretation');

-- CreateEnum
CREATE TYPE "CanonicalRevisionStatus" AS ENUM ('hypothesis', 'tentative', 'emerging', 'supported', 'disputed');

-- CreateEnum
CREATE TYPE "CanonicalRevisionOperation" AS ENUM ('registered', 'strengthen');

-- CreateEnum
CREATE TYPE "CanonicalRevisionDecisionSource" AS ENUM ('legacy_registration', 'explore_proposal');

-- AlterEnum
ALTER TYPE "UnderstandingLinkTargetType" ADD VALUE 'canonical_concept_revision';

-- AlterTable
ALTER TABLE "ModelUpdate" ADD COLUMN     "canonicalConceptId" TEXT,
ADD COLUMN     "exploreProposalId" TEXT,
ADD COLUMN     "previousRevisionId" TEXT,
ADD COLUMN     "resultingRevisionId" TEXT;

-- AlterTable
ALTER TABLE "ExploreMovementProposal" ADD COLUMN     "authorityMode" "ExploreMovementAuthorityMode" NOT NULL DEFAULT 'legacy',
ADD COLUMN     "canonicalConceptId" TEXT,
ADD COLUMN     "expectedCurrentRevisionId" TEXT,
ADD COLUMN     "expectedLegacySnapshotHash" TEXT,
ADD COLUMN     "revisionOperation" "CanonicalRevisionOperation";

-- CreateTable
CREATE TABLE "CanonicalConcept" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationKey" TEXT NOT NULL,
    "domain" "CanonicalConceptDomain" NOT NULL DEFAULT 'unknown',
    "lifecycleStatus" "CanonicalConceptLifecycleStatus" NOT NULL DEFAULT 'active',
    "currentRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalConceptRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "CanonicalRevisionStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" "UserMapConfidenceLevel" NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT,
    "operation" "CanonicalRevisionOperation" NOT NULL,
    "decisionSource" "CanonicalRevisionDecisionSource" NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "registrationSnapshotHash" TEXT,
    "previousRevisionId" TEXT,
    "createdFromProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalConceptRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalConceptSourceBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "sourceType" "CanonicalConceptSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "bindingRole" "CanonicalConceptBindingRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalConceptSourceBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanonicalConcept_userId_updatedAt_idx" ON "CanonicalConcept"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CanonicalConcept_userId_lifecycleStatus_updatedAt_idx" ON "CanonicalConcept"("userId", "lifecycleStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConcept_id_userId_key" ON "CanonicalConcept"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConcept_userId_registrationKey_key" ON "CanonicalConcept"("userId", "registrationKey");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConcept_currentRevisionId_id_key" ON "CanonicalConcept"("currentRevisionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_previousRevisionId_key" ON "CanonicalConceptRevision"("previousRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_createdFromProposalId_key" ON "CanonicalConceptRevision"("createdFromProposalId");

-- CreateIndex
CREATE INDEX "CanonicalConceptRevision_userId_conceptId_version_idx" ON "CanonicalConceptRevision"("userId", "conceptId", "version");

-- CreateIndex
CREATE INDEX "CanonicalConceptRevision_userId_createdAt_idx" ON "CanonicalConceptRevision"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_id_conceptId_key" ON "CanonicalConceptRevision"("id", "conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_id_userId_key" ON "CanonicalConceptRevision"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_id_conceptId_userId_key" ON "CanonicalConceptRevision"("id", "conceptId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_conceptId_version_key" ON "CanonicalConceptRevision"("conceptId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_createdFromProposalId_userId_key" ON "CanonicalConceptRevision"("createdFromProposalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptRevision_previousRevisionId_conceptId_userI_key" ON "CanonicalConceptRevision"("previousRevisionId", "conceptId", "userId");

-- CreateIndex
CREATE INDEX "CanonicalConceptSourceBinding_conceptId_idx" ON "CanonicalConceptSourceBinding"("conceptId");

-- CreateIndex
CREATE INDEX "CanonicalConceptSourceBinding_userId_sourceType_idx" ON "CanonicalConceptSourceBinding"("userId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptSourceBinding_userId_sourceType_sourceId_key" ON "CanonicalConceptSourceBinding"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalConceptSourceBinding_conceptId_sourceType_sourceId_key" ON "CanonicalConceptSourceBinding"("conceptId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelUpdate_resultingRevisionId_key" ON "ModelUpdate"("resultingRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelUpdate_exploreProposalId_key" ON "ModelUpdate"("exploreProposalId");

-- CreateIndex
CREATE INDEX "ModelUpdate_userId_canonicalConceptId_createdAt_idx" ON "ModelUpdate"("userId", "canonicalConceptId", "createdAt");

-- CreateIndex
CREATE INDEX "ModelUpdate_previousRevisionId_idx" ON "ModelUpdate"("previousRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelUpdate_resultingRevisionId_userId_key" ON "ModelUpdate"("resultingRevisionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelUpdate_exploreProposalId_userId_key" ON "ModelUpdate"("exploreProposalId", "userId");

-- CreateIndex
CREATE INDEX "ExploreMovementProposal_canonicalConceptId_status_idx" ON "ExploreMovementProposal"("canonicalConceptId", "status");

-- CreateIndex
CREATE INDEX "ExploreMovementProposal_expectedCurrentRevisionId_idx" ON "ExploreMovementProposal"("expectedCurrentRevisionId");

-- CreateIndex
CREATE INDEX "ExploreMovementProposal_authorityMode_status_createdAt_idx" ON "ExploreMovementProposal"("authorityMode", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreMovementProposal_id_userId_key" ON "ExploreMovementProposal"("id", "userId");

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_canonicalConceptId_userId_fkey" FOREIGN KEY ("canonicalConceptId", "userId") REFERENCES "CanonicalConcept"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_previousRevisionId_userId_fkey" FOREIGN KEY ("previousRevisionId", "userId") REFERENCES "CanonicalConceptRevision"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_resultingRevisionId_userId_fkey" FOREIGN KEY ("resultingRevisionId", "userId") REFERENCES "CanonicalConceptRevision"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_exploreProposalId_userId_fkey" FOREIGN KEY ("exploreProposalId", "userId") REFERENCES "ExploreMovementProposal"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalConcept" ADD CONSTRAINT "CanonicalConcept_currentRevisionId_id_fkey" FOREIGN KEY ("currentRevisionId", "id") REFERENCES "CanonicalConceptRevision"("id", "conceptId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalConceptRevision" ADD CONSTRAINT "CanonicalConceptRevision_conceptId_userId_fkey" FOREIGN KEY ("conceptId", "userId") REFERENCES "CanonicalConcept"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalConceptRevision" ADD CONSTRAINT "CanonicalConceptRevision_previousRevisionId_conceptId_user_fkey" FOREIGN KEY ("previousRevisionId", "conceptId", "userId") REFERENCES "CanonicalConceptRevision"("id", "conceptId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalConceptRevision" ADD CONSTRAINT "CanonicalConceptRevision_createdFromProposalId_userId_fkey" FOREIGN KEY ("createdFromProposalId", "userId") REFERENCES "ExploreMovementProposal"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalConceptSourceBinding" ADD CONSTRAINT "CanonicalConceptSourceBinding_conceptId_userId_fkey" FOREIGN KEY ("conceptId", "userId") REFERENCES "CanonicalConcept"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExploreMovementProposal" ADD CONSTRAINT "ExploreMovementProposal_canonicalConceptId_userId_fkey" FOREIGN KEY ("canonicalConceptId", "userId") REFERENCES "CanonicalConcept"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExploreMovementProposal" ADD CONSTRAINT "ExploreMovementProposal_expectedCurrentRevisionId_canonica_fkey" FOREIGN KEY ("expectedCurrentRevisionId", "canonicalConceptId", "userId") REFERENCES "CanonicalConceptRevision"("id", "conceptId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Proposal expectation mutex: at most one expectation basis field.
ALTER TABLE "ExploreMovementProposal"
  ADD CONSTRAINT "ExploreMovementProposal_expectation_mutex_check"
  CHECK (
    NOT (
      "expectedCurrentRevisionId" IS NOT NULL
      AND "expectedLegacySnapshotHash" IS NOT NULL
    )
  );

-- Proposal authority-mode field coherence.
ALTER TABLE "ExploreMovementProposal"
  ADD CONSTRAINT "ExploreMovementProposal_authority_mode_check"
  CHECK (
    (
      "authorityMode" = 'legacy'
      AND "expectedCurrentRevisionId" IS NULL
      AND "expectedLegacySnapshotHash" IS NULL
      AND "canonicalConceptId" IS NULL
      AND "revisionOperation" IS NULL
    )
    OR
    (
      "authorityMode" = 'canonical_v1'
      AND "revisionOperation" = 'strengthen'
      AND (
        ("expectedCurrentRevisionId" IS NOT NULL AND "expectedLegacySnapshotHash" IS NULL)
        OR
        ("expectedCurrentRevisionId" IS NULL AND "expectedLegacySnapshotHash" IS NOT NULL)
      )
      AND (
        ("expectedCurrentRevisionId" IS NOT NULL AND "canonicalConceptId" IS NOT NULL)
        OR
        ("expectedCurrentRevisionId" IS NULL AND "canonicalConceptId" IS NULL)
      )
    )
  );

-- Revision numeric bounds.
ALTER TABLE "CanonicalConceptRevision"
  ADD CONSTRAINT "CanonicalConceptRevision_evidenceCount_nonneg_check"
  CHECK ("evidenceCount" >= 0);

ALTER TABLE "CanonicalConceptRevision"
  ADD CONSTRAINT "CanonicalConceptRevision_confidenceScore_range_check"
  CHECK ("confidenceScore" >= 0 AND "confidenceScore" <= 1);

-- Revision shape V1 (registered vs strengthen).
ALTER TABLE "CanonicalConceptRevision"
  ADD CONSTRAINT "CanonicalConceptRevision_shape_v1_check"
  CHECK (
    (
      "version" = 1
      AND "operation" = 'registered'
      AND "decisionSource" = 'legacy_registration'
      AND "previousRevisionId" IS NULL
      AND "createdFromProposalId" IS NULL
      AND "registrationSnapshotHash" IS NOT NULL
    )
    OR
    (
      "version" >= 2
      AND "operation" = 'strengthen'
      AND "decisionSource" = 'explore_proposal'
      AND "previousRevisionId" IS NOT NULL
      AND "createdFromProposalId" IS NOT NULL
      AND "registrationSnapshotHash" IS NULL
    )
  );

-- Revision immutability: reject every UPDATE or DELETE.
CREATE OR REPLACE FUNCTION canonical_revision_immutable_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'canonical_concept_revision_is_immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER canonical_revision_immutable_guard_trg
BEFORE UPDATE OR DELETE ON "CanonicalConceptRevision"
FOR EACH ROW EXECUTE FUNCTION canonical_revision_immutable_guard();

-- Strengthened ModelUpdate canonical-lineage guard.
CREATE OR REPLACE FUNCTION model_update_canonical_lineage_guard()
RETURNS trigger AS $$
DECLARE
  prev "CanonicalConceptRevision"%ROWTYPE;
  res  "CanonicalConceptRevision"%ROWTYPE;
  prop_user text;
  prop_mode "ExploreMovementAuthorityMode";
BEGIN
  IF NEW."canonicalConceptId" IS NULL
     AND NEW."previousRevisionId" IS NULL
     AND NEW."resultingRevisionId" IS NULL
     AND NEW."exploreProposalId" IS NULL THEN
    RETURN NEW; -- legacy ModelUpdate
  END IF;

  IF NEW."canonicalConceptId" IS NULL
     OR NEW."previousRevisionId" IS NULL
     OR NEW."resultingRevisionId" IS NULL
     OR NEW."exploreProposalId" IS NULL THEN
    RAISE EXCEPTION 'model_update_canonical_lineage_incomplete';
  END IF;

  IF NEW."previousRevisionId" = NEW."resultingRevisionId" THEN
    RAISE EXCEPTION 'model_update_revision_ids_not_distinct';
  END IF;

  SELECT "userId", "authorityMode"
    INTO prop_user, prop_mode
  FROM "ExploreMovementProposal"
  WHERE id = NEW."exploreProposalId";

  IF prop_user IS NULL OR prop_user <> NEW."userId" THEN
    RAISE EXCEPTION 'model_update_explore_proposal_ownership';
  END IF;

  IF prop_mode IS DISTINCT FROM 'canonical_v1' THEN
    RAISE EXCEPTION 'model_update_explore_proposal_not_canonical';
  END IF;

  SELECT * INTO prev FROM "CanonicalConceptRevision"
  WHERE id = NEW."previousRevisionId";
  SELECT * INTO res  FROM "CanonicalConceptRevision"
  WHERE id = NEW."resultingRevisionId";

  IF prev.id IS NULL OR res.id IS NULL THEN
    RAISE EXCEPTION 'model_update_revision_missing';
  END IF;

  IF prev."userId" <> NEW."userId"
     OR res."userId" <> NEW."userId"
     OR prev."conceptId" <> NEW."canonicalConceptId"
     OR res."conceptId" <> NEW."canonicalConceptId" THEN
    RAISE EXCEPTION 'model_update_revision_ownership';
  END IF;

  IF res."previousRevisionId" IS DISTINCT FROM NEW."previousRevisionId" THEN
    RAISE EXCEPTION 'model_update_resulting_previous_mismatch';
  END IF;

  IF res.version <> prev.version + 1 THEN
    RAISE EXCEPTION 'model_update_non_adjacent_versions';
  END IF;

  IF res."createdFromProposalId" IS DISTINCT FROM NEW."exploreProposalId" THEN
    RAISE EXCEPTION 'model_update_resulting_proposal_mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_update_canonical_lineage_guard_trg
BEFORE INSERT OR UPDATE ON "ModelUpdate"
FOR EACH ROW EXECUTE FUNCTION model_update_canonical_lineage_guard();
