-- CreateTable
CREATE TABLE "InternalMetricEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "value" DOUBLE PRECISION,
    "meta" JSONB,
    "source" TEXT NOT NULL,
    "route" TEXT,
    "dedupeKey" TEXT,

    CONSTRAINT "InternalMetricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalMetricEvent_userId_createdAt_idx" ON "InternalMetricEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalMetricEvent_name_idx" ON "InternalMetricEvent"("name");

-- CreateIndex
CREATE INDEX "InternalMetricEvent_userId_name_idx" ON "InternalMetricEvent"("userId", "name");

-- CreateIndex
CREATE INDEX "InternalMetricEvent_dedupeKey_idx" ON "InternalMetricEvent"("dedupeKey");
