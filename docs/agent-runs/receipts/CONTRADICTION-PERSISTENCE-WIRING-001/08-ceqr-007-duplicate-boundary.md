# 08 — CEQR-007 duplicate boundary

## Explicit statement

> Repeated valid persistence invocations may still require CEQR-007 contradiction-level deduplication.

## What this slice allows

- `EvidenceSpan` ensure/reuse may be idempotent via exact unique identity
- One writer invocation creates at most one node
- Transaction-local protection against two node creates inside one invocation

## What this slice does **not** implement

- User-wide fuzzy collision search
- Title/text similarity dedup
- Sibling-node suppression based on Side B
- Claim that repeat invocations are contradiction-idempotent
- Any uniqueness mechanism beyond schema constraints + single create per invocation

CEQR-007 remains the dedicated contradiction duplicate-prevention slice.
