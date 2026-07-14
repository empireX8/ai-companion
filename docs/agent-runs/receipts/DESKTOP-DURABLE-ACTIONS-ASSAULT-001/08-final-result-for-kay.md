# 08 — Final result for Kay

## Verdict

**FULLY VERIFIED**

---

## Schema changes

**NONE**

---

## Blockers

- Corrections blockers: **NONE**
- Decision outcomes blockers: **NONE**
- Fieldwork/check-in blockers: **NONE**
- Remaining durable-action blockers: **NONE**

---

## Playwright

**5/5 passed** — serial authenticated browser suite (`scripts/durable-actions-assault.playwright.ts`)

| # | Journey | Result |
|---|---|---|
| 1 | Corrections | PASS (~52s) |
| 2 | Decision outcomes | PASS (~40s) |
| 3 | Fieldwork/check-in | PASS (~51s) |
| 4 | Negative proof | PASS (~42s) |
| 5 | Fixture cleanup | PASS |

Closeout evidence re-run (decision + fieldwork + negative only): **3/3 passed**, used to log exact SurfacedAction id and HTTP statuses (prior serial run did not print them).

---

## Exact authentication method

Clerk ephemeral user + session JWT + `createTestingToken()` → cookies `__session`, `__clerk_db_jwt`, `__client_uat` on `http://localhost:3000`. Local Postgres `postgresql://postgres:postgres@localhost:5432/companion`. Gate: `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1`. No production auth bypass. Helpers: `stabilizeAuthenticatedSession` (shell + APIRequest + in-page fetch), `recoverAfterReload`.

---

## Exact runtime parent / action IDs

| Family | Exact identity | Storage contract |
|---|---|---|
| Correction | parent `dev-durable-actions-assault-conclusion` | Mutates that conclusion’s `lastUserCorrection*` fields — **no separate child action ID** |
| Decision | `SurfacedAction.id` = **`cmrl2j3kv0000qloo4k0zisi3`**; surfaceKey `stabilize:s6:claim:dev-durable-actions-assault-claim`; claim `dev-durable-actions-assault-claim` | Mutates that action’s `status` + `note` |
| Fieldwork | parent `dev-durable-actions-assault-fieldwork` | Mutates that assignment’s `observationNote` (status `active`) — **no separate child action ID** |

Correction label: `This is wrong`
Outcome note: `Durable assault outcome: stop point helped after meetings.`
Check-in note: `Durable assault check-in: noticed stop point after 4pm meeting.`

---

## Exact idempotency results

- Decision: repeated PATCH same status+note → `surfacedAction.count({ userId, id: cmrl2j3kv0000qloo4k0zisi3 }) === 1` (pattern: one row for the hydrated action id)
- Fieldwork: repeated PATCH same observation → `fieldworkAssignment.count({ userId, id: dev-durable-actions-assault-fieldwork }) === 1`
- Corrections: single parent conclusion row `dev-durable-actions-assault-conclusion` (fields updated in place)

---

## Exact cross-user and unauthenticated results

Observed on closeout evidence capture (logged from live responses):

| Case | Exact status |
|---|---|
| Unauthenticated conclusion PATCH | **404** |
| Cross-user conclusion PATCH | **404** |
| Cross-user decision PATCH | **404** |
| Cross-user fieldwork PATCH | **404** |
| Missing fieldwork parent PATCH | **404** |
| Malformed conclusion JSON PATCH | **400** |
| Simulated 500 correction write | no recorded chip before/after reload |

---

## Exact Inspector identity assertions

- Corrections: map-scoped `durable-correction-recorded` after reload (Inspector also mounts same controls for the same conclusion id)
- Decisions: `durable-outcome-recorded` for exact title; API hydrates `id=cmrl2j3kv0000qloo4k0zisi3` + outcome note
- Fieldwork: Bridge `durable-checkin-recorded` + Open fieldwork Inspector show same check-in for parent `dev-durable-actions-assault-fieldwork`

---

## Exact fixture deletion / remaining counts

Final serial cleanup test log:

