# MindLab Phase 2 — Final Acceptance + POST Manual-Create Governance Contract

**Status:** CONTRACT CREATED / POLICY LOCKED / PHASE 2 UMBRELLA CLOSED  
**Date:** 2026-06-10  
**Scope:** Docs-only formal Phase 2 acceptance criteria, POST governance decision, and umbrella closeout. No code, schema, routes, UI, mobile, DB mutations, script execution, or POST route changes.

**Validation base:** `main @ c34de06 — Add candidate lifecycle operations policy contract`  
**Parent contract:** `docs/phase2-umbrella-closeout-decision-contract.md`  
**Prior policy contracts:** `docs/phase2-production-trigger-backfill-policy-contract.md`, `docs/phase2-candidate-lifecycle-operations-policy-contract.md`  
**Addresses Agent 22 blockers:** #6 (formal Phase 2 acceptance criteria), #7 (`POST /api/user-map/conclusions` governance)

---

## 1. Executive verdict

**Phase 2 umbrella may be marked `CLOSED / VALIDATED` under accepted Phase 2 scope after this contract.**

All seven Agent 22 must-fix blockers are now **policy-locked** with ledger record. No follow-up **implementation** slice is mandatory before close.

**POST governance: Option A selected** — keep `POST /api/user-map/conclusions` as a documented manual-create affordance for Phase 2. Response projection is safe (`2c54bce`); the route is explicitly **outside** production intelligence candidate lifecycle. Restriction, deprecation, or internal-only conversion are **deferred beyond Phase 2**.

**Phase 2 close does not imply:**

- natural lower-family validation complete
- scheduler/backfill implemented
- automatic stale cleanup implemented
- DB-level duplicate uniqueness implemented
- ModelUpdate reject/archive implemented
- POST route removed or restricted

---

## 2. Phase 2 acceptance criteria

Per `docs/phase2-umbrella-closeout-decision-contract.md` §5, Phase 2 umbrella close requires:

### A. Acceptance criteria documented in ledger

Formal umbrella acceptance artifact in `docs/engineering-ledger.md` and `docs/mindlab-roadmap-status-ledger.md` listing validated foundation, accepted deferrals, locked policies, and non-blocking follow-ons. **Satisfied by this contract + ledger updates.**

### B. Production operations policy locked

`docs/phase2-production-trigger-backfill-policy-contract.md` — event-only generation accepted; scheduler and automatic historical backfill deferred. **Satisfied (Agent 23).**

### C. Candidate lifecycle operations policy locked

`docs/phase2-candidate-lifecycle-operations-policy-contract.md` — ModelUpdate publish-only; manual expire/reject; app-level dedupe; automation and DB hardening deferred. **Satisfied (Agent 24).**

### D. Governance decisions recorded

- **POST manual-create:** Option A — keep as documented manual/legacy affordance outside production intelligence flow. **Satisfied by this contract (§5–§8).**
- **Natural lower-family validation:** classified as **not required** for Phase 2 umbrella close on current dataset. **Satisfied (Agent 22 §5.D).**

### E. No false completion claims

Closeout preserves fixture vs natural distinction and §11 forbidden claims. **Satisfied by this contract §12.**

### Formal acceptance checklist (Agent 25)

| # | Criterion | Required for close? |
|---|-----------|---------------------|
| 1 | UserMap natural candidate creation → review → publish validated | **Yes** |
| 2 | Lower-family review/publish mechanics validated **fixture-backed** | **Yes** |
| 3 | Public projection safety validated for published intelligence surfaces | **Yes** |
| 4 | Internal operator workflow exists for four families | **Yes** |
| 5 | Production generation policy locked as event-only | **Yes** |
| 6 | Scheduler/backfill explicitly deferred | **Yes** |
| 7 | Candidate lifecycle operations policy locked | **Yes** |
| 8 | Accepted risks documented | **Yes** |
| 9 | POST manual-create governance decided | **Yes** |
| 10 | Deferred work listed clearly | **Yes** |

### Explicitly excluded from Phase 2 acceptance (not blockers)

- Natural Investigation / Fieldwork / independent ModelUpdate generation on current local dataset
- Scheduler / cron dark-run implementation
- Automatic historical backfill implementation
- Automatic stale-candidate cleanup
- DB-level duplicate uniqueness / bridge race hardening
- ModelUpdate reject/archive/expire implementation
- Mobile operator review UI
- Native/live production traffic validation beyond local/dev validation evidence
- Phase 2E generalized candidate schema migration

---

