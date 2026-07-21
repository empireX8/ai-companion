# 02 — Design A versus Design B decision

## Exact design chosen: **A**

## Design A (implemented)

Add direct optional relations from ContradictionNode:

- `sideASourceSpanId` / `sideASourceSpan`
- `sideBSourceSpanId` / `sideBSourceSpan`

with named reverse relations on EvidenceSpan:

- `contradictionNodesAsSideA`
- `contradictionNodesAsSideB`

## Why Design A is valid

1. Smallest schema change that guarantees symmetric exact lineage (exactly one Side A span FK and exactly one Side B span FK on the node).
2. Existing EvidenceSpan already stores `messageId`, `charStart`, `charEnd`, `contentHash` — the CN→span FK closes the chain to Message→Session.
3. No intermediate link table is required for unambiguous Side A / Side B role assignment.
4. Nullable fields leave the existing 25 rows schema-compatible without backfill.
5. SQL CHECK constraints encode both-or-neither and distinct-span invariants that Prisma cannot express alone.

## Design B (rejected for this slice)

A dedicated lineage/link structure identifying Side A/B spans and roles.

### Rejection rationale

- Design A already identifies exact Side A and Side B spans with roles via named relations.
- Design B would add abstraction (extra table/rows) without closing an audit-proven blocker in Design A.
- Task instruction: do not choose Design B merely to create abstraction; if Design A is valid, use Design A.

## Non-claims

- Legacy `sourceSessionId` / `sourceMessageId` / `ContradictionEvidence` are not reinterpreted as Design A repaired lineage.
- Design A fields being present in schema does not mean live persistence is wired.
