# Product Intelligence Scorecard — {SLICE_ID}

**Date:** {YYYY-MM-DD}  
**Branch:** {branch}  
**Golden object:** {GOLDEN-ID from golden-objects.md}

---

## Planned slice prediction (pre-implementation)

| Field | Value |
|-------|-------|
| Expected Product Intelligence Score | {before} → {after} |
| Expected Build Loop Score | {before} → {after} |
| Why this slice should move the score | {hypothesis} |
| What would prove the slice failed | {observable failures} |

---

## Golden object under test

| Field | Value |
|-------|-------|
| Golden ID | {GOLDEN-INSPECTOR-001} |
| Record / route | {movement id, tabs} |
| Reference surface | {v0 component path} |
| Intelligence target | {Reality-Tracking sections} |

---

## Intelligence questions (answer per golden object)

| Question | Answer | Evidence |
|----------|--------|----------|
| Can the user tell **what changed**? | {yes/no/partial} | {screenshot / section} |
| Can the user tell **why Orvek believes it**? | {yes/no/partial} | |
| Can the user **inspect receipts**? | {yes/no/partial} | |
| Are **facts, inferences, uncertainties, speculations** separated? | {yes/no/partial} | Movement tab |
| Is there a clear **what to watch/do next**? | {yes/no/partial} | |
| Is there a clear **what would change this conclusion**? | {yes/no/partial} | |
| Does the UI feel **intentional** or **dumped**? | {intentional/partial/dumped} | |
| Does it **preserve routes/navigation**? | {yes/no — describe} | click test |

---

## Product Intelligence Score

| Pillar | Score (0–5) | Notes |
|--------|-------------|-------|
| Reference alignment | {n} | layout vs v0 |
| Intelligence quality | {n} | vs Reality-Tracking bar |
| Backend truth | {n} | real data, no fake output |
| **Overall** | **{n}** | not an average — holistic |

**Before slice:** {n} → **After slice:** {n}

---

## Regression tracking (required)

| Gate ID | Previously passing | Current result | Regression? |
|---------|-------------------|----------------|-------------|
| {G3} | {PASS/FAIL/unknown} | {PASS/FAIL} | {yes/no} |

**Any regression:** {yes | no}

> If **yes** — product progress **cannot** be claimed for this slice.

---

## Screenshot proof status

| Check | Status | Notes |
|-------|--------|-------|
| Evidence / Context tab | {captured / missing} | |
| Movement tab | {captured / missing} | |
| Click navigation | {verified / not run} | |

---

## Effort

| Metric | Value |
|--------|-------|
| Slice wall time (agent + Kay) | {hours} |
| Kay manual orchestration level | {0–5 — see Build Loop rubric} |
| Kay screenshot/review minutes | {n} |

---

## Classification

**{PASS | PARTIAL | FAIL | BLOCKED}**

**Scorecard complete:** {yes | no — blocked on Kay}