## 3. Acceptance criteria status table

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | UserMap natural validation | **SATISFIED** | PR #50–#52; live-DB create → review → publish; candidate `cmq6frqdx0000ql8h6nkavzue` |
| 2 | Lower-family fixture-backed validation | **SATISFIED** | Investigation `cmq7xttgo0000qlwzet7g6j5f`; Fieldwork `cmq7xttjg0003qlwzk3qmbq5j`; ModelUpdate `cmq7xttlh0006qlwzprysfdlu` |
| 3 | Public projection safety | **SATISFIED** | UserMap GET/PATCH/POST projection (`0b4641d`, `c2b4749`, `2c54bce`); evidence-link leak guard (PR #32); public intelligence surfaces tested |
| 4 | Four-family internal workbench | **SATISFIED** | `/internal/user-map/review`; lifecycle + publish for UserMap/Investigation/Fieldwork; ModelUpdate publish-only |
| 5 | Event-only generation locked | **SATISFIED** | Agent 23 production trigger contract |
| 6 | Scheduler/backfill deferred | **SATISFIED** | Agent 23 explicit deferral |
| 7 | Lifecycle operations locked | **SATISFIED** | Agent 24 candidate lifecycle contract |
| 8 | Accepted risks documented | **SATISFIED** | Agent 23 §15; Agent 24 §9; this contract §11 |
| 9 | POST governance decided | **SATISFIED** | This contract §5 (Option A) |
| 10 | Deferred work listed | **SATISFIED** | This contract §10 |

---

## 4. POST `/api/user-map/conclusions` current behavior

**Route:** `app/api/user-map/conclusions/route.ts` — authenticated `POST`

### What POST does (fact)

| Behavior | Detail |
|----------|--------|
| Auth | Requires Clerk `userId`; 401 if unauthenticated |
| Body validation | `userMapConclusionCreateSchema` (`lib/understanding-engine-api.ts`) |
| Visibility | **Always** sets `visibility: user_visible` — client cannot supply `visibility` (rejected with 400) |
| Lifecycle | Does **not** set `candidateLifecycleStatus`; bypasses internal review/publish |
| ModelUpdate | Does **not** create `conclusion_added` or any ModelUpdate receipt |
| Evidence links | Does **not** create `UnderstandingEvidenceLink` rows |
| Response | `201 { item }` via `toUserMapConclusionPublicApiDetailItem` with explicit safe `select` |
| Ownership | `userId` from auth only — body `userId` ignored (test-verified) |

### What POST does not do

- Does not run dark-engine proposal or bridge persistence
- Does not enter `internal_only` candidate pool
- Does not require promote/hold/reject/expire lifecycle
- Does not produce reviewed intelligence with evidence-backed ModelUpdate receipt

### Projection safety (fact)

Tests (`lib/__tests__/understanding-engine-phase1b-api.test.ts`):

- `"omits internal lifecycle fields from public user-map conclusion POST response"` — excludes `candidateLifecycleStatus`, `confidenceScore`, `notes`, `visibility`, `userId`, `version`, supersession fields
- Aligns with Phase 2P §4.9 and Public UserMapConclusion API Projection Closeout (`2c54bce`)

### Documented prior classification

- Phase 1B additive API contract (`docs/step4b-phase1b-additive-api-contract.md`) — explicit/manual creation path
- Post-UserMap Audit Wave Synthesis — **DOCUMENT AS LEGACY** relative to production intelligence flow
- Engineering ledger — governance gap, not projection leak

---

## 5. POST governance decision

### Options evaluated

| Option | Verdict |
|--------|---------|
| **A — Keep POST as manual-create affordance for Phase 2** | **Selected** |
| **B — Require POST internal-only before Phase 2 close** | **Rejected** — requires implementation; blocks close without code slice |
| **C — Remove/deprecate POST before Phase 2 close** | **Rejected** — larger API/product break; not required by validated foundation |

### Official Phase 2 POST policy (Option A)

**`POST /api/user-map/conclusions` remains a public authenticated manual-create affordance for Phase 2 close.**

Governance classification:

- **Legacy / manual / additive API path** from Phase 1B
- **Outside production intelligence candidate lifecycle**
- **Not** the production intelligence path for evidence-backed understanding claims
- **Safe** from public response projection leaks (post-`2c54bce`)

Future governance (post–Phase 2) may:

- restrict to internal-only writers
- deprecate with migration period
- reclassify as first-class user-authored map entries with explicit product semantics
- require evidence-link attachment for manual creates

None of these are Phase 2 close blockers.

---

## 6. What POST may be used for

| Use case | Allowed? |
|----------|----------|
| Phase 1B manual/API creation of `user_visible` UserMap conclusions | **Yes** — original contract intent |
| Dev/testing of UserMap public API consumers with safe projected responses | **Yes** — with understanding it bypasses lifecycle |
| User- or operator-initiated direct map entries (if product accepts manual authorship) | **Yes** — documented as non-reviewed path |
| Authenticated clients that need additive create without internal review gate | **Yes** — explicit legacy affordance |

---

## 7. What POST must not be used for

| Misuse | Why forbidden |
|--------|---------------|
| Claiming production intelligence candidate validation | Bypasses dark-engine → review → publish |
| Substituting for internal publish route | No lifecycle, no ModelUpdate receipt, no evidence links |
| Creating `internal_only` candidates | Route hardcodes `user_visible`; visibility param rejected |
| Proving evidence-gated intelligence loop | No `UnderstandingEvidenceLink` writes on create |
| Reclassifying fixture-backed lower-family validation as natural | Unrelated path |
| Implying reviewed/operator-approved intelligence | No review gate |
| Documentation claiming POST is the primary intelligence creation path | Production path is event bridges + internal workbench |

---

## 8. Whether POST requires code changes before Phase 2 close

**No.**

| Question | Answer |
|----------|--------|
| Is response projection safe? | **Yes** — tested and closed (`2c54bce`) |
| Is lifecycle bypass a projection leak? | **No** — governance classification only |
| Does Option A require route change? | **No** — documentation + ledger lock sufficient |
| Does Phase 2 umbrella require POST restriction for close? | **No** — Agent 22 §6 allows policy lock without enforcement implementation |

**Follow-up implementation is optional and deferred** — only if product later chooses Option B or C.

---

## 9. Final Phase 2 closeout decision

### Agent 22 blocker clearance (cumulative)

| Blocker | Status |
|---------|--------|
| #1 Production trigger/backfill policy | **CLEARED** (Agent 23) |
| #2 Scheduler/backfill accept-or-defer | **CLEARED** (Agent 23) |
| #3 ModelUpdate dismiss/reject/archive | **CLEARED** (Agent 24) |
| #4 Expiry/stale candidate policy | **CLEARED** (Agent 24) |
| #5 Duplicate uniqueness/race-window | **CLEARED** (Agent 24) |
| **#6 Formal Phase 2 acceptance criteria** | **CLEARED** — this contract §2–§3 + ledger acceptance entry |
| **#7 POST manual-create governance** | **CLEARED** — Option A locked; no code required before close |

### Can Phase 2 close after this contract?

**Yes.**

Phase 2 umbrella status: **`CLOSED / VALIDATED`** under accepted Phase 2 scope defined by:

- `docs/phase2-umbrella-closeout-decision-contract.md`
- `docs/phase2-production-trigger-backfill-policy-contract.md`
- `docs/phase2-candidate-lifecycle-operations-policy-contract.md`
- this contract

### Required status wording (preserve forever in closeout)

| Item | Wording |
|------|---------|
| Lower-family fixture-backed validation | **COMPLETE** |
| Lower-family natural validation | **BLOCKED / NOT COMPLETE** |
| Production generation | **Event-only** (APP message + import-completion) |
| Scheduler / automatic backfill | **Deferred beyond Phase 2** |
| ModelUpdate operator cleanup | **Publish-only**; reject/archive deferred |
| Stale/expiry automation | **Deferred beyond Phase 2** |
| Duplicate protection | **App-level**; DB/race deferred |
| POST `/api/user-map/conclusions` | **Manual-create legacy affordance**; outside production intelligence lifecycle |

### Official Phase 2 closeout paragraph (ledger)

> **Phase 2 umbrella: CLOSED / VALIDATED** under accepted scope. Validated: UserMap natural create → review → publish; lower-family fixture-backed review/publish mechanics; public projection safety; four-family internal workbench; event-only production generation; locked lifecycle and duplicate policies. POST manual-create retained as documented legacy path outside production intelligence lifecycle (Option A). **Not complete within Phase 2 scope:** natural lower-family generation on current dataset; scheduler; automatic backfill; automatic stale cleanup; DB uniqueness; ModelUpdate reject/archive. Deferred items are beyond Phase 2, not done.

---

## 10. Deferred beyond Phase 2

| Item | Notes |
|------|-------|
| Natural lower-family validation on current dataset | Data/profile + precedence; not mechanics failure |
| Scheduler / cron dark-run execution | Agent 23 deferral |
| Automatic historical backfill | Agent 23 deferral |
| Trailing-pending retry (`shouldMarkPending`) | Agent 23 deferral |
| ModelUpdate reject/archive/expire | Agent 24 deferral |
| Automatic stale-candidate cleanup / expiry scheduler | Agent 24 deferral |
| DB-level duplicate uniqueness / bridge race hardening | Agent 24 deferral |
| POST restrict / deprecate / internal-only conversion | This contract §5 — future governance slice if chosen |
| Phase 2E generalized candidate schema migration | Phase 2E contract |
| Mobile operator review surface | Phase 6 / ops |
| Unified cross-family operator queue | Ops polish |
| Native/live production traffic validation | Beyond local/dev evidence |

---

## 11. Risks accepted for Phase 2

| Risk | Acceptance |
|------|------------|
| Two creation paths (production intelligence vs manual POST) | Documented; POST is legacy/manual |
| POST creates `user_visible` without review or evidence links | Allowed for Phase 1B additive API; not production intelligence |
| Natural lower-family absence on current dataset | Not a Phase 2 close blocker |
| ModelUpdate internal queue clutter | Agent 24 accepted risk |
| Manual-only stale handling | Agent 24 accepted risk |
| App-level dedupe + bridge race window | Agent 24 accepted risk |
| Event drops under cooldown/in-flight | Agent 23 accepted risk |
| Pre-bridge imports without candidates | Agent 23 accepted gap |

---

## 12. Forbidden claims

Phase 2 closeout and downstream docs must **not**:

- Claim natural lower-family validation is **complete**
- Reclassify fixture-backed validation as natural validation
- Claim scheduler, backfill, stale automation, or DB uniqueness are **implemented**
- Claim ModelUpdate has reject/archive/expire semantics
- Claim POST is the production intelligence path
- Claim POST-created conclusions are operator-reviewed intelligence
- Hide POST lifecycle bypass or dual-path risk
- Claim Phase 2 complete **without** listing deferred items
- Remove or modify POST route as part of this docs closeout
- Imply mobile operator UI exists
- Erase accepted-risk documentation from prior contracts

---

## 13. Next steps after Phase 2

| Priority | Slice | Type | Trigger |
|----------|-------|------|---------|
| P1 | Natural lower-family validation wait / alternate user scan | Validation | When dataset produces lower-family candidates under current gates |
| P2 | POST governance implementation (restrict/deprecate) | Implementation | Only if product chooses Option B/C |
| P3 | Scheduled dark-run / governed backfill phase | Implementation | Post–Phase 2 product decision |
| P4 | ModelUpdate operator hygiene (reject/archive) | Implementation | Operator volume or hygiene need |
| P5 | Expiry scheduler / stale automation | Implementation | Post–Phase 2 automation phase |
| P6 | DB duplicate uniqueness migration | Implementation | Duplicate incidents or integrity policy |
| P7 | Phase 2E generalized schema migration | Schema | When contract authorizes |

Phase 2 reopen criteria: concrete trust/safety regression in accepted scope, or proven false closeout claim — not deferred-item completion alone.

---

## Decision table (required)

| Item | Phase 2 decision | Status after this contract | Code required before close? | Deferred? |
| ---- | ---------------- | -------------------------: | --------------------------: | --------: |
| UserMap natural validation | Required foundation | **SATISFIED** | No | No |
| Lower-family fixture validation | Required mechanics proof | **SATISFIED** | No | No |
| Lower-family natural validation | Not required for close | **BLOCKED / NOT COMPLETE** (accepted) | No | Yes — beyond close scope |
| Event-only generation | Official production policy | **LOCKED** | No | No |
| Scheduler/backfill | Deferred beyond Phase 2 | **LOCKED deferral** | No | Yes |
| Candidate lifecycle operations | Locked per Agent 24 | **LOCKED** | No | Partial — enforcement items deferred |
| POST manual-create | Option A — keep as legacy affordance | **LOCKED** | **No** | Restriction/deprecation yes |
| Formal Phase 2 acceptance | All criteria satisfied | **CLOSED / VALIDATED** | No | N/A |

---

## Supporting references

- `docs/phase2-umbrella-closeout-decision-contract.md`
- `docs/phase2-production-trigger-backfill-policy-contract.md`
- `docs/phase2-candidate-lifecycle-operations-policy-contract.md`
- `docs/lower-family-dev-validation-fixture-strategy.md`
- `docs/step4b-phase1b-additive-api-contract.md`
- `docs/engineering-ledger.md` — Public UserMapConclusion API Projection Closeout; Post-UserMap Audit Wave Synthesis; four-family workbench closeout
- `app/api/user-map/conclusions/route.ts`
- `lib/public-intelligence-safe-slice.ts`
- `lib/__tests__/understanding-engine-phase1b-api.test.ts`
