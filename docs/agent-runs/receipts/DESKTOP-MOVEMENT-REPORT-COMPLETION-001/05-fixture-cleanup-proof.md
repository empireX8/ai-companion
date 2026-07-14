# 05 — Fixture cleanup proof

## Cleanup path

`cleanupMovementAssaultRuntimeFixture` in `lib/model-movement-runtime-fixture.ts`

Guarantees:

- **Local-database guarded** via `movementAssaultFixtureAllowed` / `assessLiveEvidenceDepthFixtureSafety` (local Postgres companion URL; refused for production NODE_ENV / production DB hosts)
- **User-scoped** (`userId` required)
- **Marker / fixture-ID scoped** (`MOVEMENT_ASSAULT_FIXTURE_MARKER`, known sparse/conclusion IDs, `dev-movement-report-assault*` prefix)
- **Idempotent** (safe when no rows remain)
- Incapable of deleting unrelated users’ records

Reusable from unit tests and Playwright `finally` / `afterAll` — no manually pasted temporary script required.

Unit coverage: `lib/__tests__/model-movement-fixture-cleanup.test.ts`

## Final green Playwright cleanup counts (positive journey)

```
deletedModelUpdates=2
deletedLinks=2
remainingModelUpdates=0
remainingLinks=0
```

IDs cleaned: `cmrkkfvdt0000qllgyqwta84s`, `dev-movement-report-assault-conclusion-update`

Sparse journey also asserts `remainingModelUpdates=0` and `remainingLinks=0` after teardown.

Clerk ephemeral user + session revoked/deleted in `afterAll` (best-effort).
