# MindLab Phase 2 — Candidate Lifecycle Operations Policy Contract

**Status:** CONTRACT CREATED / POLICY LOCKED  
**Date:** 2026-06-10  
**Scope:** Docs-only candidate lifecycle operations policy. No code, schema, routes, UI, mobile, DB mutations, script execution, scheduler implementation, or lifecycle implementation.

**Validation base:** `main @ 786562d — Add production trigger backfill policy contract`  
**Parent contract:** `docs/phase2-umbrella-closeout-decision-contract.md`  
**Related contract:** `docs/phase2-production-trigger-backfill-policy-contract.md`  
**Addresses Agent 22 blockers:** #3 (ModelUpdate dismiss/reject/archive policy), #4 (expiry/stale candidate policy), #5 (duplicate uniqueness/race-window policy)

---

## 1. Executive verdict

**Recommended option: Option C (docs-only policy now) for ModelUpdate cleanup semantics; Option B (manual operator policy) for expiry/stale handling; Option B (accept app-level dedupe) for duplicate/race-window protection.**

Phase 2 may treat the **current candidate lifecycle operations model** as sufficient for umbrella closeout **after** remaining non-lifecycle blockers are locked (#6 formal acceptance criteria, #7 POST governance).

Phase 2 does **not** require before close:

- ModelUpdate reject/archive/expire routes or `candidateLifecycleStatus` on `ModelUpdate`
- automatic expiry scheduler or stale-candidate automation
- DB-level duplicate uniqueness constraints or bridge race-window hardening

Phase 2 **does** require:

- this contract's decision table (§11) recorded in the ledger
- explicit acceptance of documented operator-pool and duplicate-race risks (§9)
- preservation of existing diagnostics and manual operator paths (§6)

**Phase 2 is still not complete** after this contract alone — two Agent 22 blockers remain (#6, #7).

---

## 2. Current lifecycle reality by family

### Shared enum (lifecycle-managed families only)

`CandidateLifecycleStatus` in `prisma/schema.prisma`:

- `proposed`, `held_for_more_evidence`, `rejected`, `promoted`, `superseded`, `expired`

Transition policy: `lib/candidate-lifecycle-transitions.ts`  
Persistence helpers: family-specific `*-candidate-lifecycle-persistence.ts` modules  
Operator actions: `lib/internal-user-map-review-operator-actions.ts` — `promote`, `hold_for_more_evidence`, `reject`, `expire`

### UserMapConclusion

| Aspect | Current behavior |
|--------|------------------|
| Candidate identification | `visibility: internal_only` + non-null `candidateLifecycleStatus` (new rows: `proposed`) |
| Operator lifecycle | Promote / Hold / Reject / Expire via `POST /api/internal/user-map/candidates/[id]/lifecycle` |
| Publish gate | `promoted` + `internal_only` → `POST /api/internal/user-map/candidates/[id]/publish` |
| Publish effect | Flips to `user_visible`; creates `conclusion_added` ModelUpdate receipt |
| Natural validation | **COMPLETE** (live path) |
| Legacy gap | Rows with `candidateLifecycleStatus: null` have no lifecycle buttons |

### Investigation

| Aspect | Current behavior |
|--------|------------------|
| Candidate identification | `visibility: internal_only` + non-null `candidateLifecycleStatus` |
| Operator lifecycle | Promote / Hold / Reject / Expire via `POST /api/internal/investigations/candidates/[id]/lifecycle` |
| Publish gate | `promoted` + `internal_only` + Active-Question-visible status |
| Publish effect | Flips visibility; creates `investigation_opened` ModelUpdate receipt |
| Validation | **Fixture-backed COMPLETE**; natural **BLOCKED / NOT COMPLETE** on current dataset |

### FieldworkAssignment

| Aspect | Current behavior |
|--------|------------------|
| Candidate identification | `visibility: internal_only` + non-null `candidateLifecycleStatus` |
| Operator lifecycle | Promote / Hold / Reject / Expire via `POST /api/internal/fieldwork/candidates/[id]/lifecycle` |
| Publish gate | `promoted` + `internal_only` + Watch-For-publishable status |
| Publish effect | Flips visibility; creates `fieldwork_assigned` ModelUpdate receipt |
| Validation | **Fixture-backed COMPLETE**; natural **BLOCKED / NOT COMPLETE** on current dataset |

### ModelUpdate (independent candidate lane)

| Aspect | Current behavior |
|--------|------------------|
| Schema | **No `candidateLifecycleStatus` field** on `ModelUpdate` (`prisma/schema.prisma` lines 871–891) |
| Candidate identification | `visibility: internal_only` + `isMeaningful: false` |
| Operator lifecycle | **None** — workbench is publish-only; no Promote/Hold/Reject/Expire buttons |
| Publish gate | `internal_only` + `!isMeaningful` + ≥1 user-owned `UnderstandingEvidenceLink` (`targetType: model_update`) |
| Publish effect | Flips same row to `user_visible` + `isMeaningful: true`; does **not** create another ModelUpdate |
| Publish safety | Transaction + `updateMany` guard against concurrent publish races (`lib/model-update-candidate-publish-helper.ts`) |
| Validation | **Fixture-backed COMPLETE** (`cmq7xttlh0006qlwzprysfdlu`; `link_detected`; What Changed visible) |
| Unpublishable pool | Rows that never publish remain `internal_only` + `isMeaningful: false` indefinitely |

### Internal workbench (all four families)

Hidden surface: `/internal/user-map/review`  
Allowlist: `INTERNAL_USER_MAP_REVIEWER_IDS`  
Triage: lifecycle families use lifecycle buckets; ModelUpdate uses publish-only buckets (`publish_ready`, `needs_evidence`, `blocked`)

---

## 3. ModelUpdate candidate operations policy

### Options evaluated

| Option | Verdict |
|--------|---------|
| **A — Require reject/archive/expire implementation before Phase 2 close** | **Rejected** — validated publish-only path is sufficient for Phase 2 mechanics proof; adds schema/route scope not required to close umbrella |
| **B — Accept publish-only ModelUpdate candidates for Phase 2** | **Selected** — official Phase 2 policy |
| **C — Docs-only policy now; implementation later if operator volume demands** | **Selected** — same as B for closeout; implementation trigger is operator review volume, not Phase 2 gate |

### Official Phase 2 policy

**ModelUpdate internal candidates are publish-only for Phase 2.**

Operators may:

- **Publish** eligible `internal_only` + `isMeaningful: false` rows via internal publish route
- **Leave unpublishable rows internal** — no dismiss/reject/archive/expire path exists today

Operators may **not** (Phase 2):

- Expect lifecycle buttons on ModelUpdate tab
- Assume unpublishable ModelUpdate candidates are auto-cleaned

**Rationale:**

1. Independent ModelUpdate fixture-backed validation proves publish path end-to-end without lifecycle semantics.
2. `ModelUpdate` schema intentionally uses `visibility` + `isMeaningful`, not `candidateLifecycleStatus` — adding lifecycle is a **future schema/product slice**, not a missing Phase 2 mechanic.
3. UserMap / Investigation / Fieldwork already provide full lifecycle-managed operator cleanup for their candidate pools.
4. Internal queue clutter from unpublishable ModelUpdate rows is a **known, accepted Phase 2 risk** (§9), not an undocumented bug.

**Future implementation trigger (post–Phase 2):** sustained operator review volume or hygiene requirements for the ModelUpdate `internal_only` pool — then add dismiss/reject/archive semantics in a bounded implementation slice.

---

## 4. Expiry / stale candidate policy

### Current behavior (fact)

| Mechanism | Status |
|-----------|--------|
| Manual **expire** operator action | **Implemented** for UserMap, Investigation, Fieldwork via lifecycle routes |
| Manual **reject** operator action | **Implemented** for same families |
| Automatic expiry scheduler | **NOT IMPLEMENTED** |
| Automatic stale cleanup | **NOT IMPLEMENTED** |
| Stale diagnostics | **Implemented** for lifecycle-managed families via `lib/candidate-lifecycle-diagnostics.ts` + `scripts/report-candidate-lifecycle-diagnostics.ts` |
| Stale eligibility | `proposed` and `held_for_more_evidence` only; age measured from `updatedAt` vs configurable cutoff |
| ModelUpdate stale diagnostics | **Disabled** (`staleEnabled: false` — no lifecycle status to evaluate) |

### Options evaluated

| Option | Verdict |
|--------|---------|
| **A — Require automatic expiry scheduler before Phase 2 close** | **Rejected** — conflicts with Agent 23 deferral of scheduler/automation; adds scope beyond validated foundation |
| **B — Accept manual expire/reject for lifecycle-managed candidates** | **Selected** — official Phase 2 policy |
| **C — Require stale diagnostics only, not automation** | **Accepted as supplementary** — diagnostics already exist; manual operation remains primary |

### Official Phase 2 policy

**Lifecycle-managed candidates (UserMap, Investigation, Fieldwork): manual expire/reject is sufficient for Phase 2 close.**

- Operators use workbench lifecycle actions to expire or reject stale `proposed` / `held_for_more_evidence` rows.
- Operators may use `report-candidate-lifecycle-diagnostics.ts` (read-only) to identify stale clusters before manual action.
- **Automatic** expiry scheduler and stale cleanup are **deferred beyond Phase 2**.

**ModelUpdate unpublishable pool:** not covered by lifecycle expire — see §3 (publish-only; clutter accepted).

**Rationale:**

1. All three lifecycle-managed families support manual expire/reject today with validated fixture-backed paths.
2. `expired` status exists in enum and transition policy; automation was never part of Phase 2 validated foundation.
3. Agent 23 locked event-only production triggers and deferred scheduler scope — automatic candidate expiry is the same class of deferred automation.

---

## 5. Duplicate uniqueness / race-window policy

### Current behavior (fact)

| Layer | Behavior |
|-------|----------|
| **Bridge persistence dedupe** | Application-level, inside `$transaction`, per family — compares normalized title/summary (or family-specific fields) against existing `internal_only` rows |
| **Dedupe outcome** | Returns `DUPLICATE_CANDIDATE` in `blockedWriteReasons`; reuses existing row id; `candidatesWritten: 0` |
| **Explicit code comment** | ModelUpdate persistence: *"Duplicate lookup stays inside the transaction; no DB uniqueness in this slice."* |
| **DB constraints** | **None** for candidate fingerprint uniqueness |
| **Concurrent bridge race** | Two concurrent bridge runs can both pass pre-insert lookup and create duplicate rows — **known race window** |
| **Publish concurrent safety** | `updateMany` guards on publish helpers prevent double-publish of same candidate |
| **Diagnostics** | `computeCandidateLifecycleDiagnostics` reports duplicate clusters per family (fingerprint-based) |
| **Tests** | Persistence tests cover duplicate detection; publish helpers test concurrent publish simulation |

Families with dedupe helpers:

- `lib/understanding-dark-engine/user-map-candidate-persistence.ts`
- `lib/understanding-dark-engine/investigation-candidate-persistence.ts`
- `lib/understanding-dark-engine/fieldwork-candidate-persistence.ts`
- `lib/understanding-dark-engine/model-update-candidate-persistence.ts`

### Options evaluated

| Option | Verdict |
|--------|---------|
| **A — Require DB-level uniqueness before Phase 2 close** | **Rejected** — requires schema migration; not proven blocker on validated foundation |
| **B — Accept app-level dedupe for Phase 2** | **Selected** — official Phase 2 policy |
| **C — Policy now; DB hardening later if incidents occur** | **Selected** — same as B for closeout; implementation trigger is real duplicate incidents or production volume |

### Official Phase 2 policy

**Application-level dedupe inside bridge transactions is sufficient for Phase 2 close.**

- **App-level dedupe:** **ACCEPTED** as official interim production policy
- **DB-level uniqueness constraints:** **DEFERRED beyond Phase 2**
- **Concurrent bridge race-window:** **DEFERRED hardening beyond Phase 2** — documented accepted risk

**Mitigations for Phase 2 (manual/operator):**

- Run `report-candidate-lifecycle-diagnostics.ts` to surface duplicate clusters
- Manually expire/reject duplicate lifecycle-managed candidates where appropriate
- ModelUpdate duplicate clusters: manual review only (no lifecycle expire)

**Future implementation trigger (post–Phase 2):** observed duplicate incidents under concurrent production bridges, or governed decision to add partial unique indexes per family fingerprint.

**Rationale:**

1. Dedupe is implemented consistently across all four families with transaction-scoped lookup.
2. Engineering ledger and prior closeouts document the race window explicitly — not a hidden defect.
3. Publish paths already guard concurrent publish races; bridge-insert race is lower severity (internal-only rows, operator-visible).
4. DB uniqueness requires careful key design per family and schema migration — Phase 2E contract defers generalized schema migration.

---

## 6. Manual operator policy for Phase 2

| Operation | UserMap | Investigation | Fieldwork | ModelUpdate |
|-----------|---------|---------------|-----------|-------------|
| Hold for more evidence | Manual (workbench) | Manual | Manual | N/A |
| Promote | Manual | Manual | Manual | N/A |
| Reject | Manual | Manual | Manual | N/A |
| Expire | Manual | Manual | Manual | N/A |
| Publish | Manual (when promoted) | Manual (when promoted) | Manual (when promoted) | Manual (when eligible) |
| Leave internal indefinitely | Allowed (rejected/expired/hold) | Allowed | Allowed | **Allowed — unpublishable pool** |
| Stale identification | Diagnostics script + workbench | Same | Same | Duplicate diagnostics only (no stale) |
| Duplicate identification | Diagnostics script | Same | Same | Same |

**Operator tooling (dev/read-only, not production automation):**

- `scripts/report-candidate-lifecycle-diagnostics.ts` — stale + duplicate cluster report per user

**Forbidden as Phase 2 production policy:**

- Using diagnostics scripts to auto-mutate candidate rows
- Hand-deleting rows outside lifecycle routes without governed ops policy
- Treating app-level dedupe as equivalent to DB uniqueness

---

## 7. Deferred implementation beyond Phase 2

| Item | Deferred to | Phase 2 close blocker? |
|------|-------------|--------------------------|
| ModelUpdate reject/archive/expire semantics | Future ModelUpdate operator-hygiene phase | **No** (policy accepts publish-only) |
| `candidateLifecycleStatus` on `ModelUpdate` (if ever adopted) | Future schema slice | **No** |
| Automatic expiry scheduler | Future scheduled lifecycle automation phase (aligned with Agent 23 scheduler deferral) | **No** |
| Automatic stale-candidate cleanup | Same | **No** |
| DB-level duplicate uniqueness constraints | Future candidate integrity / schema hardening phase | **No** |
| Concurrent bridge race-window hardening (e.g., advisory locks, unique indexes) | Same | **No** |
| Legacy UserMap `null` lifecycle backfill | Future hygiene slice | **No** |
| Unified cross-family operator queue | Phase 6 / ops polish | **No** |

Implementation of deferred items is **not** authorized by this contract.

---

## 8. What blocks Phase 2 close

### Cleared by this contract (policy lock via explicit deferral/acceptance)

| Agent 22 # | Item | Status |
|------------|------|--------|
| **#3** | ModelUpdate dismiss/reject/archive policy | **CLEARED** — publish-only accepted; reject/archive/expire deferred |
| **#4** | Expiry/stale candidate policy | **CLEARED** — manual expire/reject accepted; automation deferred |
| **#5** | Duplicate uniqueness/race-window policy | **CLEARED** — app-level dedupe accepted; DB/race hardening deferred |

### Still open after this contract

| Agent 22 # | Item | Why still open |
|------------|------|----------------|
| **#6** | Formal Phase 2 acceptance criteria in ledger | Umbrella acceptance artifact not yet written |
| **#7** | `POST /api/user-map/conclusions` governance | Product decision not locked |

### Not Phase 2 close blockers (preserve)

- Natural lower-family validation on current dataset (**BLOCKED / NOT COMPLETE**; not hard blocker per Agent 22)
- Scheduler/cron dark-run (**deferred** per Agent 23)
- Automatic historical backfill (**deferred** per Agent 23)

---

## 9. Risks accepted for Phase 2

These are **explicitly accepted**, not bugs to fix before close:

| Risk | Acceptance basis |
|------|------------------|
| **ModelUpdate internal queue clutter** | Unpublishable `internal_only` + `isMeaningful: false` rows accumulate with no dismiss path; operators filter via workbench triage |
| **No ModelUpdate operator cleanup** | Publish-only validated; lower-family lifecycle cleanup exists for other pools |
| **Manual-only stale handling** | Lifecycle families support expire/reject; diagnostics assist identification |
| **No automatic stale expiry** | Consistent with Agent 23 automation deferral |
| **App-level dedupe only** | Transaction-scoped lookup is current production behavior |
| **Concurrent bridge duplicate rows** | Rare race window; internal-only impact; diagnostics detect clusters |
| **Legacy UserMap null lifecycle rows** | Pre-lifecycle rows lack buttons; not auto-migrated |
| **ModelUpdate excluded from stale diagnostics** | No lifecycle status to evaluate |

---

## 10. Risks not accepted for Phase 2

These remain **non-negotiable** — closing Phase 2 must not imply they are acceptable:

| Risk | Required posture |
|------|------------------|
| **Publishing without evidence** | ModelUpdate publish rejects missing evidence links (`MODEL_UPDATE_MISSING_EVIDENCE`) |
| **Public leak of internal candidates** | Evidence-link guards and visibility filters remain mandatory |
| **Fake or static insight** | All user-facing claims trace to stored evidence |
| **Silent auto-expiry without policy** | Must not implement scheduler in closeout slice without new contract |
| **Silent DB migration for uniqueness** | Schema changes require explicit future slice |
| **Hiding duplicate/race warnings in ledger** | Accepted risks must stay documented |
| **Claiming ModelUpdate has lifecycle when it does not** | Publish-only wording required |

---

## 11. Decision table

| Policy item | Phase 2 decision | Implementation required before close? | Deferred? | Risk accepted |
| ----------- | ---------------- | ------------------------------------: | --------- | ------------- |
| ModelUpdate reject/archive/expire | **Accept publish-only; defer reject/archive/expire** | **No** | **Yes** — beyond Phase 2 | **Yes** — internal queue clutter for unpublishable ModelUpdate rows |
| Lifecycle-managed candidate expiry | **Manual expire/reject via operator workbench** | **No** (already implemented) | Partial — automation deferred | **Yes** — stale rows until operator acts |
| Automatic stale cleanup | **Deferred beyond Phase 2** | **No** | **Yes** | **Yes** — no scheduler-driven cleanup |
| DB-level duplicate uniqueness | **Deferred beyond Phase 2** | **No** | **Yes** | N/A (covered by app dedupe + race row) |
| App-level dedupe | **Accepted as official Phase 2 policy** | **No** (already implemented) | **No** | **Yes** — known lookup-window limitation |
| Concurrent bridge race-window | **Deferred hardening beyond Phase 2** | **No** | **Yes** | **Yes** — rare duplicate internal rows possible |

---

## 12. Phase 2 closeout effect

### Agent 22 blocker clearance

| Blocker | Status after this contract |
|---------|---------------------------|
| **#1 Production trigger/backfill policy** | **CLEARED** (Agent 23) |
| **#2 Scheduler/backfill accept-or-defer** | **CLEARED** (Agent 23) |
| **#3 ModelUpdate dismiss/reject/archive policy** | **CLEARED** — publish-only accepted; implementation deferred |
| **#4 Expiry/stale candidate policy** | **CLEARED** — manual operator policy accepted; automation deferred |
| **#5 Duplicate uniqueness/race-window policy** | **CLEARED** — app-level dedupe accepted; DB/race deferred |
| **#6 Formal Phase 2 acceptance criteria in ledger** | **OPEN** |
| **#7 POST manual-create governance** | **OPEN** |

### Phase 2 closeout wording after this contract

Use this wording in ledger and closeout artifacts:

> **Candidate lifecycle operations policy (Phase 2):** UserMap, Investigation, and Fieldwork are lifecycle-managed with manual promote/hold/reject/expire and publish gates. ModelUpdate candidates are **publish-only** (`internal_only` + `isMeaningful: false`); reject/archive/expire **deferred beyond Phase 2**. Stale handling is **manual** (operator expire/reject + diagnostics script); automatic expiry scheduler **deferred beyond Phase 2**. Duplicate protection is **application-level** inside bridge transactions; DB uniqueness and concurrent-bridge race hardening **deferred beyond Phase 2**. Accepted risks are documented in `docs/phase2-candidate-lifecycle-operations-policy-contract.md`. Phase 2 umbrella remains **PARTIAL** until formal acceptance criteria (#6) and POST governance (#7) are locked.

### Can Phase 2 close now?

**No.** This contract clears three of seven must-fix blockers (cumulative: five cleared, two open).

### Recommended next slice

**Phase 2 umbrella acceptance criteria + POST `/api/user-map/conclusions` governance** (docs-only) — locks Agent 22 blockers #6 and #7, then umbrella acceptance closeout artifact.

---

## 13. Forbidden interpretations

This contract must **not** be read to:

- Claim Phase 2 umbrella is **complete**
- Claim ModelUpdate candidates have reject/archive/expire semantics today
- Claim automatic stale cleanup or expiry scheduler exists
- Claim DB-level duplicate uniqueness exists
- Claim concurrent bridge races are impossible
- Authorize schema migration or lifecycle routes in Phase 2 closeout slice
- Hide accepted risks in §9
- Remove existing ledger warnings about race windows or operator clutter
- Claim natural lower-family validation is **complete**
- Reclassify fixture-backed validation as natural validation
- Treat unpublishable ModelUpdate rows as a bug requiring pre-close implementation

---

## Policy question answers (summary)

| # | Question | Answer |
|---|----------|--------|
| 1 | Must ModelUpdate reject/archive/expire be implemented before Phase 2 close? | **No** — publish-only accepted |
| 2 | Must stale/expired cleanup automation be implemented before close? | **No** — manual expire/reject accepted |
| 3 | Must DB-level duplicate uniqueness be implemented before close? | **No** — app-level dedupe accepted |
| 4 | What is manual/operator policy for Phase 2? | §6 — workbench lifecycle + publish; diagnostics for stale/duplicate identification |
| 5 | What is deferred beyond Phase 2? | §7 — ModelUpdate cleanup semantics, automation, DB uniqueness, race hardening |
| 6 | What still blocks close? | #6 formal acceptance criteria; #7 POST governance |
| 7 | Are §9 risks bugs? | **No** — explicitly accepted for Phase 2 |

---

## Supporting references

- `docs/phase2-umbrella-closeout-decision-contract.md`
- `docs/phase2-production-trigger-backfill-policy-contract.md`
- `docs/lower-family-dev-validation-fixture-strategy.md`
- `docs/engineering-ledger.md` — Internal Four-Family Candidate Review Workbench closeout; four-family bridge closeout
- `prisma/schema.prisma` — `CandidateLifecycleStatus`, family models
- `lib/internal-user-map-review-operator-actions.ts`
- `lib/candidate-lifecycle-diagnostics.ts`
- `lib/model-update-candidate-publish-helper.ts`
- `lib/understanding-dark-engine/*-candidate-persistence.ts`
- `scripts/report-candidate-lifecycle-diagnostics.ts`
