# 05 — Evidence-span boundary contract

## Preserved

`exactQuote = authoritativeSourceText.slice(startOffset, endOffset)`

Offsets remain **UTF-16 code-unit indices** (compatible with `String.slice`).

## Gate

`lexical_boundary_integrity` in
`lib/orvek-intelligence-kernel/evidence-validation.ts`

### Unicode code-point strategy

- Resolve the **complete Unicode code point** immediately before and after each
  boundary (not individual UTF-16 code units).
- Word-token code points: `\p{L}` | `\p{N}` | `\p{M}` (letters, numbers,
  combining marks), including **astral-plane** characters.

### Surrogate-pair handling

If `startOffset` or `endOffset` falls **between** a high and low surrogate,
fail closed with `lexical_boundary_integrity` (must not split an astral code
point).

### Combining-mark policy (narrow, deliberate)

Combining marks remain attached to the adjacent base token:

- boundary between base (`\p{L}`|`\p{N}`) and mark (`\p{M}`) → **fail**
- boundary inside a combining-mark sequence (`\p{M}`–`\p{M}`) → **fail**
- boundary between a mark and a following word-token code point → **fail**
- full decomposed word spans (e.g. NFD `café`) at source/token edges → **pass**

### Accepts

- source start / source end
- boundaries at whitespace or punctuation
- whole-token spans (BMP and astral)

### Still rejected by existing gates

empty, reversed, fractional, negative, out-of-range offsets

### Explicitly not claimed

Complete semantic / propositional adequacy.
**Lexical boundary integrity ≠ full evidence sufficiency.**

Mid-word truncation, surrogate-pair splitting, and the documented
combining-mark boundary cases are blocked. This is not full UAX #29 grapheme
segmentation or complete semantic adequacy.

### CEQR-017 observation

Offsets ending inside `"morning"` (`0–27` → `"…morni"`) still fail
`lexical_boundary_integrity`.

### Forbidden repairs

No clamping, fuzzy matching, substring search, or full-source fallback.
Raw provider selections remain immutable.
