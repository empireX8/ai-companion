# 05 — EvidenceSpan ensure / reuse contract

**Implemented in:** `lib/contradiction-repaired-persistence.ts` (transaction-local)

## Identity

Exact unique identity (unchanged):

- `messageId`
- `charStart`
- `charEnd`
- `contentHash` (SHA-256 of exact quote slice)

## Behaviour

1. Re-resolve source message; verify user, session, exact slice, recomputed hash.
2. `findUnique` on exact identity.
3. If present: verify **complete** descriptor + `userId` ownership; reuse id.
4. If absent: create span with plan descriptor fields.
5. Prove Side A and Side B resulting IDs are distinct.

## Forbidden

- Normalize quotes before hashing
- Hash normalized propositions or full messages
- Search for similar substrings
- Silently alter offsets
- Create a span owned by another user
- Trust a row solely because one unique field matched

## Relationship to `ensureEvidenceSpan`

`lib/derivation-layer.ts` `ensureEvidenceSpan` matches the identity contract but does **not** verify ownership.

This slice does **not** call that helper. The writer implements equivalent ensure/reuse **with** ownership and complete-descriptor verification inside the injected transaction.
