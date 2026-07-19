# 09 — Profile and Goals special audit

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Priority risk area.**

---

## Profile / User Model

### What currently populates sections (Kay)

| Concern | Genuine records | On live Map? |
|---------|-----------------|--------------|
| Preferences | 1 active ReferenceItem (chicken-burger); 7 pending | Active fact yes (when live Map) |
| Constraints | 4 candidate RI; 0 active | Not until accept |
| Identity / self | 41 ProfileArtifact IDENTITY candidates; fixture ctx-self | **No** genuine Map identity |
| Values | 5 ProfileArtifact VALUE candidates; fixture ctx-values | **No** |
| Working style / strengths | none typed | **No** |
| Difficulties | via constraints/patterns only | Partial |
| Background | Mind Context = active RI + PatternClaims | Thin (1 RI + 7 patterns) |
| Patterns | 7 PatternClaims active | Yes if Map merge live |

### High-level summaries

| Kind | Verdict |
|------|---------|
| Map section summary / whyItMatters | Preserved from composition densograph or static defaults — **not rewritten by accepted facts** |
| Accepted facts | Additive `profileFacts[]` under Current understanding |
| Mind Context rows | Genuine statements/summaries |
| UserMap detail | Genuine DB title/summary (1 row; mostly pattern restatement) |

### Do accepted facts affect summaries?

**Presentation:** yes as facts list. **Summary prose:** no.

### Do profile conclusions affect new entry interpretation?

| Source | Affects chat/interpretation? |
|--------|------------------------------|
| Active ReferenceItems | **Yes** — `getRelevantReferenceMemory` / long-term memory |
| Goal vs behavior detection | **Yes** — contradiction_detection |
| Map profileFacts UI | **No** |
| UserMap Model Goals rail | **No** prompt feed found |
| ProfileArtifact | Indirect legacy / dark-engine only |

### Presentation vs reasoning

- Map profile facts = **presentation**
- Active ReferenceItems in chat = **reasoning context**
- ProfileArtifact = **legacy store**, not Orvek Map UI

---

## Goals / Directions

### Genuine goal-like records (Kay)

| Layer | Count | Status |
|-------|------:|--------|
| ReferenceItem type=goal | 17 | all **candidate** |
| ProfileArtifact GOAL | 28 | all **candidate** |
| UserMapConclusion in model-goal areas | **0** | UM is `operating_logic` |
| SurfacedAction.linkedGoalRefId | **0** | |

### Status / priority / evidence / progress

| Layer | Status | Priority | Evidence | Progress |
|-------|--------|----------|----------|----------|
| RI goal | candidate/active… | none | source session/message | none |
| UM “goal” | conclusion status | none | evidenceCount etc. | version/supersession |
| SurfacedAction | not_started/done/helped… | heuristics | via claim | action lifecycle |
| ProfileArtifact GOAL | candidate… | none | spans | none |

### Influence / linking / conflict

- RI goals influence chat memory, contradiction gaps, Actions blueprints
- Decisions densograph does **not** project `linkedGoal*` onto OrvekObject
- Goal conflict via ContradictionNode `goal_behavior_gap` (22 pending) — not competing-goals entity
- Today/Explore: no dedicated genuine goal cards; Map Model Goals empty for Kay
- Visible goal cards under composition = **seeded** `m-goal-*`

### Verdict

**Goals are fragmented, mostly unaccepted candidates, and Map “Goals” does not show Kay’s ReferenceItem goals.** Profile is a thin genuine fact layer over a thick seed/static presentation shell when composition is present.
