# 04 — Evidence span validation

## Offset semantics

- Zero-based
- Start inclusive
- End exclusive
- Measured against the exact supplied `sourceText` for the claimed `sourceId`

## Claim shape

```ts
{ sourceId, exactQuote, startOffset, endOffset }
```

## Deterministic rejection cases

- Schema parse failure
- Absent/invalid classification
- Confidence outside [0, 1]
- Source ID mismatch
- Invalid offsets
- `exactQuote !== sourceText.slice(start, end)`
- Empty quote
- Side A pointing at Side B source (or vice versa)
- Missing required proposition fields
- `clear_contradiction` without two valid exact spans
- Fabricated quote
- Unsupported proposed object type
- Model execution failure / timeout

**Fail closed.** No deterministic semantic fallback.

Session/message lineage alone is not sufficient evidence.