```
deletedConclusions=1 deletedActions=1 deletedFieldwork=1
remainingConclusions=0 remainingActions=0 remainingFieldwork=0
```

Remaining fixture counts: **zero**.

---

## Exact verification command results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| Targeted durable/affected Vitest | PASS (75/75 across 9 files) |
| Playwright durable-actions-assault | PASS **5/5** |
| Closeout evidence capture (3 journeys) | PASS **3/3** |
| `npm run build` | PASS |
| `npm run check:trust` | PASS |
| `npm run check:legacy` | PASS |
| `git diff --check` | PASS |
| `bash scripts/verify-mindlab.sh` | Vitest contains **only** staging @ eb5b0fa Explore/Prisma baseline failures (unchanged); **no new branch failures** |

---

## Complete changed-file list

Working tree at closeout correction (`git status --short`), excluding generated `test-results/`:

### Modified

1. `app/api/user-map/conclusions/[id]/route.ts`
2. `app/api/user-map/conclusions/route.ts`
3. `app/api/watch-for/route.ts`
4. `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
5. `components/orvek-v0/evidence-panel.tsx`
6. `components/orvek-v0/pages/decisions.tsx`
7. `components/orvek-v0/pages/explore.tsx`
8. `components/orvek-v0/pages/map.tsx`
9. `components/orvek-workbench/OrvekWorkbenchShell.tsx`
10. `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
11. `lib/__tests__/active-questions-watch-for-route.test.ts`
12. `lib/__tests__/desktop-hard-swap-regression-sweep.test.ts`
13. `lib/__tests__/free-explore-chat-handler-provider-mount.test.ts`
14. `lib/__tests__/free-explore-chat-send-draft-stream.test.ts`
15. `lib/__tests__/phase3-public-intelligence-safe-slice.test.ts`
16. `lib/__tests__/understanding-engine-phase1b-api.test.ts`
17. `lib/__tests__/your-map-workbench.test.ts`
18. `lib/orvek-adapters/map.ts`
19. `lib/orvek-v0/display-contract.ts`
20. `lib/orvek-v0/orvek-types.ts`
21. `lib/orvek-v0/production/experiment-presentation.ts`
22. `lib/orvek-v0/production/map-api.ts`
23. `lib/orvek-v0/production/map-selection.ts`
24. `lib/public-intelligence-safe-slice.ts`
25. `lib/watch-for.ts`
26. `playwright.config.ts`

### Untracked (new)

27. `components/orvek-v0/durable-user-action-controls.tsx`
28. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/00-intake-and-existing-write-map.md`
29. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/01-shared-durable-write-contract.md`
30. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/02-corrections-production-proof.md`
31. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/03-decision-outcomes-production-proof.md`
32. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/04-fieldwork-checkins-production-proof.md`
33. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/05-authentication-ownership-and-negative-proof.md`
34. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/06-fixture-lifecycle-and-cleanup.md`
35. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/07-verification-and-regressions.md`
36. `docs/agent-runs/receipts/DESKTOP-DURABLE-ACTIONS-ASSAULT-001/08-final-result-for-kay.md`
37. `lib/__tests__/durable-actions-runtime-fixture.test.ts`
38. `lib/__tests__/durable-user-actions-contract.test.ts`
39. `lib/durable-actions-runtime-fixture.ts`
40. `lib/durable-user-actions-contract.ts`
41. `lib/fieldwork-api.ts`
42. `lib/orvek-v0/durable-actions-context.tsx`
43. `scripts/durable-actions-assault.playwright.ts`

---

## Write contracts

| Action | Route | Storage |
|---|---|---|
| Correction | `PATCH /api/user-map/conclusions/[id]` | Mutates parent `UserMapConclusion.lastUserCorrection*` |
| Decision outcome | `PATCH /api/actions/[id]` | Mutates parent `SurfacedAction.status` + `note` (`cmrl2j3kv0000qloo4k0zisi3`) |
| Fieldwork check-in | `PATCH /api/fieldwork/[id]` | Mutates parent `FieldworkAssignment.observationNote` (status `active`) |
