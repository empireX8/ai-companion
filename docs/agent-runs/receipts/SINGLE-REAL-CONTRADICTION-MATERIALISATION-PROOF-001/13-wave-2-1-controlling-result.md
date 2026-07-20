# 13 — Wave 2.1 controlling result

**Campaign:** SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001
**Branch:** `desktop-single-real-contradiction-proof-001` @ `9883c41`
**Closed:** 2026-07-20
**Mode:** read-only throughout — no Accept, no Reject, no decide POST, no DB mutation, no product changes

---

## Final verdict (exact)

**FAIL — NO TRUSTWORTHY CONTRADICTION CANDIDATE FOUND**

Wave 2.1 human acceptance was **not performed**. The failure is **valid and controlling** — it records that Kay's current imported ContradictionNode cohort cannot support a genuine single-contradiction materialisation proof without accepting overinterpreted heuristic pairs.

---

## Why no candidate was accepted

1. **Semantic reassessment (Phase A2)** of all **25** pending ContradictionNodes found **0** proof-eligible candidates under strict Wave 2.1 criteria.
2. **Phase A recommendation** `cmp2fvq8f00aoqlsyy9z3sckc` was **disqualified** after Kay's interpretation review (`08`) — cross-session pairing, generic `"but i"` trigger, compatible states with qualifying language.
3. **Import detector quality** produces predominantly false positives: cross-session reference fanout, substring contrast markers, token-overlap eligibility (`11-contradiction-detector-quality-defect.md`).
4. **No same-message candidates** exist in the pool; cross-session pairs carry Inspector lineage risk (CN row metadata = Side B only).
5. Accepting any current candidate would prove the **write path** while **misrepresenting** product truth — forbidden by campaign boundaries.

---

## Classification counts (all 25 pending CNs)

| Classification | Count |
|----------------|------:|
| A. CLEAR CONTRADICTION | **0** |
| B. PLAUSIBLE UNRESOLVED TENSION | **2** |
| C. COMPATIBLE STATES — OVERINTERPRETED | **13** |
| D. INSUFFICIENT OR MISALIGNED CONTEXT | **10** |
| **Proof-eligible** | **0** |

Source: `revised-candidate-shortlist.json` · `09-all-candidate-semantic-lineage-audit.md`

---

## Disqualified original recommendation

| Field | Value |
|-------|-------|
| id | `cmp2fvq8f00aoqlsyy9z3sckc` |
| reviewKey | `contradiction_node:cmp2fvq8f00aoqlsyy9z3sckc` |
| Classification | **C. COMPATIBLE STATES — OVERINTERPRETED** |
| Status in DB | **`candidate`** (unchanged — Reject not authorised) |
| Must not accept | **YES** |

---

## Best near-miss (still fails proof eligibility)

**`cmp2fvtjy00b0qlsyue6873np`**

| Field | Value |
|-------|-------|
| Classification | B. PLAUSIBLE UNRESOLVED TENSION |
| Same-session | Yes (Du Bois Analysis Workflow) |
| Side A | I need to review after i read to retain though |
| Side B | Expresses retention doubt but states **"I did review it after every read"** — partial compliance, not clear violation |
| Detector | `goal_behavior_gap:i didn't` |
| Why fails | Tension is effectiveness/unresolved, not clear contradiction; shared Side B message with sibling CN `cmp2fvtk700b4qlsydj8qcgg1` (Import UI collision); accept UEL lineage Side B–only |

**No candidate recommended for lock.**

---

## Account gate — before and after (entire campaign)

| Check | Before (Phase A) | After (final closeout) | Match |
|-------|------------------|------------------------|-------|
| pending total | 53 | **53** | ✓ |
| RI pending | 28 | **28** | ✓ |
| CN pending | 25 | **25** | ✓ |
| open genuine CN | 0 | **0** | ✓ |
| PatternClaims | 7 | **7** | ✓ |
| ModelUpdates | 1 | **1** | ✓ |
| UELs | 50 | **50** | ✓ |
| chicken-burger RI | active | **active** | ✓ |
| All CN status | candidate | **candidate** | ✓ |
| `matchesExpected` | true | **true** | ✓ |

Final gate evidence: `wave-2-1-final-gate-output.txt` (campaign-local; did not modify prior audit inventory JSON).

---

## Mutation and endpoint confirmation

| Check | Result |
|-------|--------|
| Kay database mutation | **NO** |
| Accept actions | **NONE** |
| Reject actions | **NONE** |
| `POST /api/import-review/candidates/[key]/decide` | **NOT CALLED** |
| Product code changed | **NO** |
| Schema changed | **NO** |
| Detector repaired in this campaign | **NO** |

---

## Wave status

| Wave | Status |
|------|--------|
| **Wave 1.1** — CN → Map Active conflicts projection | **PASS** (CONTRADICTION-MAP-CONFLICT-PROJECTION-001; dev fixture + Kay click gate; read path landed @ `9883c41`) |
| **Wave 2.1** — Single genuine CN accept proof on Kay account | **INCOMPLETE — CONTROLLED FAIL** (no human accept; no open genuine CN created) |

---

## Superseded instructions

Phase A receipts recommending `cmp2fvq8f00aoqlsyy9z3sckc` are marked **SUPERSEDED — DO NOT USE**:

- `03-readonly-candidate-shortlist.md`
- `04-recommended-candidate.md`
- `05-expected-after-state.md`
- `06-human-acceptance-runbook.md`
- `candidate-shortlist.json`

Audit trail preserved; no active runbook instructs Accept.

---

## Production readiness

**NO**

---

## Receipt index (this campaign)

| Receipt | Purpose |
|---------|---------|
| `00`–`02` | Intake, gate, acceptance path trace |
| `03`–`07` | Phase A (superseded where noted) |
| `08` | Disqualified candidate interpretation |
| `09`–`12` | Phase A2 semantic audit + gate |
| `11` | Detector quality defect log |
| **`13`** | **This controlling result** |
| **`14`** | **Next prerequisite** |

---

## Return token (exact)

**FAIL — NO TRUSTWORTHY CONTRADICTION CANDIDATE FOUND**

(Campaign closeout token for commit: **READY TO COMMIT WAVE 2.1 CONTROLLED FAILURE**)
