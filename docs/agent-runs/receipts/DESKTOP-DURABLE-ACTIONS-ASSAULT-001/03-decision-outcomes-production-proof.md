# 03 — Decision outcomes production proof

## Fixture

- Claim ID: `dev-durable-actions-assault-claim`
- Action surface key: `stabilize:s6:claim:dev-durable-actions-assault-claim`
- Decision title (template s6): `Write the recurring thought down as-is, without trying to resolve it`
- Outcome note: `Durable assault outcome: stop point helped after meetings.`
- Claim evidence: 3 `PatternClaimEvidence` rows with visible repetitive-loop quotes (passes `projectVisiblePatternClaim` — verified in `lib/__tests__/durable-actions-runtime-fixture.test.ts`).
- Action ID: **`cmrl2j3kv0000qloo4k0zisi3`** (logged on closeout evidence capture re-run of the decision journey; PATCH body `id` matched)

## Browser journey (Playwright)

**Result: PASS** (final serial suite, ~40s; evidence-capture re-run also PASS with exact id logged)

Steps proven:

1. Seeded user-owned claim + `SurfacedAction` (`status: done`, `note: null`) via fixture.
2. Authenticated hybrid workbench; page-level auth fetch proven via `stabilizeAuthenticatedSession`.
3. `GET /api/actions` readiness until fixture decision listed.
4. Opened Decisions; selected exact title; `durable-outcome-input` visible.
5. Submitted outcome; PATCH `/api/actions/{id}` returned **200** with matching `id` + `note`.
6. UI showed `durable-outcome-recorded` with outcome note (controls remain after save).
7. `recoverAfterReload` (token refresh + cookie re-inject + sign-in recovery).
8. Same decision reselected; recorded outcome persisted in UI.
9. Production read path: `GET /api/actions` hydrates same `id` + `note` + title.
10. Idempotent PATCH retry → still one `SurfacedAction` row for user+id.
11. Cross-user PATCH → **401/404**; other Clerk user cleaned up.
12. No sample / reference outcome substitution (exact title + note scoped to Decisions page).

## Unit proof

- Fixture seeds stabilize blueprint `stabilize:s6:claim:dev-durable-actions-assault-claim`.
- `submitDecisionOutcome` contract unit tests pass.
