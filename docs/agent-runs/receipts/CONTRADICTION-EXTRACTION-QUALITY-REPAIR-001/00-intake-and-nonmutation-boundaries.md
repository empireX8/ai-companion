# 00 — Intake and non-mutation boundaries

**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Phase:** A — read-only architecture trace and bounded repair plan
**Branch:** `desktop-contradiction-extraction-quality-repair-001`
**Baseline:** staging @ `b0eab12`
**Run date:** 2026-07-20

---

## Purpose

Establish the exact bounded implementation required to prevent false `ContradictionNode` candidates and preserve truthful dual-side provenance. Preceding genuine acceptance proof (SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001) failed because **0 / 25** pending ContradictionNodes were proof-eligible after strict semantic review.

---

## Controlling receipts

| Receipt | Role |
|---------|------|
| `INTELLIGENCE-COMPATIBILITY-AUDIT-001/` | Import write path, live entry paths, account inventory |
| `CONTRADICTION-MAP-CONFLICT-PROJECTION-001/` | Map reads `status=open` only; candidates excluded |
| `SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001/` | 25-candidate audit, detector defects, accept path trace |

---

## Confirmed defect families (from 25-candidate audit)

| Class | Count | Proof-eligible |
|-------|------:|----------------|
| A. Clear contradiction | 0 | 0 |
| B. Plausible unresolved tension | 2 | 0 |
| C. Compatible states — overinterpreted | 13 | 0 |
| D. Insufficient or misaligned context | 10 | 0 |

Root causes documented in `11-contradiction-detector-quality-defect.md`:

1. Cross-session user-wide ReferenceItem pairing (17 / 25 cross-session)
2. Generic `"but i"` substring detection (all 3 constraint_conflict + several goal pairs)
3. Token overlap treated as semantic eligibility
4. Omitted qualifiers (partial compliance, hedges)
5. Compatible states treated as contradictions
6. Goal/obstacle and intention/outcome relationships treated as contradictions
7. CN row `sourceSessionId` / `sourceMessageId` represent Side B only
8. Inspector / Import review may overstate session-local dual-side lineage

---

## Phase A allowed changes

**Only** files under:

`docs/agent-runs/receipts/CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001/`

Read-only helper scripts may live in that directory.

---

## Phase A forbidden

| Forbidden | Reason |
|-----------|--------|
| Product code changes | Phase A is trace + plan only |
| Test changes | No repair implementation |
| Migrations | Schema decision deferred to slice plan |
| Kay database mutation | Preserve account gate |
| Accept/reject candidates | No status changes |
| Reprocess 25 existing candidates | No bulk supersession |
| Commit or push | Phase A deliverable is documentation |
| Decision POST calls | `POST /api/import-review/candidates/[key]/decide` |
| Timestamp-only edits to earlier receipt dirs | Campaign file boundary |

---

## Account gate to preserve

| Check | Expected |
|-------|----------|
| Pending candidates (total) | 53 |
| ReferenceItem pending (import) | 28 |
| ContradictionNode pending (import) | 25 |
| Open genuine ContradictionNodes | 0 |
| PatternClaims | 7 |
| ModelUpdates | 1 |
| UnderstandingEvidenceLinks | 50 |
| Chicken-burger ReferenceItem | active (`3a6163dd-0f85-4bf5-8eb8-924579f1db62`) |
| Candidate status changes | none |

---

## Production readiness

**NO** — Phase A produces architecture and slice plan only.

---

## Architecture clarification (receipts only)

Controlling correction after initial Phase A plan:

- Contradictions are the **first** object type through a reusable **Orvek Intelligence Kernel** — not a contradiction-only pipeline to duplicate later.
- Matching policy is **zero-or-one eligible** same-session selection (not forced best-match).
- Exact Side A **span-level** provenance is required (Design A or B).
- CEQR-001 is **model-assisted** semantic adjudication, not regex enlargement.
- Existing 25: unchanged; no Accept/Reject/archive authorised by Phase A.

See `11-shared-intelligence-kernel-architecture.md`, `12-objectivity-referee-gap-and-integration.md`.

---

## Phase A deliverables

| File | Task |
|------|------|
| `00-intake-and-nonmutation-boundaries.md` | This file |
| `01-current-contradiction-write-paths.md` | Write path inventory |
| `02-detector-and-classifier-trace.md` | Detector behaviour |
| `03-dual-side-lineage-and-schema-audit.md` | Schema verdict + span provenance |
| `04-target-semantic-contract.md` | Model-assisted classification contract |
| `05-cross-session-pairing-policy.md` | Zero-or-one same-session policy |
| `06-existing-candidate-treatment-plan.md` | Existing 25 policy (no archive authorised) |
| `07-bounded-repair-slice-plan.md` | Implementation slices + CEQR-005 gate |
| `repair-slice-plan.json` | Machine-readable slice plan |
| `08-required-test-matrix.md` | Test matrix |
| `09-controlled-natural-entry-proof-design.md` | Later proof design |
| `10-phase-a-nonmutation-gate.md` | Before/after/clarify gate |
| `11-shared-intelligence-kernel-architecture.md` | Shared kernel stages |
| `12-objectivity-referee-gap-and-integration.md` | Referee gap |
| `readonly-phase-a-account-gate.mjs` | Read-only gate script |
