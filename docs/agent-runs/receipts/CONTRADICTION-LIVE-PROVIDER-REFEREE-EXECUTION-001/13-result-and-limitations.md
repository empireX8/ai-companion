# 13 — Result and limitations (corrected)

## Classification

`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`

## Why not PASS

After removing adjudicator evidence-output mutation:

- OpenAI returned structured objects that failed the landed contradiction
  validation gates (`adjudication_failed`) on the clear-candidate case;
- referee was never reached for Case A;
- no harness write occurred;
- strict compatible-case no-write predicate also failed (validation failure,
  not clean `no_semantic_match`).

This is the authorised honest outcome. Evidence repair is forbidden.

## Corrections applied vs superseded run

| Item | Corrected state |
|---|---|
| Evidence output mutation | **none** (`evidenceOutputMutated: false`) |
| maxRetries | **0** on both roles |
| Native timeout | **45000** ms via AI SDK `timeout` |
| Provider-attempt accounting | exact (retries disabled) |
| PASS predicate | requires clear write **and** strict compatible no-write |
| Unsafe mutation | false |

## Still true

- Active slice is not the whole project
- Message / import paths remain unwired
- Existing 25 rows remain untouched
- Actual isolated-database persistence remains unproven
- Production readiness is **NO**
- Independence remains `separate_call_same_provider_same_model`
