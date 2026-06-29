# Product Intelligence Scorecard — SLICE-002

**Date:** 2026-06-29  
**Branch:** `chapter-inspector-001-slice-002-tab-boundary`  
**Golden object:** `GOLDEN-INSPECTOR-001`

---

## Planned slice prediction (pre-implementation)

| Field | Value |
|-------|-------|
| Expected Product Intelligence Score | `2 → 3` |
| Expected Build Loop Score | `2 → 2` |
| Why this slice should move the score | Coherent tab roles require the selected `model_update` Evidence / Context tab to stop repeating movement-report change conditions while the Movement tab remains the single epistemic report. |
| What would prove the slice failed | The golden object still shows duplicated / confusing change-condition content across both tabs, or navigation regresses out of the workbench inspector. |

---

## Golden object under test

| Field | Value |
|-------|-------|
| Golden ID | `GOLDEN-INSPECTOR-001` |
| Record / route | Movement `cmq6h8ewn0000qlbwlg485jx1` on Today workbench; affected conclusion `cmq6frqdx0000ql8h6nkavzue` |
| Reference surface | Direct map conclusion Evidence / Context section formula in the local v0 inspector |
| Intelligence target | Mind Model Movement tab owns the Reality-Tracking epistemic report, including “What Would Change This Conclusion” |

---

## Intelligence questions (answer per golden object)

| Question | Answer | Evidence |
|----------|--------|----------|
| Can the user tell **what changed**? | partial | Movement summary remains; screenshot review pending |
| Can the user tell **why Orvek believes it**? | partial | Movement tab still owns facts / claims / inferences / uncertainties; screenshot review pending |
| Can the user **inspect receipts**? | yes | Existing evidence cards and receipt refs remain route-safe in source tests |
| Are **facts, inferences, uncertainties, speculations** separated? | yes | Movement tab |
| Is there a clear **what to watch/do next**? | yes | Movement tab |
| Is there a clear **what would change this conclusion**? | partial | Source/tests confirm single-tab ownership; screenshot confirmation pending |
| Does the UI feel **intentional** or **dumped**? | partial | Boundary cleanup implemented; visual acceptance pending |
| Does it **preserve routes/navigation**? | yes | Click test coverage and legacy-route guard remain in place |

---

## Product Intelligence Score

| Pillar | Score (0–5) | Notes |
|--------|-------------|-------|
| Reference alignment | `3` | Evidence / Context now follows a cleaner direct-object formula for selected movement context |
| Intelligence quality | `3` | Movement tab remains the explicit epistemic report instead of sharing change-condition content with Evidence / Context |
| Backend truth | `5` | No fake/static insight added; existing real-data routes unchanged |
| **Overall** | **`3`** | estimate only until Kay screenshot review |

**Before slice:** `2` → **After slice:** `3` (estimate)

---

## Regression tracking (required)

| Gate ID | Previously passing | Current result | Regression? |
|---------|-------------------|----------------|-------------|
| `G3` | unknown / pending Kay | PASS in source invariants; screenshot pending | no |
| `G4` | unknown / pending Kay | PASS in source invariants; harness route check pending | no |
| `G5` | unknown / pending Kay | PASS by retained movement-panel guard | no |
| `G6` | unknown / pending Kay | PASS by retained movement-tab section structure | no |

**Any regression:** no

> If **yes** — product progress **cannot** be claimed for this slice.

---

## Screenshot proof status

| Check | Status | Notes |
|-------|--------|-------|
| Evidence / Context tab | missing | Kay screenshot required |
| Movement tab | missing | Kay screenshot required |
| Click navigation | verified | Automated source tests and legacy-route guard cover in-inspector selection behavior |

---

## Effort

| Metric | Value |
|--------|-------|
| Slice wall time (agent + Kay) | `~1.0h` |
| Kay manual orchestration level | `2` |
| Kay screenshot/review minutes | `0` |

---

## Classification

**PARTIAL**

**Scorecard complete:** yes — blocked on Kay screenshots
