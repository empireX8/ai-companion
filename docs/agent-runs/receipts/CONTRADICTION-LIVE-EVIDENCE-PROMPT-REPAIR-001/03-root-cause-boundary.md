# 03 — Root cause boundary

## Fact (from CEQR-013)

Live provider returned structured objects that failed exact evidence authority at
deterministic validation:

- fabricated `exactQuote` (`fabricated_quote`)
- mismatched `sourceId` (`source_id_mismatch`)

## Inference (repair target)

The prior live evidence addendum (v1) stated sourceId/exactQuote requirements
weakly relative to the user-prompt surface, which also exposes `messageId`,
`sessionId`, and JSON-delimited `sourceText`.

CEQR-014 therefore strengthens **pre-generation** instructions distinguishing:

- `sourceId` vs `messageId` / `sessionId` / reference IDs
- exact character copy vs paraphrase / reconstruction
- decoded `sourceText` content vs JSON delimiter quotation marks
- ordered Side A / Side B source IDs

## Out of boundary

- Post-generation quote/sourceId repair
- Offset system redesign / source-length metadata
- Generic kernel prompt version change (not required by audit)
- Live rerun (deferred to a later slice)
