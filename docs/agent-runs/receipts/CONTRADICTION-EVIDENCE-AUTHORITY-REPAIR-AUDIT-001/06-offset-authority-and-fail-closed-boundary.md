# 06 — Offset authority and fail-closed boundary

## Model-owned
`startOffset`, `endOffset` (span selection)

## Fail-closed rules (binding)
- must be integers
- `startOffset >= 0`
- `endOffset > startOffset`
- `endOffset <= sourceText.length`
- no clamping
- no fuzzy matching
- no substring search repair
- no full-source fallback
- no provider-output rewriting
