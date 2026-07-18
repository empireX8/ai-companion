# 01 — Candidate schema and query map

## Source tables (production pending queue)

| Table | Pending status | Import provenance gate | Accept → | Reject → |
|-------|----------------|------------------------|----------|----------|
| `ReferenceItem` | `candidate` | `sourceSession.origin = IMPORTED_ARCHIVE` | `active` | `dismissed` |
| `ContradictionNode` | `candidate` | `sourceSession.origin = IMPORTED_ARCHIVE` | `open` | `archived_tension` |

**Not in queue:** `PatternClaim` (already durable; 7 active on Kay’s account). Dark-engine `internal_only` candidates are a separate lifecycle.

## Fields preserved by query

Implemented in `lib/import-candidate-review-query.ts`:

- candidate ID + encoded `reviewKey` (`reference_item:<id>` / `contradiction_node:<id>`)
- candidate type (`ReferenceType` / `ContradictionType`)
- title / claim / summary
- confidence, status
- source import batch (sole completed `ImportUploadSession` when exactly one; else null — **schema has no candidate→upload FK**)
- source conversation / message
- evidence excerpt (message content or contradiction evidence quote)
- created timestamp
- explicit provenance: `import_derived_session`
- `candidateSourceTable`

## Ordering / paging

- Stable order: `createdAt ASC`, then `sourceTable`, then `id`
- Default limit 50, max 100
- Truthful `totalPendingCount` across both tables

## Non-guessing rule

No title-based provenance. Import derivation is **only** via `Session.origin = IMPORTED_ARCHIVE` on `sourceSession`.
