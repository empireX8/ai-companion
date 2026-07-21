# 04 — Existing-data duplicate preflight

## Script

`docs/agent-runs/receipts/CONTRADICTION-DUPLICATE-PREVENTION-001/duplicate-preflight.mjs`

## Exact query

```sql
SELECT "userId", "sideASourceSpanId", "sideBSourceSpanId", COUNT(*)
FROM "ContradictionNode"
WHERE "sideASourceSpanId" IS NOT NULL
  AND "sideBSourceSpanId" IS NOT NULL
GROUP BY "userId", "sideASourceSpanId", "sideBSourceSpanId"
HAVING COUNT(*) > 1;
```

## Kay baseline (`user_34TUYA53pI1QRLK73O22Kve1a1G`)

| Metric | Value |
| ------ | ----- |
| total nodes | 25 |
| complete dual-side | 0 |
| invalid partial | 0 |
| legacy incomplete | 25 |
| duplicate groups | **0** |
| migrationSafe | true |

Machine receipt: `duplicate-preflight.json`.

## Decision

Preflight clean → migration permitted. No silent delete/merge/backfill of existing rows.
