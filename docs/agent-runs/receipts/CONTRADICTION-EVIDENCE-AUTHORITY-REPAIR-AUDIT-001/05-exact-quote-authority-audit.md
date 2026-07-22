# 05 — exactQuote authority audit

## Before
Model authored `exactQuote`. Validator required `sourceText.slice(start,end) === exactQuote`, producing `fabricated_quote` on paraphrase/normalization/mismatch.

## After
`exactQuote = sourceText.slice(startOffset, endOffset)` exclusively.

## Result
`fabricated_quote` caused by model-authored quote text is structurally impossible on the adjudication binding path.

Domain `validateExactEvidenceClaim` still rejects mismatched domain claims defensively.
