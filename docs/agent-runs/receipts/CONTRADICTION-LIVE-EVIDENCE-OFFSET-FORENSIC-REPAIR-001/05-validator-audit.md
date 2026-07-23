# 05 — Validator audit

## Verdict: CORRECT — do not weaken

`validateLexicalBoundaryIntegrity` exclusive-end semantics are correct:

- A boundary after a complete word and before punctuation passes.
- A boundary with both preceding and following alphanumeric word chars fails.
- Source edges (0 / length) pass.
- Surrogate-pair splits fail closed.
- Astral `\p{L}` / `\p{N}` handled via complete code points.
- Combining-mark attachment policy unchanged.

## Does the validator reject any actually valid exclusive end?

For the CEQR-019 ASCII matrix: **no demonstrated false reject** of a valid
exclusive end at a lexical boundary. Valid `length-1` (before `.`) passes.

## Repair

No validator defect repaired. Defence-in-depth retained after boundary-index mapping.
