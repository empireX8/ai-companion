# 04 — Provider and budget result

## Resolved provider / models

| Role | Provider | Model |
|------|----------|-------|
| Adjudicator | `openai` | `gpt-4o-mini` |
| Referee | `openai` | `gpt-4o-mini` |

Independence level: `separate_call_same_provider_same_model` (separate runner instances).

## Locked execution options

| Option | Value |
|--------|-------|
| Prompt addendum version | `contradiction-live-adjudicator-prompt-addendum-v2` |
| maxRetries | `0` |
| timeoutMs | `45000` |
| maxTotalCalls | `8` |
| providerAttemptCountExact | `true` |

## Provider attempts this slice

| Metric | Count |
|--------|-------|
| Adjudicator attempts | **3** |
| Referee attempts | **0** |
| Total attempts | **3** |
| Cap | **8** |
| Budget remaining | **5** |

## Landed executable classification hint

`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`

## CEQR-015 slice classification

`HOLD_LIVE_EVIDENCE_FAILURE_PERSISTS`

(`fabricated_quote` and `source_id_mismatch` recurred under v2.)
