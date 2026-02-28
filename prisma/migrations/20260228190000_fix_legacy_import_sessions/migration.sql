-- Fix legacy import sessions from the Ticket-14 era (before the importedSource
-- column was added). Those imports used the session default origin 'native', which
-- the session_origin_v2 migration converted to 'APP'. They have no importedSource
-- or importedExternalId, but every one of them has a matching IMPORTED_ARCHIVE
-- session (re-imported via the new pipeline) with the same userId + label.
--
-- This UPDATE reclassifies them as IMPORTED_ARCHIVE so they no longer appear in
-- the native chat sessions list. The condition requires ALL of:
--   1. origin = APP (currently misclassified)
--   2. importedSource IS NULL  (old import, column didn't exist yet)
--   3. importedExternalId IS NULL (old import, column didn't exist yet)
--   4. label IS NOT NULL (every real import has a title)
--   5. A matching IMPORTED_ARCHIVE session exists for the same user + label
--      (proving this is a duplicate of an already-correct import record)

UPDATE "Session" s
SET    "origin" = 'IMPORTED_ARCHIVE'::"SessionOrigin"
WHERE  s."origin" = 'APP'::"SessionOrigin"
  AND  s."importedSource" IS NULL
  AND  s."importedExternalId" IS NULL
  AND  s."label" IS NOT NULL
  AND  EXISTS (
         SELECT 1
         FROM   "Session" s2
         WHERE  s2."userId" = s."userId"
           AND  s2."label"  = s."label"
           AND  s2."origin" = 'IMPORTED_ARCHIVE'::"SessionOrigin"
       );
