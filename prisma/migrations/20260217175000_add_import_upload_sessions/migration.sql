-- CreateEnum
CREATE TYPE "ImportUploadStatus" AS ENUM ('pending', 'uploading', 'uploaded', 'processing', 'complete', 'failed', 'expired');

-- CreateTable
CREATE TABLE "ImportUploadSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytesTotal" BIGINT NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "status" "ImportUploadStatus" NOT NULL DEFAULT 'pending',
    "processingProgress" INTEGER NOT NULL DEFAULT 0,
    "processedConversations" INTEGER NOT NULL DEFAULT 0,
    "processedMessages" INTEGER NOT NULL DEFAULT 0,
    "sessionsCreated" INTEGER NOT NULL DEFAULT 0,
    "messagesCreated" INTEGER NOT NULL DEFAULT 0,
    "contradictionsCreated" INTEGER NOT NULL DEFAULT 0,
    "resultErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportUploadChunk" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportUploadChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportUploadSession_userId_createdAt_idx" ON "ImportUploadSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportUploadChunk_sessionId_chunkIndex_key" ON "ImportUploadChunk"("sessionId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ImportUploadChunk_sessionId_createdAt_idx" ON "ImportUploadChunk"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportUploadChunk" ADD CONSTRAINT "ImportUploadChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
