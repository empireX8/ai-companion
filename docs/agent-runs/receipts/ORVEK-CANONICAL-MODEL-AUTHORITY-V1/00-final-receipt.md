# ORVEK-CANONICAL-MODEL-AUTHORITY-V1 — Final Receipt

Status: controlled-rollout candidate (Phase 6 safety-corrected closeout)
Date: 2026-07-29
Branch: `desktop-orvek-canonical-model-authority-v1-001`
Starting commit for Phase 6: `84103c6f1cf01ff6576149931846901eaefc0508`

## Scope

Complete Canonical Model Authority V1 checkpoint:

- controlled rollout matrix
- correction-path honesty (Propose a correction handoff)
- disposable-DB end-to-end fixture
- real browser persistence proofs (hard refresh, route reopen, fresh context)
- real browser `POST /api/message` with correlated AI capture
- real What Changed browser UI (REVISION ONE → REVISION TWO)
- local app restart with creation gate disabled (`PHASE6_MANAGE_SERVER=1`)
- final acceptance with **zero** required skipped stages

Not in scope: mass backfill, merge/retire/dispute ops, revision-3 workflow, redesign, production-wide enablement, UMC write-back, provider selection, security certification.

## Architecture summary

1. `CanonicalConceptRevision` is sole current truth for a registered concept.
2. Revisions are immutable; `CanonicalConcept.currentRevisionId` points at current.
3. Accepted Explore publication creates the next immutable revision via Phase 3B.
4. Bound legacy `UserMapConclusion` never replaces canonical product meaning.
5. Feature gates control **creation** only; publication dispatches from persisted `authorityMode`.
6. Canonical corruption fails closed; product reads are read-only; no bound-UMC fallback.

## Phase 1–6 commit hashes

| Phase | Commit | Message |
|---|---|---|
| 1 schema | `47c71a5` | Add canonical model authority schema foundation |
| 2 runtime | `8974099` | Add canonical model authority runtime primitives |
| 3A creation | `d4254cb` | Add canonical Explore proposal creation |
| 3B publication | `4d0e1cb` | Add canonical Explore proposal publication |
| 4 projection | `33eb887` | Add canonical model read projection |
| 5 product/AI | `84103c6` | Integrate canonical model across product and AI |
| 6 rollout | *(uncommitted Phase 6 corrected working tree)* | controlled rollout + browser proofs + gate-off restart |

## Database / migration inventory

Existing Phase 1 migrations for:

- `CanonicalConcept`
- `CanonicalConceptRevision`
- `CanonicalConceptEvidenceLink`
- `CanonicalConceptSourceBinding`
- `ExploreMovementProposal.authorityMode` + canonical fields
- `ModelUpdate` canonical lineage fields

Phase 6 adds **no** new tables/columns.

Disposable proof DB:

```text
postgresql://user@127.0.0.1:5432/companion_canonical_authority_test
```

## Feature gates (actual names)

- `ORVEK_CANONICAL_MODEL_AUTHORITY_V1` must equal `"1"`
- `ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS` comma allowlist of Clerk user IDs

API: `isCanonicalModelAuthorityEnabledForUser(userId, env?)` in `lib/canonical-model-authority-flag.ts`.

Test-only seams (local disposable DB only):

- `ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1` (+ header `x-orvek-canonical-ai-capture-nonce`)
- `ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1` (after full context assembly; no paid provider)

All three test-only seams (capture, deterministic reply, creation attempt) share a single guard in `lib/canonical-phase6-test-seam-guard.ts`. The guard requires **all** of the following simultaneously:

```text
PHASE6_MANAGE_SERVER=1
ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1
ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1
DATABASE_URL  parses to postgres(ql)://127.0.0.1|localhost:5432/companion_canonical_authority_test
CANONICAL_AUTHORITY_DB_TEST_URL  resolves to the same host, port and database
```

Substring matching is not used. Alternate suffixes, remote hosts, mismatched pairs, and malformed URLs are rejected.

## Creation-gate semantics

- Gate off or user not allowlisted → new proposals are `legacy`
- Gate on + allowlisted → eligible proposals are `canonical_v1` (may register concept)

## Publication `authorityMode` semantics

