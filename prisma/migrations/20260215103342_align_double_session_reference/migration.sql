/*
  Warnings:

  - Added the required column `sessionId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('constraint', 'pattern', 'goal', 'preference', 'assumption', 'hypothesis', 'rule');

-- CreateEnum
CREATE TYPE "ReferenceConfidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('candidate', 'active', 'superseded', 'inactive');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'assistant';

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_companionId_fkey";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sessionId" TEXT NOT NULL,
ALTER COLUMN "companionId" DROP NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReferenceType" NOT NULL,
    "confidence" "ReferenceConfidence" NOT NULL,
    "status" "ReferenceStatus" NOT NULL,
    "statement" TEXT NOT NULL,
    "sourceSessionId" TEXT,
    "sourceMessageId" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_startedAt_idx" ON "Session"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ReferenceItem_userId_status_idx" ON "ReferenceItem"("userId", "status");

-- CreateIndex
CREATE INDEX "ReferenceItem_userId_type_idx" ON "ReferenceItem"("userId", "type");

-- CreateIndex
CREATE INDEX "ReferenceItem_sourceSessionId_idx" ON "ReferenceItem"("sourceSessionId");

-- CreateIndex
CREATE INDEX "ReferenceItem_sourceMessageId_idx" ON "ReferenceItem"("sourceMessageId");

-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_userId_createdAt_idx" ON "Message"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceItem" ADD CONSTRAINT "ReferenceItem_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceItem" ADD CONSTRAINT "ReferenceItem_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceItem" ADD CONSTRAINT "ReferenceItem_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ReferenceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
