# 10 — Tests and validation (corrected)

## Focused suites

| File | Result |
|---|---|
| contradiction-live-provider-referee-execution.test.ts | 45 passed |
| ai-sdk-structured-model-runner-options.test.ts | 3 passed |
| **Total focused** | **48 passed** |

Includes evidence fail-closed cases, PASS eligibility matrix, maxRetries=0 /
native timeout wiring, and no-mutation wrapper proof.

## Related suites

8 files / **267 passed** (includes focused + CEQR-010 + adjudicator/referee/
lineage/persistence/source).

## Live

Single opt-in run after correction → `HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`
(see `08-live-execution-results.md`). Prior PASS receipt superseded.

## Account gate

Before/after identical: 25 / 25 / 5941 / lineage unchanged.

## Full suite / build

See `validation-summary.json` after final run.
