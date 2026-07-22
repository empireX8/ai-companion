# 07 — Account gate before

## Status

**EXECUTED** — through the sole Phase-2 orchestrator invocation (not a
standalone gate run).

Canonical artifact: `account-gate-before.json` (retained; do not overwrite).

| Field | Value |
|-------|-------|
| queriedAt | 2026-07-22T19:01:20.646Z |
| matchesExpected | true |
| mutationsPerformed | false |
| decisionPostCalled | false |
| writerInvokedAgainstAccount | false |
| confirmDismissCalled | false |
| liveProofWroteToAccount | false |
| userId (receipt) | [REDACTED_ACCOUNT_ID] |

## Observed aggregates

| Aggregate | Value |
|-----------|-------|
| contradictionNodeTotal | 25 |
| candidateTotal | 25 |
| evidenceSpans | 5941 |
| complete_exact_dual_side | 0 |
| invalid_partial | 0 |
| legacy_incomplete | 25 |
| completePairDuplicateGroups | 0 |

## Forbidden after this gate

- Do **not** run `readonly-account-gate.mjs` again.
- Do **not** overwrite `account-gate-before.json`.
- No additional real-account query is authorised for CEQR-017.

## Historical note (forbidden to execute)

The standalone gate executable that once existed for Phase-2 preparation is
**historical only**. Re-running:

```bash
node docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001/readonly-account-gate.mjs --label before
```

is **forbidden**. The sole authorised before-gate query already completed inside
`scripts/run-ceqr017-phase2-orchestrator.ts`.
