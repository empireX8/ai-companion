# 11 — Real account nonmutation

Read-only gate script: `readonly-account-gate.mjs`

```
node .../readonly-account-gate.mjs --label controlled-natural-entry-proof-before
node .../readonly-account-gate.mjs --label controlled-natural-entry-proof-after
```

| Metric | Before | After |
| --- | --- | --- |
| contradictionNodeTotal | 25 | 25 |
| candidateTotal | 25 | 25 |
| evidenceSpans | 5941 | 5941 |
| complete_exact_dual_side | 0 | 0 |
| legacy_incomplete | 25 | 25 |
| matchesExpected | true | true |

No writes. Existing 25 IDs / null span FKs unchanged. Proof harness never used Kay user id.
