# 06 — ContradictionNode transaction contract

**Entry:** `persistRepairedContradictionCandidate({ plan, db, now? })`

## Requirements

- Accept only gate-authorised plans (`assertAuthorisedContradictionPersistencePlan`)
- One atomic `$transaction`
- Ensure/reuse Side A + Side B spans
- Create **exactly one** `ContradictionNode` with:
  - `status: "candidate"`
  - both `sideASourceSpanId` and `sideBSourceSpanId`
  - distinct span IDs
  - CEQR-006 `recommendedStorageConfidence`
  - authoritative title / propositions / type
  - `sourceSessionId` = shared session
  - `sourceMessageId` = `null` (dual span FKs are provenance; no singular side authority)
  - `evidenceCount: 0` (no ContradictionEvidence in this slice)
  - plan may carry `sideBTriggerMessageId` as non-schema inspectable metadata only
- Never update/backfill existing nodes
- Never create ModelUpdate
- Never invoke legacy materialisation

## Success result

- `writeExecuted: true`
- `contradictionNodeId`
- both span IDs
- `sideASpanOutcome` / `sideBSpanOutcome` (`created` | `reused`)
- `contradictionDeduplicationProven: false`

## Partial-state prevention

Any failure aborts the transaction. No success result is returned before completion.
Database CHECKs remain a final safety layer, not a substitute for application validation.
