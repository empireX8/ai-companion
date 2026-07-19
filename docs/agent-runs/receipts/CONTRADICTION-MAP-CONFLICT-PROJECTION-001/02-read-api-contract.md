# 02 — Read API contract

**Campaign:** CONTRADICTION-MAP-CONFLICT-PROJECTION-001

## Decision

**Reuse** existing authenticated `GET /api/contradiction?status=open&limit=50&page=1`.

No new Map-only HTTP route was required. The existing route is already:

- Clerk-authenticated
- user-scoped (`where: { userId, status }`)
- filtered to `status=open` when requested (excludes `candidate`)
- read-only (GET; no create/update/delete)
- returns title, sideA, sideB, status, confidence, evidenceCount, lastTouchedAt, optional sessionOrigin

Client mapper: `lib/map-open-contradictions.ts` → `fetchMapOpenContradictions()`.

## Contract guarantees

| Requirement | How |
|-------------|-----|
| Only authenticated user’s records | Prisma `userId` filter |
| Include open | `status=open` query |
| Exclude candidate | status filter |
| Exclude rejected/dismissed | N/A on ContradictionStatus enum (candidate dismiss = delete) |
| Preserve raw id | `item.id` |
| Truthful title/sides/status/confidence | mapped from row fields |
| Evidence count without fabrication | `evidenceCount` from row |
| No write | GET only |

## Not broadened into

General contradiction management, accept/reject, or Inspector detail (already at `/api/inspector/contradictions/[id]`).
