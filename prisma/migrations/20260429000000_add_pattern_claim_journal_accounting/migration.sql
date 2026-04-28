-- AddColumn: journalEvidenceCount and journalDaySpread on PatternClaim
-- Accounting fields for source-aware pattern lifecycle tracking.
-- Both default to 0 — safe for all existing rows.

ALTER TABLE "PatternClaim" ADD COLUMN "journalEvidenceCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PatternClaim" ADD COLUMN "journalDaySpread" INTEGER NOT NULL DEFAULT 0;
