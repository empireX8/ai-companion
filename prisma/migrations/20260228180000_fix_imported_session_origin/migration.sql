-- Fix sessions whose origin was incorrectly set to 'APP' during the
-- session_origin_v2 migration (20260227230000).
--
-- Root cause: the import pipeline was already writing origin = 'IMPORTED_ARCHIVE'
-- (the enum name as a plain string) BEFORE the column was converted from String
-- to the SessionOrigin enum type. The CASE expression in that migration only
-- handled 'native' → APP and 'imported' → IMPORTED_ARCHIVE; the literal string
-- 'IMPORTED_ARCHIVE' fell to the ELSE branch and was mapped to 'APP'.
--
-- This UPDATE corrects those rows. The discriminator used is importedSource,
-- which is NULL for all native (APP) sessions and non-NULL for every imported
-- session — it is set unconditionally by the import pipeline.

UPDATE "Session"
SET    "origin" = 'IMPORTED_ARCHIVE'::"SessionOrigin"
WHERE  "importedSource" IS NOT NULL
  AND  "origin" = 'APP'::"SessionOrigin";
