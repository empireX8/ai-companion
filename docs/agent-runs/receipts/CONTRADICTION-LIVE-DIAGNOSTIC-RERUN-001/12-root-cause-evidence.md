# 12 — Root cause evidence

## Actionable exact cause obtained?

**YES** — sufficient for a later targeted correction slice.

## Per-case earliest gate + codes

| Case | Earliest gate | Exact codes |
|------|---------------|-------------|
| `clear_contradiction_candidate` | `deterministic_validation` | `fabricated_quote`, `clear_contradiction_requires_valid_spans`, `validation_failed` |
| `compatible_contextual` | `deterministic_validation` | `fabricated_quote`, `validation_failed` |
| `ambiguous_insufficient` | `deterministic_validation` | `source_id_mismatch`, `validation_failed` |

## Shared pattern

All failures are **exact-evidence authority** failures (result class **A**),
occurring after structured model output and before referee/writer.

## What is now authorised for a later slice

- Evidence-supported prompt and/or adapter guidance repair targeting:
  - exact contiguous quotes / offsets (`fabricated_quote`)
  - exact `sourceId` binding (`source_id_mismatch`)
- Still forbidden without a new slice: provider-output mutation, schema
  relaxation that bypasses evidence gates, retries/temperature changes, or
  another uncontrolled live rerun.

## Sanitized diagnostics sufficiency

| Question | Answer |
|----------|--------|
| Were CEQR-012 diagnostics present on all failed cases? | YES |
| Did they identify earliest gate? | YES (`deterministic_validation`) |
| Did they retain exact validation codes? | YES |
| Side attribution inventing Side A/B? | NO (`unknown`) |
| Raw provider object retained? | NO (correct) |
