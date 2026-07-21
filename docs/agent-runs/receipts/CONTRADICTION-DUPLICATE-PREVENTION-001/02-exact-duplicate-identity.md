# 02 — Exact duplicate identity

## Authority

Exact repaired contradiction identity is:

1. `userId`
2. `sideASourceSpanId` (resolved Side A `EvidenceSpan` id)
3. `sideBSourceSpanId` (resolved Side B `EvidenceSpan` id)

Roles are **ordered**. Side A and Side B are not interchangeable.

## What is NOT identity

| Mechanism | Used? |
| --------- | ----- |
| Title matching | No |
| Proposition-text matching | No |
| Fuzzy similarity / token overlap | No |
| Marker families | No |
| Legacy contradiction detection | No |
| Side-B-only sibling suppression | No |
| User-wide semantic collision search | No |
| Reversed-side equivalence | No |
| `sourceMessageId` | No |

## Schema map name

`ContradictionNode_user_sideA_sideB_span_uniq`
