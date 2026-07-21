# 09 — Legacy null-lineage boundary

## Cohort

Kay’s existing 25 contradiction nodes are all `legacy_incomplete` (both span FKs null). Preflight: 0 complete dual-side, 0 invalid partial.

## PostgreSQL behaviour

UNIQUE treats NULLs as distinct, so multiple both-null rows remain permitted under `ContradictionNode_user_sideA_sideB_span_uniq`.

## Contract

- Legacy null-null rows do **not** block exact repaired creation for a complete span pair.
- This slice does **not** backfill, merge, delete, or re-evaluate the existing 25.
- Existing 25 must remain untouched in account before/after gates.
