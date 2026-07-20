# 00 — Intake and hard boundaries

**Campaign:** SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001
**Phase:** A only — read-only candidate shortlist and pre-mutation gate
**Branch:** `desktop-single-real-contradiction-proof-001` @ `9883c41`
**Queried:** 2026-07-20T08:32:48Z (inventory before) · 2026-07-20T08:35:00Z (inventory after, see `07`)
**Mode:** read-only — no accept/reject, no POST decide, no DB writes
**Final outcome (2026-07-20):** **FAIL — NO TRUSTWORTHY CONTRADICTION CANDIDATE FOUND** — see `13-wave-2-1-controlling-result.md`

---

## Purpose

Prove the complete genuine-data pathway for **exactly one** imported `ContradictionNode` (deferred to Phase B+ after human lock). Phase A establishes baseline, traces landed code, shortlists candidates, recommends one, and returns to Kay **before** any human Accept.

---

## Controlling receipts

| Receipt | Role |
|---------|------|
| `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/` | Account gate, wave sequencing |
| `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/15-wave-sequencing-clarification.md` | Wave 1.1 prerequisite resolved; Wave 2.1 safety contract |
| `docs/agent-runs/receipts/CONTRADICTION-MAP-CONFLICT-PROJECTION-001/` | CN→Map Active conflicts projection + human click gate PASS |

---

## Hard boundaries (Phase A)

| Rule | Status |
|------|--------|
| Exactly one genuine CN may eventually be accepted | Enforced — recommendation only, no lock |
| No ReferenceItem acceptance | Enforced |
| No second ContradictionNode | Enforced |
| No reject action | Enforced |
| No automatic mutation (script/test/hook/dev route) | Enforced |
| No product code changes | Enforced |
| No schema/migration changes | Enforced |
| No synthetic/reference cleanup | Enforced |
| No broad mock removal | Enforced |
| No goals / ProfileArtifact / uploader / Timeline / unrelated repair | Enforced |
| No `npm audit fix` | Enforced |
| Production readiness | **NO** |

---

## Worktree state at intake

| Check | Result |
|-------|--------|
| Branch | `desktop-single-real-contradiction-proof-001` |
| HEAD | `9883c41ff13fa87298107582d8df14dfefb6a472` |
| Working tree | Clean (no staged product changes) |
| Decision POST endpoint called | **NO** |
| Kay DB mutated | **NO** |

---

## Phase A deliverables

| File | Purpose |
|------|---------|
| `00-intake-and-hard-boundaries.md` | This document |
| `01-before-state-account-gate.md` | Live inventory gate |
| `02-landed-acceptance-path-trace.md` | Code-path documentation |
| `03-readonly-candidate-shortlist.md` | Top-5 CN shortlist |
| `candidate-shortlist.json` | Machine-readable shortlist |
| `04-recommended-candidate.md` | Human recommendation |
| `05-expected-after-state.md` | Bounded mutation forecast |
| `06-human-acceptance-runbook.md` | Future human steps (no Accept in Phase A) |
| `07-phase-a-nonmutation-verification.md` | After gate = before gate |
| `readonly-contradiction-candidate-shortlist.mjs` | Read-only shortlist script |

---

## Database access note

Initial inventory failed against a stopped Postgres. **Docker `companion-db`** (postgres:16 on `localhost:5432`) was started; brew `postgresql@16` was stopped to avoid port conflict. All queries were **SELECT/COUNT only**.
