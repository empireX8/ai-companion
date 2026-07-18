# 03 — Review action contract

## Endpoint

`POST /api/import-review/candidates/[key]/decide`
Body: `{ "decision": "accept" | "reject" }`
Key: URL-encoded `reference_item:<id>` or `contradiction_node:<id>`

Implementation: `lib/import-candidate-review-actions.ts` → `decideImportCandidate`

## Reject

| Requirement | Behaviour |
|-------------|-----------|
| Preserve candidate record | Yes — status update only |
| Persist rejected status | `ReferenceItem` → `dismissed`; `ContradictionNode` → `archived_tension` |
| Review timestamp | `updatedAt` / `lastTouchedAt` via Prisma update |
| Preserve provenance | Source session/message FKs untouched |
| No evidence/source deletes | No delete calls |
| Leave pending queue | Status ≠ `candidate` → excluded from query |
| Idempotent | Re-reject of already rejected → success, `idempotent: true` |

## Accept

| Requirement | Behaviour |
|-------------|-----------|
| Transactional | `db.$transaction` |
| Persist accepted status | `ReferenceItem` → `active`; `ContradictionNode` → `open` |
| Idempotent | Already active/open → `alreadyMaterialised: true`, no duplicate MU |
| Duplicate materialisation | Detected via status + existing ModelUpdate lookup |
| Fail safely | Thrown errors roll back transaction (no partial model commit) |

## UI

`ImportOverlay` persists each Accept/Reject immediately on production/live (not local-only state). Reference fixture routes keep local-only behaviour.
