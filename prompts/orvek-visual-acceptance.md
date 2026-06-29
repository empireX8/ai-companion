# Orvek Visual Acceptance

> **Mode:** human-led product gate (Kay); agent may prepare checklist and capture notes  
> **Input:** running app + `01-target-ui-spec.md` + acceptance anchor from queue

---

## Purpose

Decide whether a slice is **product-acceptable**. This is separate from CI green.

**No PASS without completing this checklist** (or explicit `BLOCKED` with reason).

---

## Setup

| Field | Value |
|-------|-------|
| Slice ID | {SLICE_ID} |
| Branch | {branch} |
| Acceptance route / object | {path or id} |
| Reference surface | {v0 component or doc path} |
| Intelligence bar | Reality-Tracking output contract / Z.ai movement report |

---

## Compare — structure (reference)

- [ ] Section order matches target UI spec
- [ ] Visual language matches direct map / pattern inspector (spacing, labels, cards)
- [ ] Tab roles clear (evidence vs movement not duplicated)

---

## Compare — intelligence quality

- [ ] Claims read as evidence-backed, not motivational or therapeutic
- [ ] Thin packet states honest uncertainty
- [ ] No placeholder labels in production UI (`Reference item · Reference item`, `Related pattern` × N)
- [ ] Receipt / movement summary useful to a human

---

## Compare — interaction

- [ ] Evidence card click stays in workbench inspector (no legacy Patterns/Tensions page)
- [ ] Unsupported links non-clickable (no dead navigation)
- [ ] Back / selection behavior acceptable (or filed as follow-up slice)

---

## Score Product Surface (0–5)

| Score | Select if |
|-------|-----------|
| 0 | Broken |
| 1 | Wired but poor |
| 2 | Inspectable |
| 3 | Coherent |
| 4 | Reference-aligned |
| 5 | Intelligence-grade |

**Before:** {n} → **After:** {n}

**Rationale:** {short paragraph}

---

## Regressions

| ID | Description | Severity |
|----|-------------|----------|
| R1 | {none} | — |

---

## Time spent (Kay)

| Activity | Minutes |
|----------|---------|
| Screenshots / clicks | |
| Review vs reference | |
| Total | |

---

## Classification

**{PASS | PARTIAL | FAIL | BLOCKED}**

| Class | Meaning |
|-------|---------|
| PASS | Checklist green; shippable for slice scope |
| PARTIAL | Improved; known gaps documented with next slice |
| FAIL | Generic labels, legacy routes, or crash still present |
| BLOCKED | Could not run app / missing data / need Kay only |

---

## Output

Save as `docs/agent-runs/runs/{SLICE_ID}/05-product-acceptance.md` (optional path) and link from `06-closeout-receipt.md`.
