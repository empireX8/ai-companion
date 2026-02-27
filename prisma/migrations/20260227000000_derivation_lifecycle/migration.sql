-- CreateTable: DerivationRun
CREATE TABLE "DerivationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "processorVersion" TEXT NOT NULL,
    "inputMessageSetHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: DerivationRun
CREATE INDEX "DerivationRun_userId_createdAt_idx" ON "DerivationRun"("userId", "createdAt");
CREATE INDEX "DerivationRun_scope_idx" ON "DerivationRun"("scope");

-- CreateTable: EvidenceSpan
CREATE TABLE "EvidenceSpan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: EvidenceSpan
CREATE UNIQUE INDEX "EvidenceSpan_messageId_charStart_charEnd_contentHash_key" ON "EvidenceSpan"("messageId", "charStart", "charEnd", "contentHash");
CREATE INDEX "EvidenceSpan_userId_messageId_idx" ON "EvidenceSpan"("userId", "messageId");

-- AddForeignKey: EvidenceSpan → Message
ALTER TABLE "EvidenceSpan" ADD CONSTRAINT "EvidenceSpan_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DerivationArtifact
CREATE TABLE "DerivationArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "payload" JSONB NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "temporalStart" TIMESTAMP(3),
    "temporalEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: DerivationArtifact
CREATE INDEX "DerivationArtifact_userId_type_idx" ON "DerivationArtifact"("userId", "type");
CREATE INDEX "DerivationArtifact_runId_idx" ON "DerivationArtifact"("runId");

-- AddForeignKey: DerivationArtifact → DerivationRun
ALTER TABLE "DerivationArtifact" ADD CONSTRAINT "DerivationArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DerivationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ArtifactEvidenceLink
CREATE TABLE "ArtifactEvidenceLink" (
    "artifactId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "ArtifactEvidenceLink_pkey" PRIMARY KEY ("artifactId","spanId")
);

-- AddForeignKey: ArtifactEvidenceLink → DerivationArtifact
ALTER TABLE "ArtifactEvidenceLink" ADD CONSTRAINT "ArtifactEvidenceLink_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "DerivationArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ArtifactEvidenceLink → EvidenceSpan
ALTER TABLE "ArtifactEvidenceLink" ADD CONSTRAINT "ArtifactEvidenceLink_spanId_fkey" FOREIGN KEY ("spanId") REFERENCES "EvidenceSpan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ArtifactPromotionLink
CREATE TABLE "ArtifactPromotionLink" (
    "artifactId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactPromotionLink_pkey" PRIMARY KEY ("artifactId","entityType","entityId")
);

-- CreateUniqueIndex: ArtifactPromotionLink (one artifact per entity)
CREATE UNIQUE INDEX "ArtifactPromotionLink_entityType_entityId_key" ON "ArtifactPromotionLink"("entityType", "entityId");

-- CreateIndex: ArtifactPromotionLink
CREATE INDEX "ArtifactPromotionLink_artifactId_idx" ON "ArtifactPromotionLink"("artifactId");

-- AddForeignKey: ArtifactPromotionLink → DerivationArtifact
ALTER TABLE "ArtifactPromotionLink" ADD CONSTRAINT "ArtifactPromotionLink_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "DerivationArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
