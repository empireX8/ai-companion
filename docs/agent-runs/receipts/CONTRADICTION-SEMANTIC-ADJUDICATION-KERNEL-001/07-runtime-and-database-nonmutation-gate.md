# 07 — Runtime and database non-mutation gate

## Structural proof (automated)

`lib/__tests__/contradiction-adjudication-contract.test.ts` asserts:

- `app/api/message/route.ts` still calls `detectContradictions` / `materializeContradictions`
- Message route, `lib/import-chatgpt.ts`, `lib/contradiction-materialization.ts`, `lib/contradiction-detection.ts` do **not** import:
  - `contradiction-adjudicator`
  - `orvek-intelligence-kernel`
  - `adjudicateContradiction`
- Adjudicator / kernel modules do not import `@prisma/client` or `prismadb`

## Account gate (read-only)

Script: `readonly-account-gate.mjs`

Required unchanged values:

| Metric | Expected |
|--------|----------|
| Pending candidates | 53 |
| Pending ReferenceItems | 28 |
| Pending ContradictionNodes | 25 |
| Open genuine ContradictionNodes | 0 |
| PatternClaims | 7 |
| ModelUpdates | 1 |
| UnderstandingEvidenceLinks | 50 |
| chicken-burger ReferenceItem | active |

See `account-gate-before.json` and `account-gate-after.json`.

## Explicit confirmations

- Live detector unchanged
- Live message route unchanged
- Import path unchanged
- Materialisation path unchanged
- Schema unchanged
- Migration absent
- No candidate created
- Existing 25 unchanged
- No decision POST
- Kay DB not mutated
- Referee interface exists; shared AI referee **not** implemented
- Production readiness **NO**
