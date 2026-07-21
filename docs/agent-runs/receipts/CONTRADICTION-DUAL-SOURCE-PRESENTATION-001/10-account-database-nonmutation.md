# 10 — Account database nonmutation

## Gate

`readonly-account-gate.mjs`

```bash
set -a && source /Users/user/ai-companion/.env && set +a
node docs/agent-runs/receipts/CONTRADICTION-DUAL-SOURCE-PRESENTATION-001/readonly-account-gate.mjs --label dual-source-presentation-before
node docs/agent-runs/receipts/CONTRADICTION-DUAL-SOURCE-PRESENTATION-001/readonly-account-gate.mjs --label dual-source-presentation-after
```

## Results

| Label | matchesExpected | nodes | candidates | EvidenceSpans | complete dual | partial | legacy both-null | duplicate complete-pair groups |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | true | 25 | 25 | 5941 | 0 | 0 | 25 | 0 |
| after | true | 25 | 25 | 5941 | 0 | 0 | 25 | 0 |

Before/after `contradictionNodeIdsAndSpanFks` identical.

Artifacts:

- `account-gate-dual-source-presentation-before.json`
- `account-gate-dual-source-presentation-after.json`
