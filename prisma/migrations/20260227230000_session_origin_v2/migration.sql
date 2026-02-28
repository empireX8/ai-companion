-- CreateEnum: SessionOrigin
CREATE TYPE "SessionOrigin" AS ENUM ('APP', 'IMPORTED_ARCHIVE');

-- Change column type from String to SessionOrigin enum,
-- mapping existing values and restoring the default in the correct order.
ALTER TABLE "Session" ALTER COLUMN "origin" DROP DEFAULT;
ALTER TABLE "Session"
  ALTER COLUMN "origin" TYPE "SessionOrigin"
  USING (
    CASE "origin"
      WHEN 'native'   THEN 'APP'::"SessionOrigin"
      WHEN 'imported' THEN 'IMPORTED_ARCHIVE'::"SessionOrigin"
      ELSE 'APP'::"SessionOrigin"
    END
  );
ALTER TABLE "Session" ALTER COLUMN "origin" SET DEFAULT 'APP'::"SessionOrigin";

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
