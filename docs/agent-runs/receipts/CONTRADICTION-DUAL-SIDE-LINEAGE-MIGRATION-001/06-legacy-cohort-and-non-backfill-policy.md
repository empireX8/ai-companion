# 06 — Legacy cohort and non-backfill policy

## Existing 25 ContradictionNode candidates

Pre-repair cohort. They must:

- remain unchanged
- receive no fabricated backfill
- receive no guessed spans
- remain valid with null repaired-lineage fields
- not be reclassified, accepted, rejected, archived, or updated

## Stored lineage classification helper

`classifyStoredContradictionLineage`:

| State | Rule |
|-------|------|
| `complete_exact_dual_side` | both span IDs present |
| `legacy_incomplete` | both span IDs absent |
| `invalid_partial` | exactly one present |

Existing 25 classify as `legacy_incomplete` after migration (once applied in a later authorised deploy). This helper does not update rows.

Both-null is legacy incomplete.
One-sided lineage is invalid.
No span can be fabricated.
No full-message fallback exists.

## Migration policy

Additive nullable columns only. No UPDATE of existing rows. No backfill SQL.
