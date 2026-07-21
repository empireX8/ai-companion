# 11 — Real account nonmutation (privacy-corrected)

## Gate

`readonly-account-gate.mjs` — read-only.

Requires `CEQR_READONLY_ACCOUNT_USER_ID` for the query filter only.

Receipts write `userId: "[REDACTED_ACCOUNT_ID]"` and never serialize
raw ContradictionNode / EvidenceSpan identity lists.

Flat receipts only:

- `account-gate-before.json`
- `account-gate-after.json`

## Before / after (identical aggregates)

| Metric | Value |
|---|---|
| ContradictionNode total | 25 |
| candidate total | 25 |
| EvidenceSpan total | 5941 |
| complete exact dual-side | 0 |
| invalid partial | 0 |
| legacy incomplete | 25 |
| duplicate complete-pair groups | 0 |
| matchesExpected | true |
| userId in receipt | `[REDACTED_ACCOUNT_ID]` |

Live proof wrote only to the injected in-memory harness. No real account rows
changed.
