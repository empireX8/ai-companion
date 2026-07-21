# 06 — Fail-closed cases

**Policy version:** `contradiction-confidence-policy-v1`

The module fails closed (no storage-band recommendation; `continuationReady: false`) when:

| Condition | Failure code |
| --------- | ------------ |
| Model confidence missing | `model_confidence_missing` |
| Model confidence non-finite (`NaN`, `±Infinity`) | `model_confidence_non_finite` |
| Model confidence &lt; 0 or &gt; 1 | `model_confidence_out_of_range` |
| Adjudication not `semantic_accepted` | `adjudication_not_semantic_accepted` |
| Deterministic validation not `valid` | `deterministic_validation_invalid` |
| Semantic payload missing | `semantic_payload_missing` |
| Classification not `clear_contradiction` | `classification_not_clear_contradiction` |
| Referee `not_run` | `referee_not_run` |
| Referee `failed` | `referee_failed` |
| Referee `invalid_evaluation` / non-empty validation errors | `referee_invalid_evaluation` |
| Referee validationErrors omitted / null | `referee_validation_errors_missing` |
| Referee validationErrors non-array | `referee_validation_errors_malformed` |
| Referee continuationAllowed omitted / null / undefined | `referee_continuation_evidence_missing` |
| Referee continuationAllowed not true (e.g. false) | `referee_continuation_blocked` |
| Blocking referee outcomes | `referee_continuation_blocked` |
| Unsupported execution state / outcome | `referee_outcome_unsupported` |
| `PASS_WITH_LOWER_CONFIDENCE` lacks adjustment | `pass_with_lower_missing_adjustment` |
| Adjusted confidence malformed | `adjusted_confidence_malformed` |
| Adjusted confidence out of `[0,1]` | `adjusted_confidence_out_of_range` |
| Adjusted confidence not strictly lower (required path) | `adjusted_confidence_not_strictly_lower` |
| Optional PASS adjustment increase | `optional_pass_adjustment_increase_forbidden` |
| Optional PASS adjustment equality | `optional_pass_adjustment_not_strictly_lower` |

## Explicit non-behaviours

- Do **not** silently clamp invalid numbers
- Do **not** silently infer missing confidence
- Do **not** silently reclassify an invalid result
- Do **not** convert a blocked result into a low-confidence recommendation
- Do **not** infer `refereeContinuationAllowed` from a `PASS` outcome
- Do **not** treat omitted referee validationErrors as empty

## Review correction note (CEQR-006)

Successful evaluation (`ok: true`) is distinct from candidate-floor continuation (`continuationReady`).
Below-floor recommendations are inspectable but not continuation-ready.
Validated referee continuation evidence is mandatory; missing referee validation state fails closed.
There is one authoritative public calibration entry point.
Persistence remains blocked. Production readiness remains **NO**.
