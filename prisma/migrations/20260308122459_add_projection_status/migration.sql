-- CreateEnum
CREATE TYPE "ProjectionStatus" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "Projection" ADD COLUMN     "status" "ProjectionStatus" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "Projection_userId_status_idx" ON "Projection"("userId", "status");
