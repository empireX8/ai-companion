# Chapter Queue

> **Primary queue for product work (LOOP-003).**  
> A **chapter** = one golden object moved **one Product Intelligence Score level**, via bounded slices.

Kay controls order. No smart priority algorithm.

---

## What is a chapter?

| Field | Definition |
|-------|------------|
| **Golden object** | Fixed anchor from `golden-objects.md` |
| **Score movement** | e.g. 2 → 3 (one level only) |
| **Surface** | One coherent product area |
| **Slices** | Max 4 bounded PRs inside the chapter |
| **Closeout** | Kay scores golden object; chapter PASS only if target score reached |

---

## Chapter selection (automation)

1. First chapter with status **In Progress**
2. Else first chapter with status **Ready**
3. Inside chapter: first slice **not** `Done` or `Skipped`

No other ordering logic.

---

## Chapter limits (hard stops)

| Limit | Value | On breach |
|-------|-------|-----------|
| Max slices per chapter | **4** (Max slices: 4) | Close chapter **PARTIAL** if score not reached |
| Max changed lines per slice PR | 800 | Stop; request split |
| Max files touched (chapter cumulative) | 15 | Stop; Kay must replan |
| Max failed verification attempts per slice | 3 | Stop slice; hand off |
| PASS without Kay | — | **Forbidden** |

Additional stops:

- Scope expands outside approved wiring matrix → stop
- Never merge (Kay only)
- Never claim product progress if golden object regressed

---

## CHAPTER-INSPECTOR-001

| Field | Value |
|-------|-------|
| **Chapter ID** | CHAPTER-INSPECTOR-001 |
| **Golden object** | GOLDEN-INSPECTOR-001 |
| **Score movement** | 2 → 3 (Inspectable → Coherent) |
| **Surface** | Workbench Inspector — Evidence / Context + Mind Model Movement |
| **Target state** | Coherent tab roles; readable evidence; no route leakage; no duplicated confusing sections |
| **Base branch** | `staging` if exists; else Kay must create `staging` or `integration` from `main` |
| **Status** | In Progress |
| **Slices used** | 0 / 4 |
| **Files touched** | 0 / 15 |

### Starting slices

| Slice ID | Title | Objective | Status |
|----------|-------|-----------|--------|
| **SLICE-001** | Evidence presentation + route contract closeout | Meaningful evidence cards; in-inspector selection; no legacy `/patterns` leak; scorecard on golden object. DONE on staging via inspector-evidence-contract (`891394a`, `bf8dc39`) | Done |
| **SLICE-002** | Tab boundary cleanup | Evidence = object/context; Movement = epistemic report only; remove overlap | In Progress |
| **SLICE-003** | Movement epistemic report clarity | Facts / inference / uncertainty readable; thin-packet honest; watch-for visible | Queued |
| **SLICE-004** | Polish (conditional) | Reference-aligned spacing/labels only if score still &lt; 3 after SLICE-003 | Queued |

### Chapter closeout criteria

- [ ] Product Intelligence Score on GOLDEN-INSPECTOR-001 ≥ 3 (Kay scorecard)
- [ ] Gates G3–G6 PASS on golden object (see `golden-objects.md`)
- [ ] No regression on G1–G2
- [ ] Kay screenshot acceptance complete

---

## Chapter status values

| Status | Meaning |
|--------|---------|
| **Ready** | Kay approved; automation may start first slice |
| **In Progress** | A slice is active |
| **Blocked** | Waiting on Kay (spec, screenshots, staging branch) |
| **Partial** | 4 slices exhausted or blocked; score not reached |
| **Done** | Target score reached + Kay accepted |

## Slice status values

`Ready` | `In Progress` | `Blocked` | `Done` | `Skipped`

---

## Receipt paths

```
docs/agent-runs/receipts/{CHAPTER_ID}/{SLICE_ID}/
  00-intake-receipt.md
  01-target-ui-spec.md
  02-wiring-matrix.md
  03-implementation-receipt.md
  04-verification-receipt.md
  07-product-intelligence-scorecard.md
  05-product-acceptance.md      ← Kay
  06-closeout-receipt.md
```

---

## Adding a chapter

1. Pick golden object + one score step (e.g. 3 → 4).
2. Define target state in one paragraph.
3. List ≤ 4 slices with clear boundaries.
4. Set status `Ready` only after Kay approves chapter charter.

---

## Legacy

`slice-queue.md` — deprecated for product slices; retained for LOOP meta-slices only.
