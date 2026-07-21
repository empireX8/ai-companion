# 06 — Concurrency race contract

## Requirement

A read-before-create check alone is insufficient. Two concurrent valid invocations must not commit two nodes. Database uniqueness is the final authority.

## Architecture

1. Both callers may observe absence inside their transactions.
2. One create wins.
3. The loser hits unique conflict (`P2002` / unique-constraint error).
4. The loser’s transaction aborts/rolls back.
5. Recovery runs **outside** the aborted transaction using top-level `db`.
6. Recovery resolves the durable exact node and returns reuse.

## Two proven race shapes

### Node-create race (pre-existing spans)

Harness: `makeFakeDb({ raceMode: true, existingSpans: [...] })`.

Exact Side A / Side B EvidenceSpans are pre-seeded so both callers reuse spans and race only on `ContradictionNode` create. Both observe absent node via `findFirst` barrier, one create wins, loser hits node `P2002`, top-level recovery reuses the exact node.

Test: `concurrent same-plan invocations result in one durable node via P2002 recovery`.

### EvidenceSpan-create race (empty state)

Harness: `makeSpanRaceFakeDb()` — starts with **no** EvidenceSpans and **no** ContradictionNode.

Both concurrent same-plan callers observe Side A span absent (explicit barrier), both attempt Side A create, one insert wins, loser waits until the winning transaction fully commits (both spans + node) before throwing simulated EvidenceSpan `P2002`. Loser transaction rolls back; outer recovery on top-level `db` resolves exact spans + exact node and returns reused.

Test: `concurrent same-plan invocations from empty spans recover exact node after EvidenceSpan P2002`.

## EvidenceSpan race (general)

If span `create` races on the existing EvidenceSpan unique key, the transaction aborts on unique conflict. Recovery re-resolves both spans by exact identity, then the exact node (or one create attempt for the node if still absent). Proven from empty state by the EvidenceSpan-create race test above.

## Proof

- Node race: shared absent observation → one node create winner → simulated P2002 loser → recovery → one durable node.
- Span race: shared Side A absent observation → one span+node commit winner → EvidenceSpan P2002 loser after winner commit → recovery → one durable node, same id, loser `writeExecuted: false` / `reused`.
