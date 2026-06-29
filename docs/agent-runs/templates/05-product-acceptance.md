# Product Acceptance — {SLICE_ID}

**Date:** {YYYY-MM-DD}  
**Reviewer:** Kay  
**Environment:** {local / preview}

> **Blocking gate.** No slice PASS without this receipt (or explicit `BLOCKED` with checklist attached).

---

## Acceptance anchor

| Field | Value |
|-------|-------|
| Route / object | {path or id} |
| Branch / commit | {ref} |

---

## Screenshot / click checklist

| ID | Check | Result |
|----|-------|--------|
| S1 | {description} | {PASS/FAIL/N/A} |
| B1 | {click behavior} | {PASS/FAIL/N/A} |

---

## Reference comparison

| Compare | Observation |
|---------|-------------|
| Local v0 reference | {aligned / partial / divergent} |
| Reality-Tracking / Z.ai bar | {observation} |

---

## Product Surface Score

| Before | After | Delta |
|--------|-------|-------|
| {0–5} | {0–5} | {+/-} |

**Score rationale:** {one short paragraph}

---

## Regressions

- {none | list}

---

## Time spent (Kay manual)

| Activity | Minutes |
|----------|---------|
| Screenshots / clicks | {n} |
| Interpretation / feedback | {n} |

---

## Classification

**{PASS | PARTIAL | FAIL | BLOCKED}**

**Notes:** {optional}
