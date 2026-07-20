# 09 — All-candidate semantic lineage audit

**Phase:** A2 — read-only reassessment of all **25** pending ContradictionNodes
**Script:** `readonly-all-candidate-semantic-audit.mjs`
**Machine output:** `revised-candidate-shortlist.json` → `allCandidates[]`
**Queried:** `2026-07-20T09:03:15.536Z`
**Disqualified from proof:** `cmp2fvq8f00aoqlsyy9z3sckc` (Phase A recommendation withdrawn)

---

## Classification summary

| Classification | Count | Proof-eligible |
|----------------|------:|----------------|
| A. CLEAR CONTRADICTION | 0 | 0 |
| B. PLAUSIBLE UNRESOLVED TENSION | 2 | 0 |
| C. COMPATIBLE STATES — OVERINTERPRETED | 13 | 0 |
| D. INSUFFICIENT OR MISALIGNED CONTEXT | 10 | 0 |

**Proof-eligible after strict review: 0**

---

## Detector mechanics (all candidates)

| Mechanism | Detail |
|-----------|--------|
| Side A source | Always a `ReferenceItem.statement` (`goal` or `constraint`) matched by normalized text |
| Side B source | Full `sourceMessage.content` where detection ran |
| Goal trigger | Substrings: `i didn't`, `i failed`, `i avoided`, `i skipped`, `i procrastinated` |
| Constraint trigger | Substrings: `but i`, `however i`, `even though` |
| Reference scope | **User-wide** up to 50 goal/constraint refs — **not session-scoped** |
| Import filter | `classifyImportedContradictionPair` — token overlap ≥ 2 unless behavioral-admission regex |
| CN row metadata | `sourceSessionId` / `sourceMessageId` = **Side B only** |
| Side A lineage | Via matched ReferenceItem FKs (not on CN row) |

---

## Summary table (all 25)

| id (prefix) | type | session | msg | trigger | class | eligible |
|-------------|------|---------|-----|---------|-------|----------|
| cmp2fvpg900a… | CC | same | diff | but i | C | no |
| cmp2fvpph00a… | CC | cross | diff | but i | C | no |
| cmp2fvq8f00a… | CC | cross | diff | but i | C | no |
| cmp2fvtbb00a… | GBG | same | diff | i didn't | B | no |
| cmp2fvtbl00a… | GBG | cross | diff | i didn't | D | no |
| cmp2fvtjy00b… | GBG | same | diff | i didn't | B | no |
| cmp2fvtk700b… | GBG | cross | diff | i didn't | D | no |
| cmp2fvupc00b… | GBG | cross | diff | i didn't | D | no |
| cmp2fvxta00b… | GBG | cross | diff | i didn't | C | no |
| cmp2fwd3y00b… | GBG | cross | diff | i didn't | D | no |
| cmp2fwd4800b… | GBG | cross | diff | i didn't | D | no |
| cmp2fwd8w00b… | GBG | cross | diff | i didn't | D | no |
| cmp2fwd9600b… | GBG | cross | diff | i didn't | D | no |
| cmp2fx1ot00c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx1p400c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx40n00c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx40z00c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx5al00c… | GBG | cross | diff | i didn't | D | no |
| cmp2fx5sd00c… | GBG | cross | diff | i didn't | D | no |
| cmp2fx5so00c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx96900c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx99h00c… | GBG | cross | diff | i didn't | C | no |
| cmp2fx9dq00d… | GBG | cross | diff | i didn't | D | no |
| cmp2fxj6q00d… | GBG | cross | diff | i didn't | C | no |
| cmp2fxjho00d… | GBG | cross | diff | i didn't | C | no |

Legend: **CC** = constraint_conflict · **GBG** = goal_behavior_gap · **same/cross** = Side A session vs Side B session

Full Side A / Side B text for every row: `revised-candidate-shortlist.json` → `allCandidates[]`.

---

## Disqualified former recommendation

### `cmp2fvq8f00aoqlsyy9z3sckc`

