# MindLab Phase 2 — Umbrella Closeout Decision Contract

**Status:** CONTRACT CREATED / READY FOR GOVERNANCE REVIEW  
**Date:** 2026-06-10  
**Scope:** Docs-only decision contract. No code, schema, routes, UI, mobile, DB mutations, script execution, or candidate creation.

**Validation base:** `main @ 729eddc — Record lower-family fixture validation closeout`  
**Audit input:** Agent 21 read-only Phase 2 post-validation foundation audit (no code changes)

---

## 1. Executive verdict

**Phase 2 cannot be called complete today.**

Substantial Phase 2 foundation is **validated and operational** for the candidate loop mechanics that have been built: dark-engine proposal/gating, four-family internal persistence, internal operator review/publish, public projection guards, UserMap natural validation, and lower-family **fixture-backed** validation.

However, the official Phase 2 umbrella remains **`PARTIAL`** because unresolved **production policy decisions** and **documented implementation gaps** have not been accepted, deferred with explicit ledger record, or closed in a formal umbrella acceptance artifact.

**This contract's decision:**

| Question | Answer |
|----------|--------|
| Can Phase 2 close now? | **No** |
| Is lower-family natural validation a hard close blocker on the current local dataset? | **No** — blocked by UserMap precedence and data profile, not proven broken mechanics |
| What blocks closure instead? | Policy locks + explicit defer/accept decisions + ledger acceptance criteria (see §5–§8) |

**Correct status wording (required):**

- Lower-family fixture-backed validation: **COMPLETE**
- Lower-family natural validation: **BLOCKED / NOT COMPLETE**
- Phase 2 umbrella: **PARTIAL** — pending umbrella closeout criteria and unresolved production policy decisions

---

## 2. Validated foundation

The following are **complete** and may be cited in closeout evidence without overclaiming.

### Natural validation

| Lane | Status | Evidence |
|------|--------|----------|
| UserMap create → review → publish | **COMPLETE** (natural/live) | PR #50–#52; candidate `cmq6frqdx0000ql8h6nkavzue`; meaningful `conclusion_added` ModelUpdate |

### Fixture-backed validation (dev fixtures; not natural production)

| Lane | Status | Evidence |
|------|--------|----------|
| Investigation review → publish | **COMPLETE** | Fixture `cmq7xttgo0000qlwzet7g6j5f`; hold → promote → publish; Active Questions; `investigation_opened` `cmq7y0mq30000ql7yb85mq9q8` |
| Fieldwork review → publish | **COMPLETE** | Fixture `cmq7xttjg0003qlwzk3qmbq5j`; hold → promote → publish; Watch For; `fieldwork_assigned` `cmq7yc1nj0000qlau293mb1cz` |
| Independent ModelUpdate publish | **COMPLETE** | Fixture `cmq7xttlh0006qlwzprysfdlu`; publish-only; `link_detected`; What Changed visible |

### Implementation (mechanics)

| Area | Status |
|------|--------|
| Dark-engine no-write chain (2A–2H) | Complete |
| Four-family proposal + bridge persistence ladder | Complete / runtime validated |
| Evidence-link public leak guard | Complete |
| Internal four-family operator workbench (`/internal/user-map/review`) | Complete |
| Event-only production triggers (APP message + import completion) | Complete |
| Public projection (Your Map, Active Questions, Watch For, What Changed, Today, Timeline) | Broadly complete with tested guards |
| Discovery scanners (read-only) | Complete |
| Fixture seed + lane validators (dev tooling) | Complete |

### Related commits (validation arc)

- `189f7ae` — lower-family fixture seed preflight
- `46bdb2c` — lower-family fixture seed execute mode
- `c71bbe6` — Fieldwork candidate validation script
- `2f9fe82` — ModelUpdate candidate validation script
- `729eddc` — lower-family fixture validation closeout

Investigation lane validator pre-existed and was reused for fixture-backed execute validation.

---

## 3. Not yet complete

