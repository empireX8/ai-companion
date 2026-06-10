# MindLab Phase 2 — Production Trigger / Backfill Policy Contract

**Status:** CONTRACT CREATED / POLICY LOCKED  
**Date:** 2026-06-10  
**Scope:** Docs-only production policy contract. No code, schema, routes, UI, mobile, DB mutations, script execution, scheduler implementation, or backfill implementation.

**Validation base:** `main @ e8a0d59 — Add Phase 2 umbrella closeout decision contract`  
**Parent contract:** `docs/phase2-umbrella-closeout-decision-contract.md`  
**Addresses Agent 22 blockers:** #1 (production trigger/backfill policy locked), #2 (scheduler/backfill accept-or-defer explicit)

---

## 1. Executive verdict

**Recommended option: Option C — Event-only generation accepted for Phase 2; scheduler and automatic historical backfill deferred beyond Phase 2.**

Phase 2 may treat **event-triggered candidate creation** (APP message bridge + import-completion bridge) as the **official production policy** sufficient for umbrella closeout **after** remaining non-trigger blockers are locked.

Phase 2 does **not** require:

- scheduled/cron dark-run execution before close
- automatic historical backfill of pre-bridge imports before close
- an internal operator backfill button before close
- trailing-pending retry wiring (`shouldMarkPending`) before close

Phase 2 **does** require this contract's decision table (§4) to be recorded in the ledger and preserved in closeout wording.

**Phase 2 is still not complete** after this contract alone — five Agent 22 blockers remain (§12).

---

## 2. Current production trigger reality

### Wired production paths (fact)

Two event bridges create internal candidates through the same pipeline:

```
eligibility → runNoWriteUnderstandingDarkRun → evaluateNoWriteDarkRunOutput → persistInternalCandidateFromNoWriteDarkRunOutput
```

| Trigger | Entry | Event type | Session / gate |
|---------|-------|------------|----------------|
| **APP message bridge** | `app/api/message/route.ts` (background after user message save) | `app_user_message` | `origin === "APP"` and `surfaceType` in `journal_chat` \| `explore_chat` (`shouldRunAppMessageCandidateBridgeForSession`) |
| **Import-completion bridge** | `lib/import-upload-queue.ts` → `onImportComplete` | `import_completed` | Successful import completion after pattern batch |

**Bridge modules:**

- `lib/understanding-dark-engine/app-message-candidate-bridge.ts`
- `lib/understanding-dark-engine/import-completion-candidate-bridge.ts`

**Persistence ladder:** UserMap → Investigation → Fieldwork → ModelUpdate (`lib/understanding-dark-engine/candidate-bridge-dark-run-persistence.ts`). First successful family wins.

### Eligibility and runtime state (fact)

- Pure helper: `evaluateNoWriteDarkRunTriggerEligibility` (`lib/understanding-dark-engine/no-write-trigger-eligibility.ts`)
- Runtime loader: `resolveCandidateBridgeNoWriteTriggerEligibility` (`lib/understanding-dark-engine/no-write-trigger-runtime-state.ts`)
- Default cooldown: **30 seconds** (`DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS`)
- Suppression reasons: cooldown, in-flight, no-new-evidence, blocked event type
- Runtime state load is **fail-open** on DB error (bridges proceed without cooldown/in-flight gates)

### Not production candidate creation (fact)

| Path | Role |
|------|------|
| `GET /api/internal/understanding-dark-run/no-write` | No-write orchestrator + harness only; **no persistence** |
| `scripts/run-candidate-creation-runtime-validation.ts` | Dev/ops validation; `manual_internal` + `--execute` only |
| Discovery scanners | Read-only dry-run; no `--execute` |
| Fixture seed scripts | Dev fixture tooling; not production generation |
| Lane validators | Dev review/publish proof; not production triggers |
| `journal_entry_saved` / `quick_check_in_saved` | Allowlisted in eligibility helper only; **not wired** to bridges |

### No scheduler / no automatic backfill (fact)

- No cron/scheduler runs dark-engine candidate creation
- No automatic rerun for imports that completed before bridge wiring
- PR #51 root cause documented: event-only triggers; import predating bridge

---

## 3. What is production vs validation/dev tooling

