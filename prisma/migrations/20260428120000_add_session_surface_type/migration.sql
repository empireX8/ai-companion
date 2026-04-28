-- CreateEnum
CREATE TYPE "SessionSurfaceType" AS ENUM ('journal_chat', 'explore_chat');

-- AlterTable
ALTER TABLE "Session"
  ADD COLUMN "surfaceType" "SessionSurfaceType";

-- Backfill existing APP sessions to default surface type
UPDATE "Session"
SET "surfaceType" = 'journal_chat'::"SessionSurfaceType"
WHERE "origin" = 'APP'::"SessionOrigin"
  AND "surfaceType" IS NULL;

-- CreateIndex
CREATE INDEX "Session_userId_origin_surfaceType_startedAt_idx"
  ON "Session"("userId", "origin", "surfaceType", "startedAt");
