-- AlterTable
ALTER TABLE "ContradictionNode" ADD COLUMN     "evidenceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEvidenceAt" TIMESTAMP(3),
ADD COLUMN     "lastSurfacedAt" TIMESTAMP(3),
ADD COLUMN     "snoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timesSurfaced" INTEGER NOT NULL DEFAULT 0;
