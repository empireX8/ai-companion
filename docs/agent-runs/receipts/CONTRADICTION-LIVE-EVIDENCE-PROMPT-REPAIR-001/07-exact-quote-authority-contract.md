# 07 — Exact quote authority contract

Live addendum v2 states:

- `exactQuote` must be copied character-for-character from the corresponding
  side's decoded `sourceText`
- Never paraphrase, normalize, summarize, correct grammar, or reconstruct text
- Preserve punctuation, capitalization, spacing, and contractions
- `exactQuote` must be a contiguous substring of the decoded `sourceText`
- Side A/B `sourceText` appears as JSON in the user prompt; copy decoded content
  only — do not copy JSON delimiter quotation marks
- Do not invent wording that appears only in `normalizedProposition` or
  `rationale`
- When the entire source unit supports the proposition, the safest valid quote
  is the entire `sourceText` copied exactly

Deterministic validation remains fail-closed on `fabricated_quote`.

Validation weakened: **NO**