- Dispatch uses **persisted** proposal `authorityMode` only
- Canonical proposal created, then gate disabled → still publishes to revision 2
- Legacy proposal created, then gate enabled → remains legacy publication

## Visibility after disable

Disabling creation gates:

- stops new canonical creation
- does **not** hide accepted canonical history
- bound UMC remains suppressed for registered concepts

## Correction-control behaviour

Inventory (visible controls):

| Surface | Control | Behaviour after Phase 6 |
|---|---|---|
| Live production Map (`components/orvek-v0-canonical/pages/map.tsx`) | Correct the model | Canonical → `Propose a correction` handoff via workbench **in-memory payload only** (no sessionStorage write); unregistered UMC → durable PATCH; other production → honest unavailable (no in-memory success) |
| Production Inspector (`evidence-panel.tsx`) | Correct the model | Same split: durable UMC / canonical propose / disabled reference chips |
| Parallel `orvek-v0/pages/map.tsx` | Correct the model | Same honesty split (inactive under hard-swap root) |
| Parallel `orvek-v0/pages/explore.tsx` | Correction context | Unchanged vs starting commit (semantic-restoration containment); live Explore is canonical |
| Quarantined `V0MapView` | Propose chips | Adapter supports `canonical_propose` mode |
| Legacy inspector / frozen reference | chips | Unchanged reference/deferred behaviour |
| `resolveCorrectionWriteTarget` | write target | Returns `null` for `canonical_concept` |

Handoff contract: `CanonicalCorrectionHandoffV1` in `lib/canonical-correction-handoff.ts`.

Primary SPA transport: workbench `canonicalCorrectionHandoff` (in-memory navigation payload only).
No browser-storage API: `lib/canonical-correction-handoff.ts` contains no `window`/`sessionStorage`/`localStorage` helpers.
After a full reload, correction context disappears — no false success is displayed.
Same-context account-switch isolation: user B sees no correction context or stored content from user A.
Explore (`orvek-v0-canonical/pages/explore.tsx`) shows Correction context banner; no authority mutation.

## Browser journey (mandatory acceptance)

Exact Playwright command:

```bash
PHASE6_MANAGE_SERVER=1 \
DESKTOP_PARITY_BASE_URL=http://localhost:3100 \
CANONICAL_AUTHORITY_DB_TEST_URL='postgresql://user@127.0.0.1:5432/companion_canonical_authority_test' \
DATABASE_URL='postgresql://user@127.0.0.1:5432/companion_canonical_authority_test' \
npx playwright test scripts/orvek-canonical-model-authority-phase6.playwright.ts
```

- Spec: `scripts/orvek-canonical-model-authority-phase6.playwright.ts`
- Browser engine: Chromium (Playwright)
- Test count: **9 passed / 0 failed / 0 skipped**
- Required stages skipped: **0**

Latest green run (2026-07-29 commit-safety):

```text
conceptId: cms6000u30002qlvlvchwj089
previousRevisionId: cms6000u80004qlvl5hjy1x59
resultingRevisionId: cms60034l0001qlxdjzxrtgb0
modelUpdateId: emu_d68e06f97e408f6ac8322b3ef73538edf3b1cdde
proposalId: emp_a7d95fdbb31b33d5ec8bea30d4dd88f74ff978b4
```

### Required stage results

| Stage | Result |
|---|---|
| A pre-publication legacy | PASS |
| B–C publish | PASS |
| D post-publication parity | PASS |
| D What Changed browser UI | PASS (page shows REVISION ONE / REVISION TWO / Canonical model revision; modelUpdateId once) |
| D real browser `POST /api/message` | PASS (exactly one browser POST; capture correlated by nonce; revision-2 authority; legacy/internal excluded; order flags true) |
| E hard refresh | PASS |
| F route reopen | PASS |
| G fresh browser context | PASS |
| H correction handoff | PASS (in-memory SPA handoff only; no sessionStorage write; reload clears context; same-context user-B switch proves no user-A data survives) |
| I cross-user | PASS |
| J gate-disabled restart | PASS |
| J gate-disabled history visible | PASS |
| J gate-disabled What Changed | PASS |
| J post-restart fresh context | PASS |
| J post-restart new-creation legacy | PASS |

