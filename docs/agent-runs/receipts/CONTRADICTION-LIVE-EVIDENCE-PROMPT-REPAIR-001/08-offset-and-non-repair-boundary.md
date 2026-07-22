# 08 — Offset and non-repair boundary

## Offsets

CEQR-013 live evidence did not contain `invalid_offsets`.

Existing contract is restated only:

- zero-based
- start inclusive
- end exclusive
- `sourceText.slice(startOffset, endOffset) === exactQuote`

## Explicitly not added

- `appendLiveSourceLengthMetadata`
- `sourceTextLengthChars`
- Any new offset system
- Speculative source-length metadata

Source-length metadata added: **NO**

## Non-repair

No post-generation:

- quote replacement
- sourceId replacement
- offset realignment
- substring search repair
- fuzzy matching
- normalized-proposition substitution
- full-source fallback after provider output
