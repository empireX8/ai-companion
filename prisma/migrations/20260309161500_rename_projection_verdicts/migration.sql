-- AlterEnum
-- Rename ResolutionVerdict enum values: confirmed→correct, refuted→incorrect, partial→mixed, remove superseded
-- Since this enum was just added and no rows exist with old values, safe to drop and recreate.

ALTER TYPE "ResolutionVerdict" RENAME TO "ResolutionVerdict_old";
CREATE TYPE "ResolutionVerdict" AS ENUM ('correct', 'incorrect', 'mixed');
ALTER TABLE "Projection" ALTER COLUMN "resolutionVerdict" TYPE "ResolutionVerdict" USING "resolutionVerdict"::text::"ResolutionVerdict";
DROP TYPE "ResolutionVerdict_old";
