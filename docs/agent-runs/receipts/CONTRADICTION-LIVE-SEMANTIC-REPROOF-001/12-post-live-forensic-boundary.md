# 12 — Post-live forensic boundary

## What the live result proves

- OpenAI accepted schema-v3 sufficiently to return structured outputs for all
  three frozen cases.
- Exactly three adjudicator attempts occurred (one per case).
- No automatic retries occurred (`maxRetries = 0`; attempt count exact).
- Every case failed closed at deterministic lexical-boundary validation.
- No referee, writer, persistence, account gate, or real database boundary ran.
- The safety boundary worked correctly: invalid evidence did not reach referee,
  writer, or persistence.
- End-to-end semantic reproof was **not** obtained.
- Production readiness remains **NO**.

## What cannot yet be concluded

The live receipt records validation failure reasons but does **not** preserve
enough failed transport detail to identify, for each case:

- the precise selected offsets;
- which side failed (A, B, or both);
- the raw provider offset selection object.

Therefore this finalisation must **not** claim whether the root cause is:

- provider inclusive-end interpretation;
- one-character-short model counting;
- a validator defect;
- UTF-16 / code-point disagreement;
- another transport mismatch.

The common three-case lexical-boundary failure strongly suggests a systematic
offset-contract problem, but that remains an inference, not proved fact.

## Boundary integrity

- One-shot claim exists and must never be deleted, replaced, or recreated.
- CEQR-019 must not be re-run.
- CEQR-017 and CEQR-018 historical artifacts remain unchanged.
- No clamping, fuzzy matching, silent offset repair, substring fallback, or
  fabricated quotes are authorised as a response to this result.
