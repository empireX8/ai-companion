# Checkpoint 2 — Storage and Materialization

**Result:** **PASS**

**Schema/migration:** **NONE**

---

## Write path changes

| Location | Change |
|---|---|
| `lib/model-movement-snapshot.ts` | **NEW** — resolve affected object state; materialize before/after at publish |
| `lib/model-movement-rationale.ts` | **NEW** — durable rationale encoding in `internalNotes` |
| `lib/model-update-candidate-publish-helper.ts` | Calls `materializePublishedModelUpdateSnapshots` after publish |
| `lib/candidate-publish-helper.ts` | Conclusion publish writes explicit before/after pair |
| `lib/understanding-dark-engine/model-update-candidate-persistence.ts` | Captures `beforeSummary` at candidate create from affected object |

---

## Materialization semantics

1. **Candidate create:** snapshot affected object → `beforeSummary` (immutable intent at create time).
2. **Publish:** fill `afterSummary` from current affected object if absent; optional `movementRationale` encoded durably.
3. **Conclusion added:** deterministic pair via `resolveConclusionAddedSnapshotPair()` — no fake prior read.

---

## Read path (workbench depth)

| Endpoint | Role |
|---|---|
| `GET /api/today/movement-depth` | Authenticated depth for hybrid Today/Timeline (fields: `before`, `after`, `movementRationale`) |
| `GET /api/what-changed/[id]` | Full `RealityTrackingModelMovementReport` (unchanged route; rationale added to packet) |

Public list routes **unchanged** — still exclude `beforeSummary` / `afterSummary` from JSON.

---

## Idempotency / ownership

- Publish helper uses existing conditional `updateMany` guards.
- Snapshot materialization skips fields already recorded unless `force: true` (fixture only).
- All queries scoped by `userId`.

---

## Tests

- `lib/__tests__/phase2t-candidate-publish-helper.test.ts` — conclusion snapshots on publish
- `lib/__tests__/today-movement-depth-route.test.ts` — depth API shape
