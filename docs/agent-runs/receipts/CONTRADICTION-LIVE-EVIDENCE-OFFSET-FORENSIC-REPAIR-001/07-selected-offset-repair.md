# 07 — Selected offset repair

## Selected: Architecture B — lexical boundary-index transport (schema-v4)

- Provider selects `startBoundaryIndex` / `endBoundaryIndex` only.
- Code enumerates valid lexical boundaries (`lexical-boundary-catalog.ts`).
- Code maps indices → UTF-16 offsets → derives `exactQuote`.
- Mid-word offsets are structurally absent from the catalog.
- Out-of-range indices fail closed (`invalid_boundary_index`).
- Raw provider object remains unmodified.
- No clamping / fuzzy match / silent repair.
- Schema-v3 semantic discrimination (`anyOf` clear / non-clear / abstention) preserved in schema-v4.
- Prompt-v4 + live addendum-v4 accompany the structural change (not prompt-only optimism).

## Why not A or C

- A does not structurally prevent mid-word cuts.
- C is safer but higher dynamic-schema / migration risk for this slice.