| Tool / path | Classification | Production candidate creation? |
|-------------|----------------|--------------------------------|
| APP message bridge | **Production** | Yes (when eligible) |
| Import-completion bridge | **Production** | Yes (when eligible) |
| `run-candidate-creation-runtime-validation.ts` | **Dev/ops validation** | Only with `--execute` + `manual_internal`; **not production backfill** |
| `discover-investigation-candidate-proposal.ts` | **Dev discovery** | No (dry-run only) |
| `discover-candidate-family-proposals.ts` | **Dev discovery** | No (dry-run only) |
| `seed-lower-family-validation-fixtures.ts` | **Dev fixture** | No |
| `validate-*-candidate-*-flow.ts` | **Dev validation** | No (lane proof only) |
| `report-candidate-lifecycle-diagnostics.ts` | **Dev diagnostics** | No (read-only) |

---

## 4. Policy decision table

| Policy item | Decision | Phase 2 close impact |
|-------------|----------|----------------------|
| **APP message trigger** | **ACCEPTED** (official production trigger) | Required foundation — validated via UserMap natural path |
| **Import-completion trigger** | **ACCEPTED** (official production trigger) | Required foundation — wired and documented |
| **Scheduler / cron dark-run** | **DEFERRED beyond Phase 2** | Not required before Phase 2 close |
| **Automatic historical backfill** | **DEFERRED beyond Phase 2** (not required for close) | Not required before Phase 2 close |
| **Manual backfill** | **DEV-ONLY** (explicit ops scripts; not production policy) | `run-candidate-creation-runtime-validation.ts --execute` is not production backfill |
| **Internal operator backfill button** | **NOT REQUIRED before Phase 2 close** | Deferred product surface |
| **Retry / trailing-pending (`shouldMarkPending`)** | **DEFERRED beyond Phase 2** | Not a Phase 2 close blocker |
| **Weaken gates to force lower-family generation** | **REJECTED** | Forbidden |
| **Fixture seed as production trigger** | **REJECTED** | Forbidden |
| **Discovery scanners as production trigger** | **REJECTED** | Forbidden |

### Options evaluated

| Option | Verdict |
|--------|---------|
| **A — Event-only sufficient for Phase 2 close** | **Accepted as core policy** |
| **B — Scheduler/backfill required before close** | **Rejected** — out of scope; higher risk; not required by validated foundation |
| **C — Event-only now; scheduler/backfill deferred phase** | **Selected** — combines A's safety with explicit deferral record |

**Justification for Option C:**

