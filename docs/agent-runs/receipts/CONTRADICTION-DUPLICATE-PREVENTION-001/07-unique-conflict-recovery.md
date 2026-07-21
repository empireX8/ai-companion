# 07 — Unique-conflict recovery

## Rule

Never query an already-aborted PostgreSQL / fake transaction after `P2002`. Recovery uses top-level `ContradictionRepairedPersistenceDb`.

## Steps (`recoverExactAfterUniqueConflict`)

1. Resolve Side A span by exact identity; verify ownership/descriptor.
2. Resolve Side B span similarly.
3. Find node by exact `userId + sideA + sideB`.
4. If found: integrity check → reused success (`writeExecuted: false`).
5. If spans exist but node absent: one fresh transaction to create the node.
   - Success → created
   - Another `P2002` → re-read node; reuse if found else `unique_conflict_unresolved`
6. Never claim `created` if the durable outcome was reuse.

## Proven paths

- **ContradictionNode P2002** — concurrent same-plan race with pre-seeded spans; loser recovers exact node outside aborted tx.
- **EvidenceSpan P2002** — concurrent same-plan race from empty spans/nodes (`makeSpanRaceFakeDb`); loser waits for winner commit, then recovers exact spans + exact node via top-level `db` (`concurrent same-plan invocations from empty spans recover exact node after EvidenceSpan P2002`).

## Failure codes

- `unique_conflict_unresolved` — conflict without a resolvable complete exact node
- `existing_node_mismatch` — exact-key row fails integrity (blank id / wrong userId / wrong span ids)
- `span_unique_conflict_unresolved` — reserved/optional; span miss folded into `unique_conflict_unresolved` on recovery path
