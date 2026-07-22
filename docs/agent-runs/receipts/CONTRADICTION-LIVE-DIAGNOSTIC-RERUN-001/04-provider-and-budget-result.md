# 04 — Provider and budget result

## Provider / models

| Role | Provider | Model |
|------|----------|-------|
| Adjudicator | `openai` | `gpt-4o-mini` |
| Referee | `openai` | `gpt-4o-mini` |

Independence level: `separate_call_same_provider_same_model` (separate runner instances).

## Locked execution options

| Option | Value |
|--------|-------|
| Prompt addendum version | `contradiction-live-adjudicator-prompt-addendum-v1` |
| maxRetries | `0` |
| timeoutMs | `45000` |
| maxTotalCalls | `8` |
| providerAttemptCountExact | `true` |

## Provider attempts

| Metric | Count |
|--------|-------|
| Adjudicator attempts | **3** |
| Referee attempts | **0** |
| Total attempts | **3** |
| Budget remaining | 5 |

## Overall proof classification hint (landed executable)

`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`

## CEQR-013 slice classification

`PASS_LIVE_DIAGNOSTIC_ROOT_CAUSE_OBTAINED`

(Exact earliest gates + validation codes captured; no unsafe mutation.)
