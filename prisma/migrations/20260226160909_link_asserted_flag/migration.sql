-- AlterTable
ALTER TABLE "ContradictionReferenceLink" ADD COLUMN     "asserted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assertedAt" TIMESTAMP(3);
