# 06 — Existing candidate treatment plan

**Phase:** A — policy for the 25 pending ContradictionNodes (read-only)
**Constraint:** Do not mutate status, reprocess, accept, reject, or present old candidates as newly repaired objects.

---

## Current cohort facts

| Metric | Value |
|--------|-------|
| Total pending CN (import) | 25 |
| Class A (clear contradiction) | 0 |
| Class B (plausible tension) | 2 |
| Class C (compatible — overinterpreted) | 13 |
| Class D (insufficient / misaligned) | 10 |
| Proof-eligible | 0 |
| Cross-session | 17 |
| Open genuine CN | 0 |

Audit source: `SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001/09-all-candidate-semantic-lineage-audit.md`

---

## Phase A authorisation lock (controlling)

| Action | Authorised by Phase A? |
|--------|------------------------|
| Leave all 25 unchanged | **Yes** — required |
| Exclude all 25 from repaired Wave 2.1 proof | **Yes** — required |
| Read-only reclassification JSON (no DB write) | Later slice only; still no status change |
| Accept any of the 25 | **No** |
| Reject any of the 25 | **No** |
| Bulk transition of any kind | **No** |
| Transition to `archived_tension` or any archive/supersede status | **No** |
| Assume a disposition status exists / is the correct cleanup path | **No** |
| Treat deploy of repaired intelligence as transforming old rows into repaired objects | **No** |

### On “archived_tension” as a concept

`archived_tension` may be discussed **only** as a **possible future disposition concept**.

Phase A states explicitly:

1. **No `archived_tension` status transition is authorised by Phase A.**
2. **Do not assume** that any archive disposition is available, correct, or product-approved for this cohort — any archive, supersede, or reclassification **status** requires a **separate** schema, product, and human-review decision.
3. **No bulk transition is authorised.**
4. **No Accept or Reject action is authorised** for the 25 in this campaign.
5. All 25 **remain unchanged** in the database.
6. All 25 **remain excluded** from the repaired Wave 2.1 proof.
7. Deploying repaired intelligence **does not** transform old candidates into repaired objects.
8. Any later reclassification (read-only receipt or future disposition) must remain **visibly distinct** from new kernel extraction (e.g. `preRepairCohort` / `createdAt` before deploy / explicit audit label).

---

## Recommended treatment (multi-step; later phases only)

### Step 1 — Leave pending; exclude from repaired proof (immediate — Phase A)

| Action | Detail |
|--------|--------|
| Status | Remain `candidate` — **no** Accept, Reject, archive, or bulk change |
| Wave 2.1 proof | **Excluded** |
| Detector / kernel repair | Changing code does **not** alter these rows |
| UI | Import review may still show them — must not imply they were produced by the repaired kernel |

### Step 2 — Read-only reclassification (later slice, no DB writes)

| Action | Detail |
|--------|--------|
| Deliverable | Receipt JSON under this campaign directory |
| Output | Per-id Class A/B/C/D under target semantic contract |
| DB | **No mutation** |
| Label | Output must mark cohort as **pre-repair / pre-kernel** |

### Step 3 — Individual human review (future; not authorised now)

| Action | Detail |
|--------|--------|
| Who | Kay only — not automated |
| Options | Deferred until a separate authorised campaign defines allowed dispositions |
| Forbidden now | Accept, Reject, archive, supersede, bulk cleanup |

### Step 4 — Controlled bulk disposition (deferred; explicit Kay gate)

| Action | Detail |
|--------|--------|
| When | Only after separate product/schema/human decision |
| Forbidden | Auto-disposition on detector or kernel deploy |

### Step 5 — Regeneration from original evidence (not recommended)

| Action | Detail |
|--------|--------|
| Verdict | **Defer** — not in-place regeneration of the 25 |

---

## What must not happen

| Forbidden | Reason |
|-----------|--------|
| Accept any of the 25 to force Wave 2.1 proof | 0 proof-eligible; false open conflicts |
| Reject / archive / supersede without separate authorisation | Campaign boundary |
| Bulk transition | Not authorised |
| Reprocess import on Kay account during repair | Mutates candidate set |
| Present as “repaired” after code change | Old rows retain pre-repair semantics |
| Delete without explicit slice | Destructive |

---

## Relationship to new candidates

After repaired kernel ships:

1. **New** candidates use post-repair shared-kernel rules.
2. **Old** 25 remain distinguishable as pre-repair cohort.
3. Wave 2.1 proof uses **new** trustworthy candidate only (CEQR-012).

---

## Near-miss handling (Class B × 2)

| id | Classification | Treatment |
|----|----------------|-----------|
| `cmp2fvtbb00a…` | B — same-session reading tension | Leave unchanged; do not accept as contradiction |
| `cmp2fvtjy00b…` | B — partial compliance / effectiveness doubt | Same |

These are **not** contradictions under target contract — do not upgrade to proof.

---

## Summary policy

**Primary:** All 25 remain unchanged; excluded from proof; deploy does not repair them; any future disposition requires separate authorisation.

**Not authorised by Phase A:** Accept, Reject, `archived_tension`, bulk archive, supersession, regeneration.

**Production readiness:** Treating this cohort as genuine conflicts = **NO**.
