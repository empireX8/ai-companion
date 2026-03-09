-- CreateEnum
CREATE TYPE "ResolutionVerdict" AS ENUM ('confirmed', 'refuted', 'partial', 'superseded');

-- AlterEnum
ALTER TYPE "ProjectionStatus" ADD VALUE 'resolved';

-- AlterTable
ALTER TABLE "Projection" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolutionVerdict" "ResolutionVerdict",
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
