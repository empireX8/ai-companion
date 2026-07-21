# 05 — Referee outcome matrix

**Policy version:** `contradiction-confidence-policy-v1`

| Referee execution state | Outcome | Confidence recommendation | Code / notes |
| ----------------------- | ------- | ------------------------: | ------------ |
| `not_run` | — | **Blocked** | `referee_not_run` |
| `failed` | — | **Blocked** | `referee_failed` |
| `invalid_evaluation` | — | **Blocked** | `referee_invalid_evaluation` |
| `completed` | `PASS` | Continue; effective = model or optional strictly-lower adjustment | Never promotes; never increases |
| `completed` | `PASS_WITH_LOWER_CONFIDENCE` | Continue; effective = required strictly-lower adjustment | Model score inspectable |
| `completed` | `ROUTE_TO_DIFFERENT_OBJECT_TYPE` | **Blocked** | `referee_continuation_blocked` |
| `completed` | `REQUEST_MORE_EVIDENCE` | **Blocked** | `referee_continuation_blocked` |
| `completed` | `ABSTAIN` | **Blocked** | `referee_continuation_blocked` |
| other / missing outcome | — | **Blocked** | `referee_outcome_unsupported` |
| `completed` + `continuationAllowed: false` | any | **Blocked** | `referee_continuation_blocked` |
| `completed` + validation errors | any | **Blocked** | `referee_invalid_evaluation` |

## Persistence note

Continuation-ready confidence recommendations still set:

- `persistable: false`
- `persistenceAuthorised: false`

Referee PASS does **not** mean high confidence and does **not** authorise persistence.
