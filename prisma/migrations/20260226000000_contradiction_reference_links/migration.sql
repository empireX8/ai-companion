-- CreateTable
CREATE TABLE "ContradictionReferenceLink" (
    "id" TEXT NOT NULL,
    "contradictionId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContradictionReferenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContradictionReferenceLink_contradictionId_referenceId_key" ON "ContradictionReferenceLink"("contradictionId", "referenceId");

-- CreateIndex
CREATE INDEX "ContradictionReferenceLink_contradictionId_idx" ON "ContradictionReferenceLink"("contradictionId");

-- CreateIndex
CREATE INDEX "ContradictionReferenceLink_referenceId_idx" ON "ContradictionReferenceLink"("referenceId");

-- AddForeignKey
ALTER TABLE "ContradictionReferenceLink" ADD CONSTRAINT "ContradictionReferenceLink_contradictionId_fkey" FOREIGN KEY ("contradictionId") REFERENCES "ContradictionNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContradictionReferenceLink" ADD CONSTRAINT "ContradictionReferenceLink_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "ReferenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
