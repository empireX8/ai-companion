# 01 — Corrected live failure reconstruction

Source authority: CEQR-011 corrected receipts only.

## Per-case (all three synthetic cases)

| Question | Finding |
|---|---|
| Provider execution | Transport success inferred (not `model_failed`) |
| Structured output returned | Yes → selection `adjudication_failed` |
| Schema parse result | Unknown — not retained |
| Exact deterministic validation errors | **Not retained** |
| Exact failure class | **Unknown** |
| Sanitized provider output available | **No** |
| Earliest gate | Selection / adjudication validation; referee 0; no write |

## Explicit insufficiency

Current CEQR-011 corrected receipts do not retain enough sanitized detail to
name the exact deterministic validation error per case. Missing provider output
is not invented.

Inference from removed mutation classes is **not** treated as the live cause.