| Item | Current state | Category |
|------|---------------|----------|
| Natural lower-family validation | **BLOCKED / NOT COMPLETE** on current dataset | Validation / data profile |
| Scheduler / cron / automatic dark-run execution | **NOT IMPLEMENTED** | Implementation + policy |
| Automatic historical backfill | **NOT IMPLEMENTED** | Policy + implementation |
| Expiry scheduler / auto stale cleanup | **NOT IMPLEMENTED** | Implementation + policy |
| DB-level duplicate uniqueness | **NOT IMPLEMENTED** | Implementation |
| ModelUpdate reject / archive / expire semantics | **NOT IMPLEMENTED** | Implementation + policy |
| Production trigger/backfill policy | **NOT LOCKED** | Product / governance |
| `POST /api/user-map/conclusions` manual-create governance | **UNRESOLVED** | Product / governance |
| Formal Phase 2 umbrella acceptance closeout | **NOT DONE** | Governance |
| Phase 2E generalized candidate schema migration | **DEFERRED** (`NEED SCHEMA MIGRATION LATER, NOT NOW`) | Intentionally deferred |

---

## 4. Fixture-backed vs natural validation distinction

### Definitions

| Term | Meaning | Claim allowed? |
|------|---------|----------------|
| **Natural validation** | Candidate created through production bridge path (APP message or import completion) or safe natural discovery user under current gates; then reviewed/published through operator mechanics | UserMap: yes. Lower families on current dataset: **no** |
| **Fixture-backed validation** | Dev fixture seeded via `persistInternal*Candidate` helpers with real user-owned evidence; then reviewed/published via lane validators | Lower families: **yes**, with fixture wording only |

### Current natural discovery truth (preserve)

Local user `user_34TUYA53pI1QRLK73O22Kve1a1G`:

| Field | Value |
|-------|-------|
| `proposalPresence.userMap` | `true` |
| `proposalPresence.investigation` | `false` |
| `proposalPresence.fieldwork` | `false` |
| `proposalPresence.modelUpdate` | `false` |

**Interpretation (not a failure):** UserMap precedence and abstain/framing gates explain lower-family absence on this dataset. Fixture-backed validation was required to prove lower-family **review/publish mechanics** without weakening gates.

### Forbidden conflation

- Do **not** reclassify fixture-backed validation as natural validation.
- Do **not** claim lower-family generation naturally works on the current dataset.
- Do **not** treat fixture success as permission to weaken gates, hand-insert rows, or auto-backfill.

---

## 5. Phase 2 closeout criteria

Phase 2 umbrella may be marked **`CLOSED / VALIDATED`** only when **all** of the following are true.

### A. Acceptance criteria documented in ledger

A formal Phase 2 umbrella acceptance closeout entry exists in `docs/engineering-ledger.md` and `docs/mindlab-roadmap-status-ledger.md` listing:

- validated foundation (§2)
- accepted deferrals (§7)
- locked policies (§8)
- remaining non-blocking follow-ons

### B. Production operations policy locked

`docs/phase2-production-trigger-backfill-policy-contract.md` (or equivalent approved artifact) records explicit decisions for:

- event-only vs scheduled dark-run execution
- historical backfill: allowed, forbidden, or manual-only
- operator/dev rerun boundaries (`--execute` scripts, allowlists)

### C. Candidate lifecycle operations policy locked

Explicit decisions recorded for:

- **Expiry / stale candidates:** manual-only vs automated scheduler (if automated, scope and families)
- **ModelUpdate unpublishable candidates:** dismiss/reject/archive semantics (or explicit accept of publish-only indefinite `internal_only` pool)
- **Duplicate uniqueness:** accept app-level dedupe risk vs require DB constraint (and which families)

### D. Governance decisions recorded

- `POST /api/user-map/conclusions` manual-create: keep, restrict, or deprecate — with product rationale
- Natural lower-family validation: explicitly classified as **not required** for Phase 2 umbrella close **or** required with defined alternate acceptance path (e.g., alternate user under current gates)

### E. No false completion claims

Closeout text must preserve §4 distinction and §11 non-goals.

### What is **not** required for Phase 2 close (unless explicitly reclassified in §8)

- Natural Investigation / Fieldwork / independent ModelUpdate validation on `user_34TUYA53pI1QRLK73O22Kve1a1G`
- Phase 2E generalized schema migration (remains deferred per Phase 2E contract)
- Mobile operator review surface
- Unified cross-family operator queue
- Automatic historical backfill **implementation** (decision must be locked; implementation may be deferred)

