# 04 — Exact span resolution contract

## Module

`lib/contradiction-dual-side-lineage.ts`

Pure deterministic construction/validation. No production database write.

## Input

`DualSideLineageBuildInput`:

- `userId`
- `selectedPair: SemanticallySelectedContradictionPair` (semanticallySelected; persistable=false; persistenceAuthorised=false)
- `resolvedMessages.sideA` / `sideB` (`id`, `sessionId`, `userId`, `content`)

## Per-side validated output fields

For both Side A and Side B:

- source ID
- session ID
- message ID
- exact quote
- zero-based start-inclusive offset
- zero-based end-exclusive offset
- SHA-256 content hash of the **exact quoted slice**
- side role: A or B

## Content hash rule

Hash is calculated from the exact validated quote slice only — not from:

- complete message
- normalized proposition
- ReferenceItem statement
- trimmed/altered quote

## Successful result naming

- `lineageReadyForPersistenceGate: true`
- `continuationReady: true`
- `validatedDualSideLineage`
- `persistable: false`
- `persistenceAuthorised: false`
- `createCandidate: undefined`
- `persistenceDecision: null`

Also includes `spanEnsureDescriptors` for a later persistence slice to ensure/upsert EvidenceSpans and connect span IDs — without calling those writers now.

## Forbidden behaviours (enforced)

- no `indexOf` / first-occurrence search to invent offsets
- no full-message fallback
- no fuzzy quote match
- no ReferenceItem statement as span text
- no fabricated offsets
- no call to materialisation / contradictionNode.create|update
