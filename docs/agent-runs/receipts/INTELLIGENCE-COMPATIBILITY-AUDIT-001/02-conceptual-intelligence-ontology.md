# 02 — Conceptual intelligence ontology

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Method:** product docs + Prisma + providers + mounted canonical surfaces. Ambiguity → `UNKNOWN`.

Legend for “kind”: first-class stored · subtype · UserMap/profile category · derived · presentation-only · old MindLabs · new Orvek · duplicated · unsupported

| Human concept | Kind | Technical home | Notes |
|---------------|------|----------------|-------|
| Self-concept / identity | old MindLabs + unsupported on Map | ProfileArtifact `IDENTITY` (203 total arts; 41 IDENTITY, all `candidate`); fixture `ctx-self` | Not in `map-profile-facts` mapping |
| Background / context | presentation + partial stored | Mind Context = active ReferenceItems + PatternClaims; fixture `ctx-current` | Composition can seed context cards |
| Goals | **duplicated** | ReferenceItem `goal` (17 candidate); ProfileArtifact `GOAL` (28 candidate); Map “Model Goals” = UserMapConclusion area remap | No Goal table; Map goals empty for Kay (UM area=`operating_logic` only) |
| Directions | presentation synonym | Map rails / developmental_vector area | Not a separate model |
| Active questions | new Orvek / partial | Investigation.organizingQuestion; Explore AQ adapters | Investigations count for Kay: **0** |
| Unresolved uncertainty | presentation / enum | confidence fields; Investigation status | No dedicated Uncertainty object |
| Claims | duplicated | ReferenceItem statement; PatternClaim summary; UserMapConclusion; ProfileArtifact claim | Different contracts — not aliases |
| Patterns | first-class + old families | PatternClaim + PatternType enum | 7 active genuine for Kay |
| Active conflicts | first-class + presentation | ContradictionNode; Map disputed conclusions | 25 pending candidates; 0 open |
| Contradictions / tensions | first-class | ContradictionNode + evidence | Import-linked |
| Decisions | presentation over SurfacedAction | SurfacedAction (7 for Kay) | No Decision table; composer dead |
| Outcomes | subtype / field | SurfacedAction status; PatternClaimAction.outcomeSignal; Fieldwork.observationOutcome | No Outcome table |
| Values | old MindLabs / unsupported on Map | ProfileArtifact `VALUE` (5 candidate); fixture `ctx-values` | Not Map profile-fact types |
| Preferences | first-class subtype | ReferenceItem `preference` | 1 active (chicken-burger); 7 pending |
| Strengths | unsupported | — | No typed storage found |
| Recurring difficulties | partial | constraints + pattern loops | No “difficulty” type |
| Working style | unsupported | — | — |
| Emotional triggers | old MindLabs subtype | PatternType `trigger_condition`; ProfileArtifact `EMOTIONAL_PATTERN` | PatternClaims exist |
| Environmental triggers | UNKNOWN | May fold into trigger_condition | Missing distinct evidence |
| Relationships / interpersonal | unsupported / UNKNOWN | May appear in message content only | No typed object |
| Behaviours / loops | first-class | PatternClaim `repetitive_loop` | 3 claims |
| Evidence / receipts | first-class + presentation | EvidenceSpan; *Evidence tables; UEL; SurfacedEvidencePointer; densograph “receipts” | No Receipt model |
| Model updates | first-class | ModelUpdate | 1 genuine user_visible |
| Model movement | presentation of MU + report | Inspector movement tab; CanonicalModelMovementReport | Seed report present |
| Confidence | field on many models | ReferenceConfidence; Pattern strength; UM confidenceLevel | Surfaced unevenly |
| Corrections | field + UI | UserMapConclusion correction fields; store mock chips | Durable PATCH live for UM |
| Reports | first-class + seed | CanonicalModelMovementReport; WeeklyAudit | Seed weekly report on Kay |
| Re-entry state | derived / composition | Today composition + reentry snapshot | Seed composition present |

---

## Overlap crosswalk (contracts, not name similarity)

| Pair | Same? | Verdict |
|------|-------|---------|
| ReferenceItem vs UserMapConclusion | No | Atomic typed memory vs area-scoped understanding conclusion |
| PatternClaim vs ReferenceItem(type=pattern) | Overlapping intent | PatternClaim is V1 product path; ReferenceType.pattern exists but Kay has 0 |
| ContradictionNode vs Map “active conflict” | Partial | Map also uses disputed UserMapConclusions |
| ModelUpdate vs Model Movement UI | MU is event; UI may show seed report | Seed report ≠ genuine MU |
| Active question vs uncertainty | Related | Questions stored as Investigation; uncertainty is status/confidence |
| Goal vs direction | Presentation | Directions = Map taxonomy over UM areas |
| Evidence receipt vs span/message | Different layers | Span = char anchor; receipt often densograph/pointer |
| Profile summary vs accepted fact | Different | Facts attach under section; summaries stay static/composition |

---

## Unsupported or UNKNOWN (do not invent)

- Strengths, working style, relationship graph as first-class objects
- Dedicated Decision / Outcome / Goal / ActiveQuestion / Receipt / UserMap container tables
- Whether environmental triggers are intentionally distinct from social/state triggers → **UNKNOWN**
