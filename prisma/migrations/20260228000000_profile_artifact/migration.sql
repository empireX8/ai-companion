-- CreateEnum: ProfileArtifactType
CREATE TYPE "ProfileArtifactType" AS ENUM (
  'BELIEF', 'VALUE', 'GOAL', 'FEAR', 'IDENTITY', 'TRAIT', 'HABIT',
  'TOPIC', 'RELATIONSHIP_PATTERN', 'EMOTIONAL_PATTERN', 'COGNITIVE_PATTERN'
);

-- CreateTable: ProfileArtifact
CREATE TABLE "ProfileArtifact" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"      TEXT NOT NULL,
  "type"        "ProfileArtifactType" NOT NULL,
  "claim"       TEXT NOT NULL,
  "claimNorm"   TEXT NOT NULL,
  "confidence"  DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "status"      TEXT NOT NULL DEFAULT 'candidate',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "ProfileArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfileArtifactEvidenceLink
CREATE TABLE "ProfileArtifactEvidenceLink" (
  "artifactId"  TEXT NOT NULL,
  "spanId"      TEXT NOT NULL,
  CONSTRAINT "ProfileArtifactEvidenceLink_pkey" PRIMARY KEY ("artifactId", "spanId")
);

-- Unique: ProfileArtifact(userId, type, claimNorm)
CREATE UNIQUE INDEX "ProfileArtifact_userId_type_claimNorm_key"
  ON "ProfileArtifact"("userId", "type", "claimNorm");

-- Indexes
CREATE INDEX "ProfileArtifact_userId_type_idx"      ON "ProfileArtifact"("userId", "type");
CREATE INDEX "ProfileArtifact_userId_status_idx"    ON "ProfileArtifact"("userId", "status");
CREATE INDEX "ProfileArtifact_userId_lastSeenAt_idx" ON "ProfileArtifact"("userId", "lastSeenAt");

-- FKs for ProfileArtifactEvidenceLink
ALTER TABLE "ProfileArtifactEvidenceLink"
  ADD CONSTRAINT "ProfileArtifactEvidenceLink_artifactId_fkey"
    FOREIGN KEY ("artifactId") REFERENCES "ProfileArtifact"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ProfileArtifactEvidenceLink_spanId_fkey"
    FOREIGN KEY ("spanId")     REFERENCES "EvidenceSpan"("id")    ON DELETE CASCADE;

-- Add createdAt index to EvidenceSpan (for pagination)
CREATE INDEX "EvidenceSpan_userId_createdAt_idx" ON "EvidenceSpan"("userId", "createdAt");
