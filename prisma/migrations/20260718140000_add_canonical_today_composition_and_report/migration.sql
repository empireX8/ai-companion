-- Canonical Today composition + first-class Model Movement Report

CREATE TABLE "CanonicalTodayComposition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalTodayComposition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanonicalTodayComposition_userId_key" ON "CanonicalTodayComposition"("userId");
CREATE INDEX "CanonicalTodayComposition_userId_updatedAt_idx" ON "CanonicalTodayComposition"("userId", "updatedAt");

CREATE TABLE "CanonicalModelMovementReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "period" TEXT,
    "sectionsJson" JSONB NOT NULL,
    "relatedMovementIds" JSONB NOT NULL,
    "relatedReceiptIds" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalModelMovementReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CanonicalModelMovementReport_userId_generatedAt_idx" ON "CanonicalModelMovementReport"("userId", "generatedAt");
