# 09 — Failure and abstention results (corrected)

## Corrected live run

All three synthetic cases failed closed with `adjudication_failed` after the
provider returned structured output that did not satisfy landed evidence /
consistency gates.

| Case | Status | Write | Referee |
|---|---|---|---|
| clear_contradiction_candidate | failed_safely | no | 0 |
| compatible_contextual | failed_safely | no | 0 |
| ambiguous_insufficient | failed_safely | no | 0 |

No unsafe harness mutation. No account mutation.

## Classification

`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`

## Deterministic coverage retained / added

- Evidence fail-closed (wrong sourceIds, fabricated quote, bad offsets, blank qualifications) before referee/writer
- PASS eligibility matrix (PASS / HOLD / FAIL_UNSAFE)
- maxRetries locked to 0; native timeout applied to both roles
- Exception receipts use budget deltas (not hard-coded zeros)
