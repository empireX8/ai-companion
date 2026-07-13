# Executive Result for Kay — Desktop Movement Report Assault 001

## Campaign verdict — **PASS WITH RISKS** (after blocking repair + test-only TS closeout)

The first implementation **failed independent verification** because Today production clobbered depth-enriched ModelUpdate objects. A narrow blocking repair preserved depth through attention registration, enforced after-state honesty, wired normal-publish rationale, and required rationale for `reportReady`.

Independent re-verification after that repair returned **PASS WITH RISKS**: all six product blockers confirmed repaired. The **only blocking finding** was an assault-introduced TypeScript test-mock error (`model-update-candidate-publish-helper.test.ts` TS2345). That mock typing is now repaired; **no product logic changed**.

One shared movement/report implementation advances **Today, Timeline, Inspector, and report overlay** when stored snapshots + rationale exist. Immutable before/after are stored and resolved for representative updates; rationale is distinct and durable; report identity is the published **ModelUpdate id** — not `rep-weekly`.

---

## Checkpoint summary

| # | Checkpoint | Result |
|---:|---|---|
| 0 | Baseline and contract inventory | **PASS** |
| 1 | Canonical movement contract | **PASS** |
| 2 | Storage and materialization | **PASS** |
| 3 | Runtime provenance proof | **PASS WITH RISKS** |
| 4 | Surface integration | **PASS WITH RISKS** |
| 5 | Authenticated runtime proof | **PASS WITH RISKS** |
| 6 | Regression and parity recount | **PASS WITH RISKS** |
| 7 | Blocking repair after verifier FAIL | **PASS WITH RISKS** |
| 8 | Final test-only TypeScript closeout | **PASS** |

---

## Contract answers

| Question | Answer |
|---|---|
| Immutable before/after stored/resolved? | **YES** — `beforeSummary` / `afterSummary` on `ModelUpdate`; materialized at create/publish |
| Evidence + rationale distinct/durable? | **YES** — `UnderstandingEvidenceLink` + `movementRationale::` in `internalNotes`; normal publish resolves stored surfacing rationale |
| `reportReady` requires rationale? | **YES** (after repair) — missing rationale blocks full-report command |
| One real report identity across surfaces? | **YES** (Today production path verified) — `modelUpdateId` via depth API + honesty |
| Zip/reference substitution? | **BLOCKED** when live depth/report not ready |

---

## Representative runtime IDs

| Family | ID |
|---|---|
| Pattern/claim update | `cmrjlk2hc0000qlb018i21fpl` |
| Conclusion update | `dev-movement-report-assault-conclusion-update` |
| Sparse update | `dev-movement-report-assault-sparse` |
| User | `user_34TUYA53pI1QRLK73O22Kve1a1G` |

**Endpoints:** `/api/today/movement-depth`, `/api/what-changed/{id}`, `/api/what-changed/{id}/evidence`

---

## Files changed (product / schema / tests)

**Schema/migration:** none

**New modules:** `lib/model-movement-report-contract.ts`, `lib/model-movement-snapshot.ts`, `lib/model-movement-rationale.ts`, `lib/today-movement-depth.ts`, `lib/model-movement-runtime-fixture.ts`, `app/api/today/movement-depth/route.ts`, `scripts/run-movement-assault-runtime-proof.ts`

**Publish/materialization:** `lib/model-update-candidate-publish-helper.ts`, `lib/candidate-publish-helper.ts`, `lib/understanding-dark-engine/model-update-candidate-persistence.ts`

**Surfaces:** `lib/orvek-adapters/today.ts`, `lib/orvek-adapters/timeline.ts`, `lib/orvek-v0/production/today-api.ts`, `lib/orvek-v0/production/timeline-api.ts`, `lib/orvek-v0/production/today-movement-report-parity.ts`, `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`, `components/orvek-v0/overlays.tsx`, `lib/what-changed-reality-report.ts`, `lib/orvek-v0/orvek-types.ts`

**Tests:** `lib/__tests__/model-movement-report-contract.test.ts`, `lib/__tests__/today-movement-depth-route.test.ts`, `lib/__tests__/today-production-movement-depth.test.ts`, `lib/__tests__/model-movement-rationale-encoding.test.ts`, updates to adapter/workbench/publish tests

**Receipts:** `docs/agent-runs/receipts/DESKTOP-MOVEMENT-REPORT-ASSAULT-001/*` (incl. `07-blocking-repair-after-verifier-fail.md`)

---

## Parity totals (updated estimate)

| Denominator | Before assault | After assault |
|---|---|---|
| 45-state wholly LIVE | 0 | 0 |
| Movement/report-related PARTIAL | ~6 blocked/FALLBACK | **~6 PARTIAL+** (conditional on stored snapshots) |
| Inspector 35-unit PASS | 0 | 0 |
| Inspector PARTIAL | 30 | **30+** (stronger evidence on model-update + timeline movement) |

---

## Shared-capability method

**Validated for Today production path** after blocking repair — `today-production-movement-depth.test.ts` exercises real `buildTodayProductionDataApi` → attention registration → honesty.

Browser/runtime replay and reference zip subtypes remain partial.

---

## Remaining blockers

1. Browser-level authenticated HTTP replay for depth + report overlay (not recorded)
2. Report overlay live-vs-fallback labelling still partial
3. Reference report subtypes (`rep-weekly`, etc.) still reference-only
4. Seven pre-existing Vitest failures on staging baseline (unchanged; no new failures from this assault)
5. Durable corrections/outcomes/check-ins still deferred (Inspector PASS gate)
6. Investigation enrichment FAIL unchanged

---

## Commit status

**Nothing committed. Nothing pushed. No PR opened.**

Fixture data **retained** in local Postgres from runtime proof script.
