# 03 — Read-only candidate shortlist

> **⚠ SUPERSEDED by Phase A2 (2026-07-20).**
> Primary recommendation `cmp2fvq8f00aoqlsyy9z3sckc` is **DISQUALIFIED** — classification **C. COMPATIBLE STATES — OVERINTERPRETED** (see `08-candidate-interpretation-review.md`).
> **Do not accept.** Revised assessment: `10-revised-proof-shortlist.md` · `revised-candidate-shortlist.json`.
> Audit trail preserved below.

**Script:** `readonly-contradiction-candidate-shortlist.mjs`
**Output:** `candidate-shortlist.json`
**Queried:** `2026-07-20T08:32:48.958Z`
**Scope:** All **25** pending import `ContradictionNode` rows · shortlist capped at **5**

---

## Eligibility filter (applied)

All 25 rows satisfy base eligibility:

- `status=candidate`
- `sourceSession.origin=IMPORTED_ARCHIVE`
- `sourceMessageId` present on all 25
- No open genuine CN exists (0 open)
- No existing ModelUpdate for any pending CN id
- No linked UEL targeting any pending CN id (0 each)

Shortlist ranking adds quality heuristics: side clarity, coding-noise, sensitivity, duplicate-risk, confidence, evidence presence.

---

## Shortlist (max 5)

### Rank 1 — `cmp2fvpg900agqlsyz6pfxypx`

| Field | Value |
|-------|-------|
| reviewKey | `contradiction_node:cmp2fvpg900agqlsyz6pfxypx` |
| title | Constraint conflict |
| type | `constraint_conflict` |
| confidence | low |
| side A | I'm just having fun I don't really care that much although I always optimise for objectivity regardless of what mode I'm operating in |
| side B | (long message — epistemology / multi-archival convergence discussion) |
| sourceSessionId | `eba90c59-7f62-42b5-8f8e-2572d6b5ec80` |
| sourceMessageId | `cfa5a290-f5a4-4a42-9fb0-0f74dc621f62` |
| ContradictionEvidence | 1 |
| linked UEL | 0 |
| existing ModelUpdate | 0 |
| duplicate-risk | **high** (same sideA as ranks 2–3) |
| sensitivity | low |
| coding-noise | low |
| Import list position | ~#3 overall |
| UI identifying text | **Their words** opens: *"Yeah, I mean, exactly. But I mean, yeah, he's still done what we predicted…"* · Proposed: **Constraint conflict** |

**Assessment:** Automated top score, but sideB is long and weakly tied to sideA; not recommended for human proof.

---

### Rank 2 — `cmp2fvpph00akqlsy3uy645bc`

| Field | Value |
|-------|-------|
| reviewKey | `contradiction_node:cmp2fvpph00akqlsy3uy645bc` |
| title | Constraint conflict |
| type | `constraint_conflict` |
| confidence | low |
| side A | (same constraint statement as rank 1) |
| side B | Mastery / recognition / five-year vision reflection (long) |
| sourceSessionId | `a56b2b9d-2437-4867-9ef6-9dcb0dda39c4` |
| sourceMessageId | `b596501d-950d-41a8-b02e-2fd1795e201e` |
| ContradictionEvidence | 1 |
| linked UEL | 0 |
| existing ModelUpdate | 0 |
| duplicate-risk | **high** |
| sensitivity | low |
| coding-noise | low |
| UI identifying text | **Their words** opens: *"Mm, yo, that's crazy. Can't lie, that whole thing here is just resonating…"* |

---

### Rank 3 — `cmp2fvq8f00aoqlsyy9z3sckc` ~~★ **Human recommendation**~~ **DISQUALIFIED — DO NOT ACCEPT**

