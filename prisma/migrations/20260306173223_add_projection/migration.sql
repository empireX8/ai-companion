-- CreateTable
CREATE TABLE "Projection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "premise" TEXT NOT NULL,
    "drivers" TEXT[],
    "outcomes" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceSessionId" TEXT,
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Projection_userId_createdAt_idx" ON "Projection"("userId", "createdAt");
