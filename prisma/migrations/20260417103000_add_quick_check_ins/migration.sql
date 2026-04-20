-- CreateEnum
CREATE TYPE "QuickCheckInStateTag" AS ENUM ('overloaded', 'stressed', 'flat', 'stable', 'energized');

-- CreateTable
CREATE TABLE "QuickCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateTag" "QuickCheckInStateTag",
    "eventTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "note" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickCheckIn_userId_createdAt_idx" ON "QuickCheckIn"("userId", "createdAt");
