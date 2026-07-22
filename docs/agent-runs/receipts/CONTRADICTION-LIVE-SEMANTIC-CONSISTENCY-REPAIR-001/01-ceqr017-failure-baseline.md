# 01 — CEQR-017 failure baseline

## Clear case (provider output)

- `classification: clear_contradiction`
- `changedBeliefOverTime: true` (provider-supplied; not code-derived)
- Deterministic validator rejected:
  `internal_inconsistency: clear_contradiction cannot coexist with changedBeliefOverTime: true.`
- Prompt + live addendum already prohibited the combination → wording-only
  repair is insufficient.

## Compatible case

- `classification: compatible_states` (correct no-candidate path)
- Side B offsets `0–27` on `"I drink coffee in the morning."` produced
  authoritative slice `"I drink coffee in the morni"`
- Not fabrication (`exactQuote === sourceText.slice(...)`)
- Evidence-span boundary / adequacy weakness (lexical truncation)

## Authority note

CEQR-017 permanent claim and live receipts remain the historical baseline and
must stay byte-unchanged in this slice.
