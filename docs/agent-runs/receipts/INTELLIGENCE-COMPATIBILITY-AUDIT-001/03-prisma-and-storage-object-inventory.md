# 03 — Prisma and storage object inventory

**Schema authority:** `prisma/schema.prisma` (sole file)
**QueriedAt:** see `readonly-intelligence-inventory.json`

---

## Models participating in intelligence

### Imported history / capture
| Model | Role |
|-------|------|
| Session | Chat/import container; `origin` APP \| IMPORTED_ARCHIVE |
| Message | Raw turns; optional groundingPayload |
| ImportUploadSession / ImportUploadChunk | Upload pipeline |
| JournalEntry | Native journal captures |

### Extraction / evidence
| Model | Role |
|-------|------|
| DerivationRun / DerivationArtifact | Extraction runs + typed artifacts |
| ArtifactEvidenceLink / ArtifactPromotionLink | Artifact↔span; promotion targets |
| EvidenceSpan | Char-anchored quote on Message |
| ContradictionEvidence | Quote evidence on ContradictionNode |
| PatternClaimEvidence | Quote evidence on PatternClaim |
| ProfileArtifactEvidenceLink | ProfileArtifact↔span |
| UnderstandingEvidenceLink | Polymorphic UE graph |
| SurfacedEvidencePointer (+ Rationale) | Surfacing depth pointers |

### Model state
| Model | Role |
|-------|------|
| ReferenceItem | Typed memory (goal/preference/constraint/…) |
| ContradictionNode (+ ReferenceLink) | Tensions |
| PatternClaim (+ Action) | Pattern families |
| ProfileArtifact | Legacy typed claims (BELIEF/VALUE/GOAL/IDENTITY/…) |
| UserMapConclusion | Understanding Engine conclusions |
| Investigation | Open inquiries / organizing questions |
| FieldworkAssignment | Experiments |
| ModelUpdate | Movement events |
| ExploreMovementProposal | Pre-publish explore movements |
| SurfacedAction | Decisions/actions projection |
| Projection | Forecast outcomes strings (separate meaning) |
| QuickCheckIn | State tags |
| WeeklyAudit | Legacy weekly aggregate |
| CanonicalTodayComposition | Today densograph payload (can be seed) |
| CanonicalModelMovementReport | First-class movement report |

### Explicitly absent as tables
Goal, Decision, Outcome, ActiveQuestion, Receipt, UserMap (container), PatternFamily, Candidate (table).

---

## Key enums (quoted)

**ReferenceType:** `constraint | pattern | goal | preference | assumption | hypothesis | rule | source`
**ReferenceStatus:** `candidate | active | superseded | inactive | dismissed`
**ContradictionStatus:** `candidate | open | snoozed | explored | resolved | accepted_tradeoff | archived_tension`
**ContradictionType:** `goal_behavior_gap | value_conflict | constraint_conflict | belief_conflict | pattern_loop | narrative_conflict`
**PatternType:** `trigger_condition | inner_critic | repetitive_loop | contradiction_drift | recovery_stabilizer`
**ModelUpdateType:** `conclusion_added | conclusion_strengthened | … | correction_applied | link_detected | …`
**ModelUpdateVisibility:** `internal_only | candidate | user_visible`

---

## Ontology crosswalk (concept → storage → mutation → provider → surface)

| Human concept | Model(s) | Status/type fields | Evidence/lineage | Mutation path | Expected provider | Expected surface |
|---------------|----------|--------------------|------------------|---------------|-------------------|------------------|
| Preference fact | ReferenceItem | type=preference, status | sourceSession/Message | import-review accept; POST /api/reference | map-profile-facts; mind-context | Map Preferences |
| Goal memory | ReferenceItem type=goal | status | source FKs | same | actions blueprints; chat memory | not Map profile-facts |
| Conflict | ContradictionNode | type, status | ContradictionEvidence; source FKs | import-review; detect on message | Map conflicts adapter | Map Active conflicts |
| Pattern | PatternClaim | patternType, status, strength | PatternClaimEvidence | pattern batch on import/native | map-api patterns | Map Patterns |
| Profile claim (legacy) | ProfileArtifact | type, status | EvidenceSpan links | profile-derivation | mostly unused by Orvek Map | orphaned for Map |
| User-model conclusion | UserMapConclusion | area, status, visibility, lifecycle | UEL (50→1 UM for Kay) | dark-engine / publish; PATCH correction | map-api | Map rails |
| Movement | ModelUpdate | updateType, visibility | affectedObject* | accept contra; publish UM | timeline / inspector / today | Timeline, Inspector movement |
| Decision card | SurfacedAction | bucket, status | linkedClaimId, linkedGoalRefId | actions sync; PATCH outcome | decisions-api | Decisions |
| Active question | Investigation | organizingQuestion, status | seedType | dark-engine / APIs | active-questions-api | Explore Questions |
| Experiment | FieldworkAssignment | status, visibility | linkedObject* | fieldwork APIs | experiment-api | Explore Fieldwork |
| Today densograph | CanonicalTodayComposition | source | payload JSON | seed routes (dev) | hybrid composition merge | Today + rails if workbench |
| Report | CanonicalModelMovementReport | reportType, status | relatedMovementIds, relatedReceiptIds | seed / generators | report overlay | Reports overlay |

---

## Duplication risks (contract-traced)

1. **ReferenceItem vs UserMapConclusion** — different lifecycles; chicken-burger is RI only (no MU).
2. **Three goal homes** — RI goal vs ProfileArtifact GOAL vs UM area remap.
3. **PatternClaim vs ProfileArtifact HABIT/EMOTIONAL_PATTERN** — parallel pattern-ish stores.
4. **Composition densograph objects vs DB rows** — same UI slots, different provenance.
