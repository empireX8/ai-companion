# 10 — CEQR-013 v1 vs CEQR-015 v2 comparison

## Addendum transition

| Slice | Addendum |
|-------|----------|
| CEQR-013 | `contradiction-live-adjudicator-prompt-addendum-v1` |
| CEQR-015 | `contradiction-live-adjudicator-prompt-addendum-v2` |

## Shared locked configuration

Both runs used: OpenAI / `gpt-4o-mini` + `gpt-4o-mini`, `maxRetries=0`,
`timeoutMs=45000`, cap `8`, synthetic harness, injected in-memory tx only.

## Provider attempts

| Metric | CEQR-013 (v1) | CEQR-015 (v2) |
|--------|---------------|---------------|
| Adjudicator | 3 | 3 |
| Referee | 0 | 0 |
| Total | 3 / 8 | 3 / 8 |

## Per-case earliest gate + codes

| Case | CEQR-013 (v1) | CEQR-015 (v2) |
|------|---------------|---------------|
| `clear_contradiction_candidate` | `deterministic_validation`: `fabricated_quote`, `clear_contradiction_requires_valid_spans`, `validation_failed` | **same codes** |
| `compatible_contextual` | `deterministic_validation`: `fabricated_quote`, `validation_failed` | **same codes** |
| `ambiguous_insufficient` | `deterministic_validation`: `source_id_mismatch`, `validation_failed` | **same codes** |

## Repair-effect answer

| Question | Answer |
|----------|--------|
| Did `fabricated_quote` stop recurring? | **NO** |
| Did `source_id_mismatch` stop recurring? | **NO** |
| Did v2 demonstrate valid exact evidence authority? | **NO** |
| Did clear case reach Class A / referee? | **NO** |

## Interpretation boundary

This single controlled rerun shows the CEQR-014 prompt-only v2 repair did
**not** clear the exact CEQR-013 evidence-authority failure classes under the
locked live configuration. It does not authorise a second live run, and it does
not by itself select the next repair mechanism.
