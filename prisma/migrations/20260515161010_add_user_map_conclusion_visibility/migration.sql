-- CreateEnum
CREATE TYPE "UserMapConclusionVisibility" AS ENUM ('user_visible', 'internal_only');

-- AlterTable
ALTER TABLE "UserMapConclusion" ADD COLUMN     "visibility" "UserMapConclusionVisibility" NOT NULL DEFAULT 'user_visible';
