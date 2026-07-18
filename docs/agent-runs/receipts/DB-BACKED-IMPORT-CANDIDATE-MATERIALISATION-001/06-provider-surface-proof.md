# 06 — Provider surface proof

## Automated proof (isolated mocks)

`lib/__tests__/import-candidate-review.test.ts` and `import-candidate-review-wiring.test.ts` prove:

- Accept contradiction → status `open` + UEL creates + ModelUpdate create (once)
- Accept reference → status `active` (Map/mind-context destination via existing active-reference list)
- Wiring: hybrid overrides seed; overlay never injects `REFERENCE_IMPORT_CANDIDATES` on live
- Mind-context still reads `status=active` references
- Contradiction surface still treats `open` as eligible

## Production destinations by type

| Accepted type | Primary surfaces |
|---------------|------------------|
| ReferenceItem → active | Mind context / reference list; Map rails when projected |
| ContradictionNode → open | Contradiction surface / Map conflicts when projected |
| ModelUpdate (contradiction) | Timeline / Inspector movement when `user_visible` |

Today appearance is **not** required for acceptance.

## Not claimed

Materialisation is **not** production-proven on Kay’s real candidates until Kay manually accepts one in a later gate.
