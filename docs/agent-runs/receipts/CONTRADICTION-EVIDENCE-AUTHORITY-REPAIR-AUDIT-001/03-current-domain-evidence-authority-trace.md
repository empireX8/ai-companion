# 03 — Domain evidence authority trace

## Flow (CEQR-016)
1. `modelRunner.runStructured` with transport schema (offsets only)
2. Raw provider object retained unmodified
3. `parseContradictionModelTransportResult`
4. `bindDualSideEvidenceClaims` — code owns `sourceId`, derives `exactQuote`
5. `validateDualSideEvidenceClaims` — fail-closed defensive validation
6. Semantic consistency gates
7. Objectivity Referee (Class A only) receives bound domain semantic
8. Persistence consumers read bound `ExactEvidenceClaim` only

## Domain type unchanged
`ExactEvidenceClaim = { sourceId, exactQuote, startOffset, endOffset }` remains the domain shape for validated semantic, lineage, and persistence.