| Field | Value |
|-------|-------|
| **Status** | **EXCLUDED FROM PROOF** — superseded Phase A2 |
| **Disqualification** | C. COMPATIBLE STATES — OVERINTERPRETED (`08-candidate-interpretation-review.md`) |
| reviewKey | `contradiction_node:cmp2fvq8f00aoqlsyy9z3sckc` |
| title | Constraint conflict |
| type | `constraint_conflict` |
| confidence | low |
| side A | I'm just having fun I don't really care that much although I always optimise for objectivity regardless of what mode I'm operating in |
| side B | I swear I feel like I can literally feel my brain like bubbling when I see something that starts to trigger my identity… |
| sourceSessionId | `68c4f65a-3ce1-4848-b905-8f63dc3555ab` |
| sourceMessageId | `f4433e90-ec86-4d6a-ac79-7e8225bfb598` |
| session label | Identity Triggers and Sensations |
| ContradictionEvidence | 1 |
| linked UEL | 0 |
| existing ModelUpdate | 0 |
| duplicate-risk | **high** on sideA (shared constraint ref) · **unique sideB + unique Their words** |
| sensitivity | low |
| coding-noise | low |
| Import list position | **#6** of 53 |
| UI identifying text | **Their words:** *"I swear I feel like I can literally feel my brain like bubbling when I see something that starts to trigger my identity…"* · Proposed: **Constraint conflict** · Metadata: `Type: constraint_conflict`, `Conversation: 68c4f65a-3ce…`, `Message: f4433e90-ec8…` |

---

### Rank 4 — `cmp2fvtjy00b0qlsyue6873np`

| Field | Value |
|-------|-------|
| reviewKey | `contradiction_node:cmp2fvtjy00b0qlsyue6873np` |
| title | Goal behavior gap |
| type | `goal_behavior_gap` |
| confidence | **medium** |
| side A | I need to review after i read to retain though |
| side B | I wanna ask, like, am I just wasting my time reading this book, because it's so definition dense… (Du Bois reading workflow) |
| sourceSessionId | `b46c5b34-32da-46f2-a62e-69238aeb46cf` |
| sourceMessageId | `66818a12-5b18-4d4c-9ad4-590c79f685fc` |
| ContradictionEvidence | 1 |
| linked UEL | 0 |
| existing ModelUpdate | 0 |
| duplicate-risk | **high** (same message as rank 5 — identical Their words in UI) |
| sensitivity | low |
| coding-noise | low |
| Import list position | **#10** |
| UI identifying text | **Their words:** *"I wanna ask, like, am I just wasting my time reading this book…"* |

**Assessment:** Strong genuine tension; fallback only — hard to distinguish from rank 5 in Import UI (same message id).

---

### Rank 5 — `cmp2fvtk700b4qlsydj8qcgg1`

| Field | Value |
|-------|-------|
| reviewKey | `contradiction_node:cmp2fvtk700b4qlsydj8qcgg1` |
| title | Goal behavior gap |
| type | `goal_behavior_gap` |
| confidence | medium |
| side A | I would like to enforce this rhetoric on an institutional level… (gender/ethnic hate) |
| side B | (same Du Bois reading message as rank 4) |
| sourceMessageId | `66818a12-5b18-4d4c-9ad4-590c79f685fc` |
| ContradictionEvidence | 1 |
| duplicate-risk | **high** (shared message with rank 4) |
| sensitivity | elevated (sideA topic) |
| UI identifying text | Same **Their words** excerpt as rank 4 |

---

## Rejected patterns (not shortlisted)

| Pattern | Examples | Why excluded |
|---------|----------|--------------|
| Sensitivity elevated | interracial dating CNs (`cmp2fwd3y…`, etc.) | Human-proof risk |
| Coding/process noise | ChatGPT organisation, tutorial pacing (`cmp2fx5al…`, `cmp2fxj6q…`) | Not model-relevant proof |
| Weak side pairing | Many goal_behavior_gap rows pair unrelated goals to same long sideB | Heuristic gap, not clean tension |
| Duplicate UI cards | Same `sourceMessageId` with identical Their words | Accept wrong card risk |

---

## Inventory note

Full ranked list of all 25 ids is in `candidate-shortlist.json` → `allCandidatesRanked`.
