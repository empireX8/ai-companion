# Intake Receipt — {SLICE_ID}

**Date:** {YYYY-MM-DD}  
**Branch:** {branch}  
**Agent:** {cursor|codex|human}

---

## Slice

| Field | Value |
|-------|-------|
| Slice ID | {SLICE_ID} |
| Title | {title} |
| Queue status | {Queued → In Progress} |

---

## Objective

{One paragraph — what product/loop outcome this slice must achieve.}

---

## Allowed

- {file or change class}
- {verification commands}

---

## Forbidden

- {schema / pages / surfaces explicitly out of scope}

---

## Acceptance anchor

| Field | Value |
|-------|-------|
| Record / route | {e.g. movement id, page path} |
| User / env | {if needed for manual proof} |

---

## Scores at intake

| Metric | Before |
|--------|--------|
| Product Intelligence | {0–5 or N/A} |
| Build Loop | {0–5} |

---

## Planned slice prediction

| Field | Value |
|-------|-------|
| Expected Product Intelligence Score | {before} → {after} |
| Expected Build Loop Score | {before} → {after} |
| Why this slice should move the score | {one paragraph} |
| What would prove the slice failed | {observable failures} |

---

## Golden object (if product slice)

| Field | Value |
|-------|-------|
| Golden ID | {from golden-objects.md} |
| Record ids | {movement / conclusion ids} |

---

## Open questions for Kay

- {none | list}

**Proceed to 01 target UI/spec:** {yes | blocked — reason}
