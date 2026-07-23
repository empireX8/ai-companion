# 03 — ASCII index-unit proof

All six CEQR-019 frozen source strings are ASCII.

Measured: UTF-16 length === Unicode code-point length for every side
(`ascii-index-unit-proof.json`, `allEqual: true`).

## Conclusion (FACT)

UTF-16 versus Unicode code-point counting **cannot** explain the three
CEQR-019 failures unless different text reached the validator. For these
frozen ASCII pairs, the index units agree exactly.

Do not use Unicode complexity as a vague explanation for these particular failures.