1. UserMap natural/live validation already proves the event bridge → persistence → review → publish loop on real local data.
2. Code implements and documents event-only production paths; adding scheduler/backfill is a **new product surface**, not a missing Phase 2 mechanic.
3. Historical import gap is a **known, documented consequence** of event-only design (PR #51), not an undocumented bug.
4. Lower-family natural absence on current data is **precedence + evidence profile**, not evidence that scheduler/backfill would fix without gate changes.
5. Deferral must be **explicit in ledger** so Phase 2 close does not silently imply time-based generation exists.

---

## 5. Event-only generation policy

**Official Phase 2 production policy:**

Candidate creation occurs **only** when a qualifying production event fires:

1. A persisted APP user message on `journal_chat` or `explore_chat` (`app_user_message`)
2. A successful import completion (`import_completed`)

Each event runs eligibility → no-write dark run → harness → four-family persistence ladder.

**Implications:**

- Users who only have historical `IMPORTED_ARCHIVE` sessions and no new APP messages or re-imports may have **zero candidates** until a new qualifying event occurs.
- This is **accepted behavior** for Phase 2 close, not a defect requiring silent backfill.
- New evidence after bridge deployment is picked up on the **next qualifying event**, subject to eligibility gates.

---

## 6. Scheduler / cron decision

| Question | Decision |
|----------|----------|
| Does Phase 2 require automatic dark-run scheduling? | **No** |
| Is scheduler required before Phase 2 close? | **No — deferred beyond Phase 2** |
| Status | **NOT IMPLEMENTED**; explicitly deferred to a future **Scheduled Dark-Run / Time-Based Candidate Generation** phase |

**Future phase must define (when undertaken):** frequency, evidence window, duplicate/race policy, retry behavior, operator visibility, allowlist, and interaction with existing event bridges.

---

## 7. Historical backfill decision

| Question | Decision |
|----------|----------|
| Does Phase 2 require automatic historical backfill of old imports? | **No** |
| Should old imports before bridge wiring remain as-is? | **Yes** — unless a new qualifying event occurs or explicit governed dev/ops action is taken |
| Is automatic historical backfill required before Phase 2 close? | **No — deferred beyond Phase 2** |
| Status | **NOT IMPLEMENTED**; deferred to future **Governed Backfill** phase |

**Forbidden:** silent backfill of old imports without a governed policy and ledger record.

---

## 8. Manual / operator backfill decision

| Mechanism | Allowed? | Classification |
|-----------|----------|----------------|
| `run-candidate-creation-runtime-validation.ts --execute` | **Dev/ops only** | Uses `manual_internal` override; bypasses production cooldown semantics; **not production backfill** |
| Discovery scanners `--execute` | **Not available** | Dry-run only |
| Fixture seed `--execute` | **Dev fixture only** | Not production; not natural validation |
| Internal operator backfill button/UI | **Not required before Phase 2 close** | Deferred product decision |
| Production backfill via weakening gates | **Forbidden** | — |

**Policy:** Manual scripts may be used for **dev validation and diagnostics** only, with explicit warnings. They must **not** be described or operated as production backfill mechanisms.

**Specific warning (preserve):** Do **not** run `run-candidate-creation-runtime-validation.ts --execute` on the current dev user for lower-family natural validation — it creates or duplicates **UserMap**, not Investigation/Fieldwork/ModelUpdate.

---

## 9. Import completion behavior

**Policy:**

- Import-completion bridge runs **once per successful import completion** (after pattern batch), not per chunk or per message.
- Eligibility applies: cooldown, in-flight, no-new-evidence.
- Imports that completed **before** candidate bridge wiring do **not** automatically receive retroactive candidate creation.
- Re-import or new import after bridge deployment **may** create candidates if harness passes and precedence allows.

**Accepted gap:** Legacy complete imports without subsequent events remain without candidates until new evidence events occur.

---

## 10. APP message behavior

**Policy:**

- Bridge runs only for persisted **user** messages (not assistant/system) on eligible APP sessions.
- Surfaces: `journal_chat`, `explore_chat` only.
- Imported sessions, non-APP origins, and unsupported surfaces are **skipped** (`skipped_unsupported_session`).
- Eligibility applies before dark run.
- Four-family ladder applies; UserMap precedence stands.

---

## 11. Cooldown / in-flight / no-new-evidence behavior

| Suppression | Production behavior today | Phase 2 policy |
|-------------|---------------------------|----------------|
| **Cooldown** (default 30s) | Event skipped; no dark run | **Accepted** — event may be dropped |
| **In-flight** | `mark_trailing_pending`; `shouldMarkPending: true` returned | **Accepted drop** — retry **not wired** in candidate bridge |
| **No-new-evidence** | Event skipped | **Accepted** — prevents redundant runs |
| **Runtime state load failure** | Fail-open; eligibility proceeds without gates | **Accepted risk** — documented; not Phase 2 close blocker |

### `shouldMarkPending` unused — close blocker?

**No.** Trailing-pending retry semantics are **deferred beyond Phase 2**. Native derivation has separate trailing-pending behavior; candidate bridge does not consume `shouldMarkPending` today. This is **retry-policy enhancement**, not missing Phase 2 foundation.

---

## 12. Lower-family natural generation implication

| Question | Answer |
|----------|--------|
| Does lack of natural lower-family generation require scheduler/backfill? | **No** |
| Is it a data/profile outcome? | **Yes** — on current local user: `userMap=true`, lower families `false` |
| Does event-only policy explain it? | **Yes** — UserMap precedence + abstain/framing gates |
| Does fixture-backed validation substitute for natural claims? | **No** — fixture-backed only for mechanics proof |

**Preserve:**

- Lower-family fixture-backed validation: **COMPLETE**
- Lower-family natural validation: **BLOCKED / NOT COMPLETE**
- Do not weaken gates to force lower-family candidates
- Do not reinterpret fixture-backed validation as natural validation

---

## 13. Phase 2 closeout impact

### Agent 22 blocker clearance

| Blocker | Status after this contract |
|---------|---------------------------|
| **#1 Production trigger/backfill policy locked** | **CLEARED** |
| **#2 Scheduler/backfill accept-or-defer explicit** | **CLEARED** (both **deferred beyond Phase 2**) |
| **#3 ModelUpdate dismiss/reject/archive policy** | **OPEN** |
| **#4 Expiry/stale candidate policy** | **OPEN** |
| **#5 Duplicate uniqueness/race-window policy** | **OPEN** |
| **#6 Formal Phase 2 acceptance criteria in ledger** | **OPEN** |
| **#7 POST manual-create governance** | **OPEN** |

### Phase 2 closeout wording after this contract

Use this wording in ledger and closeout artifacts:

> **Production candidate generation policy (Phase 2):** Event-only. Official triggers are APP `journal_chat`/`explore_chat` user messages and successful import completion. Scheduler/cron and automatic historical backfill are **deferred beyond Phase 2**, not required for umbrella close. Manual dev scripts are not production backfill. Lower-family fixture-backed validation is **complete**; lower-family natural validation remains **blocked / not complete** on current data. Phase 2 umbrella remains **PARTIAL** until remaining lifecycle/governance blockers are locked.

### Can Phase 2 close now?

**No.** This contract clears two of seven must-fix blockers. Five remain.

### Recommended next slice

**Candidate Lifecycle Operations Policy Contract** (docs-only) — locks ModelUpdate dismiss, expiry/stale, and duplicate uniqueness policies (Agent 22 blockers #3–#5).

---

## 14. Deferred implementation (beyond Phase 2)

| Item | Deferred to |
|------|-------------|
| Scheduler / cron dark-run execution | Future scheduled-generation phase |
| Automatic historical backfill | Future governed-backfill phase |
| Trailing-pending retry for candidate bridge | Future retry-policy phase |
| Internal operator backfill UI | Future ops/product phase |
| `journal_entry_saved` / `quick_check_in_saved` bridge wiring | Future trigger-expansion phase (if approved) |

Implementation of deferred items is **not** authorized by this contract.

---

## 15. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Users with only pre-bridge imports have zero candidates | Documented accepted gap; new events or future governed backfill phase |
| Events dropped under cooldown/in-flight | Documented; deferred retry policy |
| Fail-open runtime state load | Documented; monitor; not Phase 2 blocker |
| Dev `--execute` scripts misused as production backfill | Forbidden in this contract; ledger warnings preserved |
| Phase 2 close implied scheduler exists | Explicit deferral in decision table and closeout wording |
| Lower-family natural absence blamed on missing scheduler | Contract records precedence/data-profile explanation |
| Silent import backfill | Forbidden without governed policy |

---

## 16. Forbidden interpretations

This contract must **not** be read to:

- Claim Phase 2 umbrella is **complete**
- Claim natural lower-family validation is **complete**
- Reclassify fixture-backed validation as natural validation
- Authorize `run-candidate-creation-runtime-validation.ts --execute` as production backfill
- Treat discovery scanners or fixture seed scripts as production triggers
- Weaken candidate gates to force lower-family natural generation
- Silently backfill old imports without a governed future policy
- Require scheduler/backfill implementation in Phase 2 close slice
- Imply trailing-pending retry exists in production candidate bridge

---

## Policy question answers (summary)

| # | Question | Answer |
|---|----------|--------|
| 1 | Are APP + import-completion bridges enough for Phase 2 close? | **Yes** (with remaining non-trigger blockers locked) |
| 2 | Does Phase 2 require automatic dark-run scheduling? | **No — deferred beyond Phase 2** |
| 3 | Does Phase 2 require historical backfill of old imports? | **No — deferred beyond Phase 2** |
| 4 | Should old pre-bridge imports remain as-is? | **Yes** |
| 5 | Should dev validation scripts be production backfill? | **No — dev-only** |
| 6 | Internal operator backfill button before close? | **Not required** |
| 7 | Cooldown/in-flight/no-new-evidence? | **Accepted suppression; events may drop** |
| 8 | `shouldMarkPending` unused — close blocker? | **No — deferred retry policy** |
| 9 | Lack of natural lower-family → need scheduler/backfill? | **No — data/profile + precedence** |
| 10 | Phase 2 closeout wording? | See §13 |

---

## Supporting references

- `docs/phase2-umbrella-closeout-decision-contract.md`
- `docs/lower-family-dev-validation-fixture-strategy.md`
- `docs/engineering-ledger.md` — PR #51 closeout, fixture closeout, umbrella contract
- `lib/understanding-dark-engine/no-write-trigger-eligibility.ts`
- `lib/understanding-dark-engine/no-write-trigger-runtime-state.ts`
- `lib/understanding-dark-engine/app-message-candidate-bridge.ts`
- `lib/understanding-dark-engine/import-completion-candidate-bridge.ts`
- `lib/candidate-creation-runtime-validation.ts`