---

## 6. Must-fix before Phase 2 close

These items must reach **locked decision + ledger record** before umbrella close. Implementation may follow in later slices, but **“we haven't decided yet”** blocks close.

| # | Item | Why it blocks close | Resolution type |
|---|------|---------------------|-----------------|
| 1 | **Production trigger/backfill policy** | Cannot honestly describe how candidates enter production | Docs contract + ledger |
| 2 | **Scheduler / backfill accept-or-defer** | Listed open Phase 2 scope since 2D; must be explicit | Product decision + ledger |
| 3 | **ModelUpdate dismiss/reject/archive policy** | Only family without operator cleanup path | Product decision; may defer implementation if policy accepts publish-only pool |
| 4 | **Expiry / stale candidate policy** | `expired` exists; automation undecided | Product decision + ledger |
| 5 | **Duplicate uniqueness / race-window policy** | Concurrent bridge race acknowledged | Product decision; implementation may be post-close slice if policy accepts interim risk |
| 6 | **Formal acceptance criteria in ledger** | Phase 2 row still `PARTIAL` without umbrella artifact | Docs closeout |
| 7 | **`POST /api/user-map/conclusions` governance** | Bypasses candidate lifecycle; projection safe but governance gap | Product decision + ledger |

### Implementation strongly expected before close (if policy chooses enforcement)

If policy decisions in rows 3–5 choose **automated or structural** enforcement (not manual-only acceptance), corresponding implementation becomes a **pre-close implementation slice**:

- Expiry scheduler (if automation chosen)
- ModelUpdate dismiss route/semantics (if dismiss chosen)
- DB uniqueness migration (if constraint chosen)

If policy chooses **manual-only / accept-risk** alternatives, implementation may be **deferred beyond Phase 2** with explicit ledger wording.

---

## 7. Deferred beyond Phase 2

The following may remain open while Phase 2 closes **only if** explicitly accepted and recorded in the umbrella acceptance closeout.

| Item | Default deferral rationale |
|------|----------------------------|
| Phase 2E generalized candidate schema migration | Phase 2E contract: `NEED SCHEMA MIGRATION LATER, NOT NOW` |
| Natural lower-family validation on current dataset | Evidence-distribution problem; not proven mechanics failure |
| Mobile operator review surface | Phase 6 / ops scope |
| Unified cross-family operator queue | Workbench tabs sufficient |
| Trailing-pending rerun for candidate bridge (`shouldMarkPending` unwired) | Enhancement; not proven production blocker |
| `journal_entry_saved` / `quick_check_in_saved` trigger wiring | Allowlisted but unwired; product scope |
| Validator module deduplication | Maintainability only |
| Dev fixture `[DEV FIXTURE]` cleanup on local DB | Optional dev hygiene |
| Supersede operator UI | Polish |
| Ops runbook for reviewer URL/allowlist | Polish |
| Broader Phase 5 receipt architecture | Phase 5 scope |
| Phase 7 advanced intelligence | Deferred by roadmap |

---

## 8. Product decisions still needed

| Decision | Options (non-exhaustive) | Blocks Phase 2 close? |
|----------|--------------------------|------------------------|
| Production candidate creation model | Event-only (current) vs scheduled execution vs hybrid | **Yes** — must lock |
| Historical backfill | Forbidden vs manual dev-only vs governed production rerun | **Yes** — must lock |
| Natural lower-family validation vs fixture sufficiency | Accept fixture-backed for umbrella close vs require natural user | **Yes** — must lock (recommend: **not** hard blocker on current dataset) |
| ModelUpdate unpublishable pool | Publish-only forever vs dismiss/reject/archive semantics | **Yes** — must lock |
| Stale candidate handling | Manual expire only vs automated scheduler | **Yes** — must lock |
| Duplicate rows under concurrent bridges | Accept app dedupe vs DB uniqueness | **Yes** — must lock |
| Manual POST UserMap conclusions | Keep vs restrict vs deprecate | **Yes** — must lock |
| Scheduler implementation timing | Defer post-close vs require pre-close | **Yes** — accept/defer must be explicit |

---

