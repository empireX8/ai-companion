-- AddColumn: journalEntrySpread and supportContainerSpread on PatternClaim
-- Source-aware spread accounting fields.
-- Both default to 0 for existing and new rows.

ALTER TABLE "PatternClaim" ADD COLUMN "journalEntrySpread" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PatternClaim" ADD COLUMN "supportContainerSpread" INTEGER NOT NULL DEFAULT 0;
