# 10 — Revised proof shortlist

**Phase:** A2
**Queried:** `2026-07-20T09:03:15.536Z`
**Output:** `revised-candidate-shortlist.json`

---

## Verdict

**No candidate recommended for lock.**

After semantic and lineage reassessment of all **25** pending ContradictionNodes, **zero** satisfy strict Wave 2.1 proof criteria (classification A or strong same-session B, tension survives qualifiers, no generic-marker-only pairing, traceable non-misleading lineage, no UI collision, non-sensitive, no coding noise).

**Do not accept** `cmp2fvq8f00aoqlsyy9z3sckc` or any other candidate in this phase.

**Reject endpoint is not authorized.** All rows remain `status=candidate`.

---

## Strict eligibility checklist (campaign result)

| Criterion | Pool result |
|-----------|-------------|
| Classification A or strong B | 0 pass after qualifier review |
| Tension survives qualifiers | 0 clear passes |
| Genuinely related sides | 2 same-session B only; both fail other gates |
| Not generic-marker-only | 13 fail (constraint `"but i"`) |
| Evidence traceable | All have ContradictionEvidence; accept UEL path Side B–biased |
| Map without overstating | Would overstate for C/D pairs |
| Inspector lineage truthful | Cross-session + CN Side B metadata = misleading for 17/25 |
| Non-sensitive, non-coding | Several D for sensitivity/coding |
| No MU / open duplicate | All pass |
| Prefer same-message | **0 same-message candidates exist** |

---

## Documentation shortlist (top 5 near-misses — not for lock)

### 1. `cmp2fvtjy00b0qlsyue6873np` — nearest, still NOT recommended

| Field | Value |
|-------|-------|
| reviewKey | `contradiction_node:cmp2fvtjy00b0qlsyue6873np` |
| Classification | **B. PLAUSIBLE UNRESOLVED TENSION** |
| Same-session | **Yes** (Du Bois Analysis Workflow) |
| Side A | I need to review after i read to retain though |
| Side B | (complete text in `09` / JSON) |
| Detector | `goal_behavior_gap:i didn't` |
| Why not incompatible | Side B states **"I did review it after every read"** — goal partially met; tension is retention effectiveness, not absence of review |
| Why not for proof | Shared Side B message with `cmp2fvtk700b4qlsydj8qcgg1`; Import UI collision; Inspector UEL Side B–only |
| UI text | Their words: *I wanna ask, like, am I just wasting my time reading this book…* · Proposed: **Goal behavior gap** · Message: `66818a12-5b1…` |

### 2. `cmp2fvtbb00asqlsyp5rovhrd`

| Field | Value |
|-------|-------|
| Classification | B. PLAUSIBLE UNRESOLVED TENSION |
| Same-session | Yes |
| Side A | I need to review after i read to retain though |
| Side B | Positive read report; plans review in morning — **compatible with Side A** |
| Trigger | `i didn't` in "I didn't necessarily understand" (non-failure) |
| Why excluded | Side B describes successful read + intended review schedule |

### 3. `cmp2fvpg900agqlsyz6pfxypx`

| Field | Value |
|-------|-------|
| Classification | C. COMPATIBLE STATES — OVERINTERPRETED |
| Same-session | Yes (Model Comparison) |
| Side A | I'm just having fun… although I always optimise for objectivity… |
| Side B | Epistemology discussion; `"but i"` in "But I mean" |
| Why excluded | Generic marker; Side A self-qualifies; no constraint violation |

### 4. `cmp2fx1ot00c0qlsyccy0awnl`

| Field | Value |
|-------|-------|
| Classification | C. COMPATIBLE STATES — OVERINTERPRETED |
| Same-session | **No** |
| Side A | I need to finish this book though |
| Side B | I didn't even finish the last **thread**… (different object: thread vs book) |
| Trigger | `i didn't` |
| Why excluded | Cross-session Side A; "finish thread" ≠ "finish book" |

### 5. `cmp2fx1p400c4qlsyuk45tk83`

| Field | Value |
|-------|-------|
| Classification | C. COMPATIBLE STATES — OVERINTERPRETED |
| Same-session | No |
| Side A | My goal is peek body nutrition |
| Side B | Shared message with finish-book CN — unrelated goal fanout |
| Why excluded | Cross-session; unrelated Side A goal |

---

## Disqualified (explicit)

| id | Reason |
|----|--------|
| `cmp2fvq8f00aoqlsyy9z3sckc` | C — cross-session, `"but i"` trigger, compatible states (`08`) |

---

## Recommended action for Kay

1. **Do not lock or accept** any ContradictionNode for Wave 2.1 from current pool.
2. Treat campaign result as **extraction-quality blocker**, not accept-path blocker.
3. Defer human proof until **extraction-quality repair wave** produces in-session, non-heuristic candidates — or accept Wave 2.1 scope change (not authorized here).

---

## Production readiness

**NO**
