# 01 — Shared durable write contract

## Client contract (`lib/durable-user-actions-contract.ts`)

| Function | Route | Success shape | Error shape |
|---|---|---|---|
| `applyUserMapCorrection()` | `PATCH /api/user-map/conclusions/[id]` | `{ ok: true, id, summary, lastUserCorrectionLabel, lastUserCorrectionAt, correctionCount }` | `{ ok: false, status, error }` |
| `submitDecisionOutcome()` | `PATCH /api/actions/[id]` | `{ ok: true, id, status, note, updatedAt }` | `{ ok: false, status, error }` |
| `submitFieldworkCheckIn()` | `PATCH /api/fieldwork/[id]` | `{ ok: true, id, observationNote, status: "active", ... }` | `{ ok: false, status, error }` |

Shared behaviors:

- UI sets saved state only after `ok: true`.
- `refreshAfterDurableWrite()` bumps hybrid revision to refetch production overlays.
- `isDurableWriteError()` gates optimistic display.
- Corrections preserve original `summary`; label stored separately.

## Supporting modules

- `lib/fieldwork-api.ts` — fieldwork PATCH helper
- `lib/orvek-v0/durable-actions-context.tsx` — refresh provider
- `components/orvek-v0/durable-user-action-controls.tsx` — shared UI with `data-testid`s

## Schema changes

**NONE**
