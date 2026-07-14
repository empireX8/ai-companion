# 06 — Fixture lifecycle and cleanup

## Marker scope

- Prefix: `dev-durable-actions-assault`
- Marker note: `devFixture:durable-actions-assault` on conclusions
- Safety gate: `assessLiveEvidenceDepthFixtureSafety` (same family as movement/evidence-depth fixtures)

## Records created per seed

| Record | ID / key |
|---|---|
| UserMapConclusion | `dev-durable-actions-assault-conclusion` |
| PatternClaim | `dev-durable-actions-assault-claim` |
| PatternClaimEvidence | `dev-durable-actions-assault-claim-evidence-{0,1,2}` |
| SurfacedAction | dynamic `id`, surfaceKey `stabilize:s6:claim:dev-durable-actions-assault-claim` |
| FieldworkAssignment | `dev-durable-actions-assault-fieldwork` |

## Cleanup

- `cleanupDurableActionsAssaultRuntimeFixture({ userId, db })` deletes by marker IDs and user-scoped patterns.
- Unit test (`lib/__tests__/durable-actions-runtime-fixture.test.ts`): **PASS** — remaining counts 0/0/0 after cleanup.
- Playwright cleanup test: **PASS** in final serial suite.

## Exact fixture deletion counts (final serial run)

```
deletedConclusions=1 deletedActions=1 deletedFieldwork=1
remainingConclusions=0 remainingActions=0 remainingFieldwork=0
```

Suite `afterAll` also runs cleanup after ephemeral Clerk user teardown. Remaining fixture counts: **zero**.
