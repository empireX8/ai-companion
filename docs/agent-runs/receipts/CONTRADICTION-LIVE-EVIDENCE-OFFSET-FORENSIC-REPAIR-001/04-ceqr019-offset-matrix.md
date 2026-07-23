# 04 — CEQR-019 offset matrix

Full deterministic probe table: `ascii-offset-matrix.json` (75 probes).

## Patterns that pass (validator exclusive-end correct)

- Complete source including final punctuation
- Complete sentence excluding final punctuation (end after last letter, before `.`)
- Exact end of final complete word
- One character after final word (includes punctuation / source edge)

## Patterns that fail with `lexical_boundary_integrity` mid-word truncation

- `endOffset = length - 2` (cuts final letter)
- One character inside final word
- Historical CEQR-017-style truncations:
  - `"I drink coffee in the morning."` → `0–27` → `"…morni"`
  - `"I drank several beers last night."` → `0–30` → `"…nig"`
  - `"Sometimes I think about exercise."` → `0–30` → `"…exerci"`

## Range / shape failures (`invalid_offsets`)

- Zero-length, reversed, negative, out-of-range

## Inference (not fact about CEQR-019 raw numbers)

The repeated CEQR-019 error text matches mid-word endOffset rejection. CEQR-017
retained analogous truncations. Exact CEQR-019 offsets remain UNKNOWN.