### Server restart proof (no secrets)

```text
initial: npm run build && npm run start
  with ORVEK_CANONICAL_MODEL_AUTHORITY_V1=1
  + allowlist
  + ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1
  + ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1

gateOff: npm run start
  with ORVEK_CANONICAL_MODEL_AUTHORITY_V1=0
  + empty allowlist
  + ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1
  + ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1

effectiveCreationGateAfterRestart: 0
```

Hard refresh exercised: yes.
Fresh browser context after restart: yes.
Local app stop + gate-off restart: yes (mandatory under `PHASE6_MANAGE_SERVER=1`).
Real What Changed page rendered: yes.
Real browser `POST /api/message` observed: yes.

## Controlled rollout instructions

1. Deploy code that includes Phases 1–6.
2. Ensure migrations already applied (no Phase 6 schema delta).
3. Set `ORVEK_CANONICAL_MODEL_AUTHORITY_V1=1`.
4. Set `ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS` to the exact allowlisted Clerk IDs.
5. Verify one allowlisted user can create a canonical proposal and publish.
6. Verify a non-allowlisted user still creates legacy proposals.
7. Verify allowlisted users with existing canonical history still see it when temporarily removed from allowlist (creation blocked; history visible).

## Rollback instructions

- Set `ORVEK_CANONICAL_MODEL_AUTHORITY_V1=0` or clear allowlist → stops **new** canonical creation.
- Does **not** delete or hide accepted canonical history.
- Do **not** restore truth by mutating the bound legacy UMC.
- Do **not** manually reset `currentRevisionId`.
- Code rollback must preserve DB compatibility with existing canonical tables.
- Accepted revision history remains durable unless a future designed migration changes it.

## Production-readiness disclaimer

**Canonical Model Authority V1 is ready for controlled rollout.**

This is **not** a claim that the whole product is production-ready, security-certified, or safe for production-wide enablement.

## Known limitations

- Semantic concept deduplication / merge / retire / dispute / weaken not in V1
- No mass backfill of historical UMC rows
- Revision 3+ product workflow not shipped
- AI request-path private summaries must never appear in normal runtime logs (capture is test-only)
- Playwright publish may fall back to authenticated product `/publish` API if Explore grounding UI does not surface the seeded proposal card

## Phase 6 safety hardening (2026-07-29)

| Property | Status |
|---|---|
| Capture nonce allowlisted (`/^[A-Za-z0-9_-]{1,128}$/`) and path-contained | YES — invalid nonces resolve to `null`; no file created or read |
| Runtime capture uses the shared exact-environment guard | YES — `isPhase6TestSeamActive`; `ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1` alone never enables capture |
| Database identity is parsed and exact | YES — `parseExactDisposableDbUrl` requires postgres(ql) + 127.0.0.1\|localhost + port 5432 + pathname `/companion_canonical_authority_test`; both URLs must match host/port/db |
| Capture cleanup runs on success and failure | YES — nonces tracked; deleted in test `finally` and best-effort in `afterAll`; never recursively deletes the capture directory |
| No correction handoff browser-storage API exists | YES — `lib/canonical-correction-handoff.ts` has no `window`/`sessionStorage`/`localStorage`; transport is Workbench React state only |
| Same-context account-switch isolation | YES — user-B context proves no user-A correction context or stored content survives |
| Required-stage fail-closed (`afterAll` throws if any stage missing) | YES — `throw new Error(...)` in `afterAll` after cleanup |
| No generated test artefacts are committed | YES — `test-results/` gitignored; `.last-run.json` excluded from the patch |
| Unit tests for nonce validation, guard, handoff, fail-closed | YES — `lib/__tests__/canonical-phase6-safety.test.ts` |

## Test commands / counts

Canonical / Phase 6 suites (see verification log for exact totals).

Assault: `explore-grounding-movement-assault.test.ts`
Playwright: **9 passed, 0 skipped** with `PHASE6_MANAGE_SERVER=1`
`npx prisma validate` / `npm run prisma:generate` / `npx tsc --noEmit` / `git diff --check`: see closeout verification block
