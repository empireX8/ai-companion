# 12 — Objectivity Referee gap and integration

**Phase:** A — architecture gap analysis (receipts only; no implementation)
**Purpose:** Distinguish what exists today from the planned shared AI Objectivity Referee in the Orvek Intelligence Kernel.

---

## Summary

| Layer | Exists today? | Scope today | Shared kernel referee? |
|-------|---------------|-------------|------------------------|
| Deterministic objectivity gates | **Yes** | Primarily UserMapConclusion / ModelUpdate dark-engine | Partial predecessor — not shared CN referee |
| Reality-tracking output contract | **Yes** | Report / What Changed evidence statuses | Read/report consumer — not candidate referee |
| Deterministic fallback reports | **Yes** | Reality report builders when live data thin | Presentation fallback — not semantic referee |
| Dark-engine evaluation | **Yes** | No-write / candidate proposal / pass / pass_with_cap / abstain | Object-family specific — UMC, MU, investigation, fieldwork bridges |
| Shared AI Objectivity Referee | **No** | — | **Planned** — kernel stage 5 |

---

## What currently exists

### 1. Deterministic objectivity gates

**Location:** `lib/understanding-dark-engine/objectivity-gates.ts`

- `evaluateUserMapConclusionObjectivityGates`
- `evaluateModelUpdateObjectivityGates`

**Nature:** Deterministic code gates (evidence spread, emotion/identity caps, single-episode blocks, etc.) — **not** a shared AI referee across all object types.

**Consumed by:** Dark-run evaluator and candidate proposal/persistence paths under `lib/understanding-dark-engine/`.

**Does not today:** Adjudicate ContradictionNode candidates from import/live marker detection.

### 2. Reality-tracking output contract

**Location:** `lib/reality-tracking-output-contract.ts` (+ `lib/what-changed-reality-report.ts`)

**Nature:** Allowed evidence statuses and report field contracts for reality-tracking / What Changed surfaces.

**Role:** Constrains **report output** from stored intelligence — does not replace pre-persistence Objectivity Referee for new candidates.

### 3. Deterministic fallback reports

**Nature:** Report builders can emit contracted fallback / limited-evidence states when composition or evidence is insufficient.

**Role:** User-facing honesty on read path — **not** contradiction extraction quality control.

### 4. Current dark-engine evaluation

**Locations:** `lib/understanding-dark-engine/dark-run-evaluator.ts`, proposal/persistence modules, no-write orchestrator.

**Decisions (UMC-shaped):** roughly `pass` | `pass_with_cap` | `abstain` with rejection reason codes.

**Role:** Object-family pipeline for understanding candidates (User Map, model updates, related bridges). Closest living ancestor of a referee — but **not** the shared kernel Objectivity Referee, and **not** wired into current ContradictionNode create path (`detectContradictions` → `materializeContradictions`).

---

## What does not exist

| Missing | Gap |
|---------|-----|
| Shared Objectivity Referee interface across object types | No single stage-5 contract |
| ContradictionNode referee outcomes before materialization | Marker path creates CN without referee |
| ROUTE_TO_DIFFERENT_OBJECT_TYPE as shared outcome | Dark-engine has object-specific abstain/hold patterns, not shared routing enum |
| Referee that cannot be bypassed by skipping deterministic validation | Not enforced on CN path |
| Versioned referee audit receipt for CN | Not present |

---

## Planned shared Objectivity Referee

### Evaluates candidate objects for

- Evidence sufficiency
- Correct object routing
- Logical coherence
- Preserved qualifiers
- Temporal and contextual compatibility
- Alternative explanations
- Confidence calibration
- Exact provenance
- Duplicate or competing objects
- High-emotion over-weighting
- Unsupported identity claims
- Whether persistence would overstate what is known

### Allowed outcomes

| Outcome | Meaning |
|---------|---------|
| **PASS** | Persist at proposed confidence |
| **PASS_WITH_LOWER_CONFIDENCE** | Persist with reduced confidence |
| **ROUTE_TO_DIFFERENT_OBJECT_TYPE** | Do not persist as proposed type; return to router/adjudicator |
| **REQUEST_MORE_EVIDENCE** | Hold / no durable write |
| **ABSTAIN** | No object |

### Hard boundary

**The referee must not directly bypass deterministic persistence validation** (kernel stage 6): span validation, schema permissions, same-session / zero-or-one rules, no orphan refs, no fabricated evidence.

Referee PASS still requires stage 6 success.

### Design constraint

Do **not** implement the referee as one opaque all-powerful prompt that replaces object-specific adjudicators or deterministic gates. Prefer:

- Structured AI evaluation against a fixed checklist, **plus**
- Deterministic gates for provenance/schema, **plus**
- Object-specific adjudicators for eligibility

---

## Integration with ContradictionNode (this campaign)

| Stage | Contradiction path |
|-------|--------------------|
| Nomination | Markers/overlap (retrieval only) |
| Adjudication | Contradiction-specific model-assisted contract (`04`) |
| Referee | Shared interface — first consumer: CN candidates |
| Validation | Exact dual spans, schema, zero-or-one |
| Persist | `candidate` only when PASS / PASS_WITH_LOWER_CONFIDENCE |

Existing 25: **not** retroactively refereed into repaired objects (`06`).

---

## Relationship to latency tiers

Referee runs on **Tier 3** (promotion / persistence gate), not on every page view. Immediate capture remains sync-free of full referee. See `11-shared-intelligence-kernel-architecture.md`.

---

## Production readiness

**NO** — gap documented; referee not implemented.
