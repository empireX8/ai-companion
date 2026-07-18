# 05 — Provenance and idempotency

## Provenance retained on accept/reject

- Import batch identity (UEL `import_record` when sole/completed upload resolvable)
- Conversation id (`sourceSessionId`)
- Message / span ids
- Candidate id (same row; status change only)
- Review decision + timestamp (`updatedAt` / result `reviewedAt`)
- Confidence unchanged
- Inference/status fields preserved except intentional lifecycle status

## Idempotency matrix

| Prior state | Decision | Result |
|-------------|----------|--------|
| `candidate` | accept | materialise once |
| `active` / `open` | accept | `idempotent` + `alreadyMaterialised`; no second MU |
| `candidate` | reject | status → dismissed / archived_tension |
| already rejected | reject | `idempotent`; record preserved |

## Duplicate existing materialisation

If lineage already points at an open/active durable row, accept returns `alreadyMaterialised: true` without creating a second ModelUpdate for that affected object id.