## 9. Risks if Phase 2 is closed too early

| Risk | Consequence |
|------|-------------|
| Claiming Phase 2 complete without policy locks | Production behavior undefined; false confidence in ops model |
| Conflating fixture-backed with natural validation | Overclaim on lower-family production readiness |
| Closing without duplicate/expiry decisions | Operator pool clutter; race duplicates in production |
| Closing without ModelUpdate dismiss policy | Unpublishable `internal_only` rows accumulate indefinitely |
| Treating fixture success as backfill permission | Gate weakening pressure; integrity loss |
| Ignoring event-only + no-retry semantics | Missed candidates under cooldown without documented acceptance |
| Closing without POST governance decision | Two creation paths with unequal lifecycle discipline |

---

## 10. Recommended next bounded slices

**Immediate next slice after this contract (recommended):**

### Slice 1 — Production Trigger/Backfill Policy Contract (docs-only)

| Field | Value |
|-------|-------|
| Title | Phase 2 Production Trigger/Backfill Policy Contract |
| Why | Unblocks multiple must-fix items (#1, #2); no implementation risk |
| Type | Docs-only |
| Likely files | `docs/phase2-production-trigger-backfill-policy-contract.md`, ledger updates |
| Risk | Low |
| Blocks Phase 2 close? | Resolves blockers when decisions recorded |
| Do not | Implement scheduler/backfill in same slice |

### Subsequent slices (order after Slice 1)

| Priority | Slice | Type | Notes |
|----------|-------|------|-------|
| P2 | Candidate lifecycle operations policy contract (expiry + ModelUpdate dismiss + duplicate policy) | Docs-only | Locks must-fix #3–#5 |
| P3 | ModelUpdate dismiss semantics implementation | Implementation | Only if P2 chooses dismiss path |
| P4 | Expiry scheduler implementation | Implementation | Only if P2 chooses automation |
| P5 | DB duplicate uniqueness migration | Implementation | Only if P2 chooses constraint |
| P6 | POST manual-create governance implementation | Implementation | Only if P2 chooses restrict/deprecate |
| P7 | Phase 2 umbrella acceptance closeout | Docs-only | After must-fix decisions recorded |
| P8 | Natural lower-family validation wait / alternate user scan | Validation | When data exists; not required for umbrella close per this contract |

---

## 11. Non-goals / forbidden claims

This contract and any downstream closeout must **not**:

- Claim Phase 2 umbrella is **complete** today
- Claim natural lower-family validation is **complete**
- Reclassify fixture-backed validation as natural validation
- Claim lower-family generation naturally works on the current dataset
- Propose weakening gates or precedence to force lower-family candidates
- Propose hand-inserting candidate rows for production validation claims
- Propose automatic historical backfill implementation as part of this contract slice
- Propose schema migration in this contract slice
- Treat dev fixture `user_visible` rows as production proof
- Use `run-candidate-creation-runtime-validation.ts --execute` on the current dev user for lower-family natural validation

---

## Contract answers (summary)

| # | Question | Answer |
|---|----------|--------|
| 1 | What counts as Phase 2 complete? | §5 criteria: ledger acceptance artifact + locked production/lifecycle/governance policies + no false claims |
| 2 | Required before close? | §6 must-fix (policy locks minimum; implementation if policy demands enforcement) |
| 3 | Deferred beyond Phase 2? | §7 (explicit ledger acceptance required) |
| 4 | Product decisions vs bugs? | §8; natural lower-family blockage is **not** a bug on current dataset |
| 5 | Complete vs fixture-backed validations? | §2 + §4 |
| 6 | Next slice after this contract? | §10 Slice 1 — Production Trigger/Backfill Policy Contract (docs-only) |

---

## Supporting references

- `docs/engineering-ledger.md` — Lower-Family Fixture-Backed Validation Closeout (2026-06-10)
- `docs/mindlab-roadmap-status-ledger.md` — Phase 2 row + implementation passes
- `docs/lower-family-dev-validation-fixture-strategy.md`
- `docs/step6-phase2-dark-engine-gates-contract.md`
- `docs/phase2e-candidate-storage-policy-contract.md`
- Agent 21 audit report (conversation artifact; read-only, no code changes)
