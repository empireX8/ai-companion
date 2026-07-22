# 15 — Account gate after

## Status

**EXECUTED — matched expected aggregates; unchanged vs before**

Canonical artifact: `account-gate-after.json` (retained; not rewritten in this
finalisation).

| Field | Value |
|-------|-------|
| label | after |
| queriedAt | 2026-07-22T19:01:37.640Z |
| matchesExpected | true |
| mutationsPerformed | false |
| decisionPostCalled | false |
| writerInvokedAgainstAccount | false |
| confirmDismissCalled | false |
| liveProofWroteToAccount | false |
| userId (receipt) | [REDACTED_ACCOUNT_ID] |

## Observed aggregates (unchanged)

| Aggregate | Value |
|-----------|-------|
| contradictionNodeTotal | 25 |
| candidateTotal | 25 |
| evidenceSpans | 5941 |
| complete_exact_dual_side | 0 |
| invalid_partial | 0 |
| legacy_incomplete | 25 |
| completePairDuplicateGroups | 0 |

Orchestration receipt flags:

- afterAccountGateExecuted: true
- afterAccountGateMatched: true
- accountAggregatesUnchanged: true
- accountGateError: null

**No additional real-account query was performed during post-live finalisation.**
