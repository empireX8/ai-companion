# 06 — Source ID authority contract

Live addendum v2 states:

- `evidenceClaimA.sourceId` must be copied character-for-character from the
  exact value after `Side A sourceId:`
- `evidenceClaimB.sourceId` must be copied character-for-character from the
  exact value after `Side B sourceId:`
- `sourceId` is not `messageId`
- `sourceId` is not `sessionId`
- `sourceId` is not a ReferenceItem ID or reference-row ID
- Never construct or infer a `sourceId`
- Never swap Side A and Side B source IDs; keep ordered as shown

Deterministic validation remains fail-closed on `source_id_mismatch`
(`lib/orvek-intelligence-kernel/evidence-validation.ts`).

Validation weakened: **NO**