| Field | Value |
|-------|-------|
| Side A session | Model Comparison Clarification (`eba90c59…`) |
| Side B session | Identity Triggers and Sensations (`68c4f65a…`) |
| Trigger | `constraint_conflict:but i` (non-violation contexts in Side B) |
| Token overlap | 3 |
| Qualifiers | Side A "although … optimise for objectivity"; Side B "I'm not reactive" |
| Compatibility | Fun/indifference + objectivity co-asserted; somatic activation ≠ objectivity failure |
| Inspector risk | CN metadata Side B–only; Side A from other session |
| **Classification** | **C. COMPATIBLE STATES — OVERINTERPRETED** |

---

## Near-miss: same-session reading tension

### `cmp2fvtjy00b0qlsyue6873np`

| Field | Value |
|-------|-------|
| Side A | I need to review after i read to retain though |
| Side B (complete) | I wanna ask, like, am I just wasting my time reading this book, because it's so definition dense, I can't really remember anything, like. I'm scared to go and do this kind of thing for, um, the reconstruction of America, Du Bois book, like. Because I didn't even, like, I did review it after every read, but I didn't, like, even do this question stuff, like. It's like, what is even the point of reading if I lose so much? I'm still not fully not getting it though, like, it will make sense, it's not even hard to understand. Like the feudalism, I just forgot the word. That's why I was talking about the feudalism and capitalism and all that is, so I can remember that. Even IMP, ideological, economic, military, political, that's so easy, like that's not even hard. Everything I'm saying is just like loose, like it's not, it ain't got the weight of what it actually is being said. Like this is not even difficult, like, but uh I didn't even, I had to stop because there was other questions. I was looking at them and I was like, yo, I can't even, I'm not even gonna bother trying, because, but the reviews made me feel a bit better because I thought I done, I thought I'd done even worse than I even did, but. It's still, man, whatever init |
| Side A source | RI `3866c83c…` · msg `2221c51b…` · same session `b46c5b34…` |
| Side B source | msg `66818a12…` · same session |
| Trigger | `goal_behavior_gap:i didn't` (behavioral, not generic-but-only) |
| Qualifiers | **"I did review it after every read"** — partial compliance with Side A goal |
| Sibling CN | `cmp2fvtk700b4qlsydj8qcgg1` shares identical Side B message — ambiguous Import UI |
| Inspector | Accept UELs attach to Side B message; Side A ref message not on CN row |
| **Classification** | **B. PLAUSIBLE UNRESOLVED TENSION** (downgraded from automated A after qualifier review) |
| **Proof-eligible** | **No** — tension is effectiveness/doubt, not clear violation; UI collision |

---

## Pattern: three constraint_conflict fanout (Side A shared)

All three share Side A from RI `043a6387…` (Model Comparison constraint):

| id | Side B session | Trigger | Class |
|----|----------------|---------|-------|
| cmp2fvpg900agqlsyz6pfxypx | same (Model Comparison) | but i | C |
| cmp2fvpph00akqlsy3uy645bc | cross (Florida Stay) | but i | C |
| cmp2fvq8f00aoqlsyy9z3sckc | cross (Identity Triggers) | but i | C |

None are genuine constraint violations; Side B `"but i"` occurrences are conversational continuations.

---

## Pattern: cross-session goal fanout

**17 of 25** candidates pair Side A from one session with Side B from another. Side A always has ReferenceItem machine lineage; CN row + accept UEL path foreground Side B only → **Inspector lineage risk** for cross-session pairs.

---

## Constraint_conflict cohort (3)

All **C** — generic `"but i"` triggers without behavioral failure; Side A self-qualifies with "although … objectivity."

---

## Goal_behavior_gap cohort (22)

| Outcome | Count | Typical cause |
|---------|------:|---------------|
| C | 10 | Cross-session + weak relation or `"but i"` in non-failure context |
| D | 10 | Cross-session unrelated topics, coding noise, sensitivity, weak overlap |
| B | 2 | Same-session Du Bois reading (`cmp2fvtbb`, `cmp2fvtjy`) — unresolved retention tension |

---

## Logical compatibility note (campaign-wide)

No candidate presents a clean **logical incompatibility** after reading full qualifiers where Side B explicitly acknowledges partial compliance, non-reactivity, or self-uncertainty. The import detector conflates:

- **Intention vs behaviour** (sometimes valid tension)
- **Goal vs obstacle** (sometimes valid)
- **Compatible simultaneous states** (especially cross-session + substring triggers)

---

## Mutation confirmation

Read-only SELECT only · no Accept/Reject · decision POST not called.
