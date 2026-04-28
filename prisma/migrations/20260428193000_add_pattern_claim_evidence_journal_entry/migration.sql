-- Add first-class JournalEntry provenance pointer on PatternClaimEvidence.
ALTER TABLE "PatternClaimEvidence"
ADD COLUMN "journalEntryId" TEXT;

CREATE INDEX "PatternClaimEvidence_journalEntryId_idx"
ON "PatternClaimEvidence"("journalEntryId");

ALTER TABLE "PatternClaimEvidence"
ADD CONSTRAINT "PatternClaimEvidence_journalEntryId_fkey"
FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
