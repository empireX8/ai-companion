# 04 — Confidence-band and candidate-floor contract

**Policy version:** `contradiction-confidence-policy-v1`

## Effective score selection

| Referee outcome | Effective score | Source label |
| --------------- | --------------- | ------------ |
| `PASS` with no adjustment | model-reported | `model_reported` |
| `PASS` with optional strictly lower adjustment | adjusted | `referee_adjusted_optional` |
| `PASS` with equal adjustment | **fail closed** (`optional_pass_adjustment_not_strictly_lower`) | — |
| `PASS` with higher adjustment | **fail closed** (`optional_pass_adjustment_increase_forbidden`) | — |
| `PASS_WITH_LOWER_CONFIDENCE` with valid strictly lower adjustment | adjusted | `referee_adjusted_required` |
| Blocking outcomes / invalid states | **fail closed** — no recommendation | — |

Original model-reported score remains inspectable on every success result.

Accidental increases are impossible under this policy.

## Storage-band recommendation

Maps `effectiveConfidence ∈ [0,1]` to enum-compatible strings:

| Band | Interval | Inclusive bounds |
| ---- | -------- | ---------------- |
| `high` | `[0.80, 1.00]` | `>= 0.80` |
| `medium` | `[0.50, 0.80)` | `>= 0.50` and `< 0.80` |
| `low` | `[0.00, 0.50)` | `>= 0.00` and `< 0.50` |

Constants:

- `CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN = 0.8`
- `CONTRADICTION_CONFIDENCE_BAND_MEDIUM_MIN = 0.5`

## Candidate floor

- `CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR = 0.5`
- `meetsCandidateFloor <=> effectiveConfidence >= 0.5`

### Below-floor decision (explicit)

A valid score **below** the candidate floor is a **successful evaluation** that is **not** continuation-ready:

- `ok: true` (policy successfully evaluated valid inputs)
- `meetsCandidateFloor: false`
- `continuationReady: false` (gates passed but floor not met)
- `recommendedStorageConfidence: "low"` (when effective &lt; 0.5)
- inspectable storage-band recommendation retained
- `persistable: false` / `persistenceAuthorised: false`
- warning prefix `below_candidate_floor:`

It is **not** fail-closed / malformed. Fail-closed is reserved for invalid / blocked inputs.

Output semantics:

- `ok` = successful evaluation of valid inputs
- `meetsCandidateFloor` = effective score ≥ candidate floor
- `continuationReady` = all semantic/referee/confidence gates passed **and** floor met
- persistence markers remain false always

Later persistence gates (future slices) may refuse candidate creation when `meetsCandidateFloor` / `continuationReady` is false. CEQR-006 does not create candidates.

## Boundary tests required

For every threshold (`0.50`, `0.80`):

- immediately below
- exactly equal
- immediately above

Documented in focused tests.
