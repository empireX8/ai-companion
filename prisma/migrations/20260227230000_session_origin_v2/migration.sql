-- CreateEnum: SessionOrigin
CREATE TYPE "SessionOrigin" AS ENUM ('APP', 'IMPORTED_ARCHIVE');

-- Migrate existing string values to enum values
UPDATE "Session" SET "origin" = 'APP'               WHERE "origin" = 'native';
UPDATE "Session" SET "origin" = 'IMPORTED_ARCHIVE'  WHERE "origin" = 'imported';

-- Change column type from String to SessionOrigin enum
ALTER TABLE "Session"
  ALTER COLUMN "origin" TYPE "SessionOrigin" USING "origin"::"SessionOrigin",
  ALTER COLUMN "origin" SET DEFAULT 'APP';

-- AddColumn: importedSource
ALTER TABLE "Session" ADD COLUMN "importedSource" TEXT;

-- AddColumn: importedAt
ALTER TABLE "Session" ADD COLUMN "importedAt" TIMESTAMP(3);

-- AddColumn: importedExternalId
ALTER TABLE "Session" ADD COLUMN "importedExternalId" TEXT;

-- CreateUniqueIndex: userId + importedExternalId (NULLs treated as distinct by Postgres)
CREATE UNIQUE INDEX "Session_userId_importedExternalId_key"
  ON "Session"("userId", "importedExternalId");

-- DropOldIndex: userId + origin
DROP INDEX IF EXISTS "Session_userId_origin_idx";

-- CreateIndex: userId + origin + createdAt
CREATE INDEX "Session_userId_origin_createdAt_idx"
  ON "Session"("userId", "origin", "createdAt");
