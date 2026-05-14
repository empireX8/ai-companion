# MindLab Understanding Engine — Step 4 Phase 0 Contract Lock

**Date:** 2026-05-14  
**Type:** Pre-coding contract lock (documentation only)

## 1. Purpose

Phase 0 locks implementation contracts before any coding starts.

This document removes ambiguity for Phase 1A schema implementation and defines exactly what the first implementation prompt must do, must not do, and how it must stay additive.

This remains an additive MindLab intelligence update:

- Patterns stay
- Tensions / Contradictions stay
- Actions stay
- Timeline stays
- Receipts / Library stay
- Journal / Explore / Check-ins stay
- Mobile/web parity still matters

The Understanding Engine sits above and between existing systems; it does not replace them.

## 2. Authoritative Source Order

When planning documents differ, apply this precedence:

1. `docs/step3-6-preimplementation-consolidation.md`
2. `docs/step3-execution-map.md`
3. `docs/step2c-product-surface-ui-map.md`
4. `docs/step2b-architecture-application-map.md`
5. `docs/step2a-infrastructure-audit.md`

Step 3.6 resolves naming, evidence-input inclusion, ModelUpdate gating, and advanced-intelligence timing ambiguity.

## 3. Phase 1A Scope Lock

### 3.1 Phase 1A includes only

- Prisma schema foundation for:
  - `UserMapConclusion`
  - `Investigation`
  - `ModelUpdate`
  - `FieldworkAssignment`
  - `UnderstandingEvidenceLink` (or equivalent hybrid link model name)
- Required enums
- Required indexes
- Required user-ownership fields (`userId` and user-scoped indexes)
- Migration artifacts required by repo convention
- Minimal schema/data-access tests consistent with repo conventions

### 3.2 Phase 1A must exclude

- UI work
- API route handlers (except minimal schema test scaffolding if absolutely required)
- synthesis engine / derivation logic
- agent deliberation logic
- Explore mode runtime behavior
- Today cards
- Timeline event layer UI
- mobile work
- Action/Experiment semantic expansion
- `GenerativeSelfModelEntry`
- `ModelMaturitySignal`
- `MetaObserverFinding`

## 4. Model Contracts

## 4.1 UserMapConclusion

### Purpose

Persisted synthesis-level understanding claim. Not a replacement for `PatternClaim`.

### Required fields

- `id` (`String`, primary key)
- `userId` (`String`)
- `area` (`UserMapConclusionArea`)
- `status` (`UserMapConclusionStatus`)
- `title` (`String`)
- `summary` (`String`)
- `confidenceScore` (`Float`)
- `confidenceLevel` (`UserMapConfidenceLevel`)
- `evidenceCount` (`Int`, default `0`)
- `sourceDiversity` (`Int`, default `0`)
- `timeSpreadDays` (`Int`, default `0`)
- `version` (`Int`, default `1`)
- `createdAt` (`DateTime`)
- `updatedAt` (`DateTime`)

### Optional fields

- `supersededById` (`String?`)
- `supersedesId` (`String?`)
- `firstEvidenceAt` (`DateTime?`)
- `lastEvidenceAt` (`DateTime?`)
- `lastUserCorrectionAt` (`DateTime?`)
- `lastUserCorrectionLabel` (`String?`, constrained by correction contract)
- `correctionCount` (`Int`, default `0`)
- `notes` (`String?`)

### Lifecycle / status values

- `hypothesis`
- `tentative`
- `emerging`
- `supported`
- `disputed`
- `superseded`

### Confidence representation

- Canonical score: `confidenceScore` (0..1)
- Display bucket: `confidenceLevel`
- Status and confidence must be coherent with objectivity thresholds

### Correction / supersession

- Corrections do not delete history; they downgrade/cap confidence and may move status to `disputed`
- Supersession is explicit via `supersededById` / `supersedesId`

### Evidence/link expectations

- Evidence provenance must be represented through `UnderstandingEvidenceLink`
- User-facing claims require linked evidence

### Indexes

- `@@index([userId, area, status])`
- `@@index([userId, confidenceScore])`
- `@@index([userId, updatedAt])`
- `@@index([userId, supersededById])`

### Must not replace

- `PatternClaim`
- `ContradictionNode`
- `ProfileArtifact`
- Timeline aggregation

## 4.2 Investigation

### Purpose

Persisted active inquiry thread. Not a replacement for `ContradictionNode`.

### Required fields

- `id`
- `userId`
- `title`
- `organizingQuestion`
- `status` (`InvestigationStatus`)
- `seedType` (`InvestigationSeedType`)
- `competingTheories` (`Json`)
- `evidenceNeeded` (`Json`)
- `createdAt`
- `updatedAt`

### Optional fields

- `resolutionSummary` (`String?`)
- `resolvedAt` (`DateTime?`)
- `resolvedIntoUserMapConclusionId` (`String?`)
- `reopenedAt` (`DateTime?`)
- `reopenReason` (`String?`)
- `priority` (`Int?`)

### Status values

- `open`
- `gathering_evidence`
- `testing`
- `resolving`
- `resolved`
- `reopened`
- `abandoned`

### Seed/source type values

- `contradiction`
- `pattern`
- `state_switch`
- `user_curiosity`
- `action_failure`
- `fieldwork_result`
- `model_uncertainty`
- `user_correction`

### Competing-theory representation

- `Json` array of theory objects
- each object minimally includes: `label`, `summary`, `evidenceForCount`, `evidenceAgainstCount`, `confidence`

### Evidence-needed representation

- `Json` array of evidence-needed items
- each item minimally includes: `prompt`, `reason`, `sourceHint`, `priority`

### Resolution/reopen fields

- resolution requires thresholds (Section 7)
- reopen is explicit with reason and timestamp

### Evidence/link expectations

- Link to supporting/contradicting evidence via `UnderstandingEvidenceLink`
- Must link to at least one seed source

### Indexes

- `@@index([userId, status, updatedAt])`
- `@@index([userId, seedType, createdAt])`
- `@@index([userId, resolvedAt])`

### Must not replace

- `ContradictionNode`
- `PatternClaim`

## 4.3 ModelUpdate

### Purpose

Atomic record of meaningful model movement. Must not become a random insight feed.

### Required fields

- `id`
- `userId`
- `updateType` (`ModelUpdateType`)
- `visibility` (`ModelUpdateVisibility`)
- `affectedObjectType` (`UnderstandingLinkTargetType`)
- `affectedObjectId` (`String`)
- `userFacingSummary` (`String`)
- `isMeaningful` (`Boolean`)
- `createdAt`

### Optional fields

- `beforeSummary` (`String?`)
- `afterSummary` (`String?`)
- `confidenceDelta` (`Float?`)
- `meaningfulDeltaScore` (`Float?`)
- `sourceRunId` (`String?`)
- `internalNotes` (`String?`)

### Update type values

- `conclusion_added`
- `conclusion_strengthened`
- `conclusion_weakened`
- `conclusion_disputed`
- `conclusion_superseded`
- `investigation_opened`
- `investigation_progressed`
- `investigation_resolved`
- `investigation_reopened`
- `fieldwork_assigned`
- `fieldwork_completed`
- `action_outcome_recorded`
- `strategy_adjusted`
- `correction_applied`
- `link_detected`

### Affected-object representation

- `affectedObjectType` + `affectedObjectId` pair
- `affectedObjectType` constrained to target enum values

### Before/after representation

- `beforeSummary` and `afterSummary` are optional but required for user-visible transitions that describe state changes

### Meaningful-delta support

- `isMeaningful` must be computed by threshold/gating rules before user visibility

### Visibility policy values

- `internal_only`
- `candidate`
- `user_visible`

### Indexes

- `@@index([userId, visibility, createdAt])`
- `@@index([userId, updateType, createdAt])`
- `@@index([userId, affectedObjectType, affectedObjectId])`

### Must not become

- synthetic daily insight feed
- backend-churn log shown to users

## 4.4 FieldworkAssignment

### Purpose

Observation prompt (`Watch For`) distinct from action execution.

### Required fields

- `id`
- `userId`
- `prompt`
- `reason`
- `status` (`FieldworkStatus`)
- `linkedObjectType` (`UnderstandingLinkTargetType`)
- `linkedObjectId` (`String`)
- `createdAt`
- `updatedAt`

### Optional fields

- `observationNote` (`String?`)
- `observationOutcome` (`String?`) // constrained by app logic
- `completedAt` (`DateTime?`)
- `expiresAt` (`DateTime?`)
- `priority` (`Int?`)

### Status values

- `assigned`
- `active`
- `completed`
- `dismissed`
- `expired`

### Linked-object representation

- explicit `linkedObjectType` + `linkedObjectId`
- must point to a real investigation/conclusion/pattern/tension uncertainty anchor

### Completion/observation representation

- completion requires observation payload (`observationNote` and/or `observationOutcome`)
- completion updates through gates only

### Evidence/link expectations

- completion must create evidence links via `UnderstandingEvidenceLink`

### Indexes

- `@@index([userId, status, updatedAt])`
- `@@index([userId, linkedObjectType, linkedObjectId])`
- `@@index([userId, createdAt])`

### Distinction from Actions

- Fieldwork asks user to observe signals
- Actions ask user to perform moves
- Fieldwork is not generic journaling or task homework

## 4.5 UnderstandingEvidenceLink

### Final model name recommendation

`UnderstandingEvidenceLink` (or equivalent naming if strict schema naming conventions require alternate wording).

### Strategy

Hybrid strategy is locked for Phase 1A:

- generic link model for v1 flexibility
- typed enums + strict validation
- later explicit joins only if performance profile requires

### Required fields

- `id`
- `userId`
- `targetType` (`UnderstandingLinkTargetType`)
- `targetId`
- `sourceType` (`UnderstandingLinkSourceType`)
- `sourceId`
- `role` (`UnderstandingLinkRole`)
- `createdAt`

### Optional metadata fields

- `summary` (`String?`)
- `snippet` (`String?`)
- `quote` (`String?`)
- `weight` (`Float?`)
- `confidenceContribution` (`Float?`)
- `meta` (`Json?`)

### TargetType enum values

- `usermap_conclusion`
- `investigation`
- `model_update`
- `fieldwork_assignment`
- `surfaced_action`
- `pattern_claim`
- `contradiction_node`

### SourceType enum values

- `pattern_claim`
- `pattern_claim_evidence`
- `contradiction_node`
- `contradiction_evidence`
- `profile_artifact`
- `evidence_span`
- `reference_item`
- `surfaced_action`
- `quick_check_in`
- `journal_entry`
- `session`
- `message`
- `timeline_aggregation`
- `import_record`
- `user_correction`

### Role enum values

- `supports`
- `contradicts`
- `context`
- `seed`
- `outcome`
- `correction`
- `temporal_anchor`
- `derived_from`

### Indexes

- `@@index([userId, targetType, targetId])`
- `@@index([userId, sourceType, sourceId])`
- `@@index([userId, targetType, role])`
- `@@index([userId, createdAt])`
- dedupe unique key on `(userId, targetType, targetId, sourceType, sourceId, role)`

### Validation expectations

- enum-typed source/target/role only
- ownership consistency (`userId` matches target/source ownership context)
- dedupe protection on repeated links
- non-empty summary/snippet/quote when role requires narrative evidence explanation

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| invalid/garbage links | strict validation + enum typing + tests |
| unbounded link volume | indexes + pagination + selective reads |
| semantic drift | constrained role enum + tests |
| premature optimization churn | hybrid now, explicit joins later only if warranted |

## 5. Enum Contract

Locked enum names and initial values:

### UserMapConclusionStatus

- `hypothesis`
- `tentative`
- `emerging`
- `supported`
- `disputed`
- `superseded`

### UserMapConclusionArea

- `operating_logic`
- `state_ecology`
- `tension_architecture`
- `recovery_architecture`
- `meaning_system`
- `relational_field`
- `developmental_vector`
- `current_frontier`

### UserMapConfidenceLevel

- `low`
- `medium`
- `high`

### InvestigationStatus

- `open`
- `gathering_evidence`
- `testing`
- `resolving`
- `resolved`
- `reopened`
- `abandoned`

### InvestigationSeedType

- `contradiction`
- `pattern`
- `state_switch`
- `user_curiosity`
- `action_failure`
- `fieldwork_result`
- `model_uncertainty`
- `user_correction`

### ModelUpdateType

- `conclusion_added`
- `conclusion_strengthened`
- `conclusion_weakened`
- `conclusion_disputed`
- `conclusion_superseded`
- `investigation_opened`
- `investigation_progressed`
- `investigation_resolved`
- `investigation_reopened`
- `fieldwork_assigned`
- `fieldwork_completed`
- `action_outcome_recorded`
- `strategy_adjusted`
- `correction_applied`
- `link_detected`

### ModelUpdateVisibility

- `internal_only`
- `candidate`
- `user_visible`

### FieldworkStatus

- `assigned`
- `active`
- `completed`
- `dismissed`
- `expired`

### UnderstandingLinkTargetType

- `usermap_conclusion`
- `investigation`
- `model_update`
- `fieldwork_assignment`
- `surfaced_action`
- `pattern_claim`
- `contradiction_node`

### UnderstandingLinkSourceType

- `pattern_claim`
- `pattern_claim_evidence`
- `contradiction_node`
- `contradiction_evidence`
- `profile_artifact`
- `evidence_span`
- `reference_item`
- `surfaced_action`
- `quick_check_in`
- `journal_entry`
- `session`
- `message`
- `timeline_aggregation`
- `import_record`
- `user_correction`

### UnderstandingLinkRole

- `supports`
- `contradicts`
- `context`
- `seed`
- `outcome`
- `correction`
- `temporal_anchor`
- `derived_from`

## 6. Evidence Input Contract for Phase 2

Phase 2 evidence packet v1 inclusion is locked for all sources below.

Weight scale guidance:

- `critical`
- `high`
- `moderate`
- `low`

| Input | Role | Weight | Guardrail | Must not become |
|---|---|---|---|---|
| PatternClaim | primary behavioral signal | critical | corroboration still required for strong claims | full User Map replacement |
| PatternClaimEvidence | direct proof snippets | critical | quote safety + provenance checks | synthesis object |
| ContradictionNode | inquiry seed and uncertainty signal | high | cannot auto-resolve into conclusions | full investigation system |
| ContradictionEvidence | supporting/opposing theory evidence | high | remain tied to contradiction context | standalone conclusion source |
| ProfileArtifact | low-level extracted hints | **low-to-moderate (0.25–0.45 contribution cap)** | never surfaced as User Map itself; cannot singularly push to supported | User Map claim layer |
| EvidenceSpan | provenance anchor | moderate | provenance-only by default | synthesis reasoning layer |
| ReferenceItem | goals/preferences/constraints/value context | moderate | context signal only; must be corroborated by behavioral evidence | Investigation/User Map by itself |
| SurfacedAction | behavior feedback outcomes | high | phase boundary rules (Phase 3 existing semantics; Phase 4 experiment semantics) | full experiment engine |
| QuickCheckIn | state snapshots and transitions | moderate | single-event limitation | standalone personality claim source |
| JournalEntry | longitudinal reflective evidence | high | single-entry cannot produce supported claims alone | structured investigation object |
| Session | container/temporal context | low | container only | direct claim source |
| Message | atomic text evidence | moderate | single-message limitation | standalone supported conclusion driver |
| Timeline aggregation | temporal coherence context | high | contextual, not causal proof by itself | causal reasoning engine |
| Import pipeline outputs | historical longitudinal context | moderate-high | imported quality/relevance gates required | real-time intelligence engine |
| User corrections | calibration/dispute feedback | critical | confidence downgrade/cap until corroborated | auto-deletion of model history |

## 7. Objectivity Threshold Contract

These are conservative initial defaults for dark-run tuning.

### Named constants / rules

- `UMAP_MIN_EVIDENCE_EMERGING = 2`
- `UMAP_MIN_SOURCE_TYPES_EMERGING = 2`
- `UMAP_MIN_EVIDENCE_SUPPORTED = 4`
- `UMAP_MIN_SOURCE_TYPES_SUPPORTED = 2`
- `UMAP_MIN_TIME_SPREAD_DAYS_SUPPORTED = 7`

- `UMAP_CONF_CAP_2_EVIDENCE = 0.30`
- `UMAP_CONF_CAP_3_TO_5_EVIDENCE = 0.50`
- `UMAP_CONF_CAP_6_TO_10_EVIDENCE = 0.70`
- `UMAP_CONF_CAP_10_PLUS_EVIDENCE = 0.85`

- `SINGLE_EPISODE_SUPPORTED_BLOCK = true`
  - rule: one session/check-in/journal episode cannot produce `supported`

- `HIGH_EMOTION_STATUS_CAP = emerging`
  - rule: high-emotion dominant evidence cannot produce identity-level supported claims without non-acute corroboration

- `MODEL_UPDATE_MIN_CONF_DELTA = 0.08`
- `MODEL_UPDATE_REQUIRES_MEANINGFUL_DELTA = true`
- `MODEL_UPDATE_REQUIRES_EVIDENCE_LINK = true`
- `MODEL_UPDATE_BLOCK_SYNTHETIC_DAILY_INSIGHT = true`

- `INVESTIGATION_RESOLVE_MIN_EVIDENCE = 3`
- `INVESTIGATION_RESOLVE_MIN_SOURCE_TYPES = 2`
- `INVESTIGATION_RESOLVE_MIN_COMPETING_THEORIES = 2`
- `INVESTIGATION_RESOLVE_REQUIRES_FIELDWORK_OR_EXPERIMENT = true`
- `INVESTIGATION_RESOLVE_BLOCK_IF_ACTIVE_BLOCKING_CONTRADICTION = true`

- `FIELDWORK_ASSIGN_IF_EVIDENCE_GAP = true`
- `FIELDWORK_ASSIGN_IF_EMERGING_STALE_DAYS = 14`
- `FIELDWORK_ASSIGN_IF_REPEATED_UNCLEAR_OUTCOMES = true`

- `CORRECTION_CONFIDENCE_MULTIPLIER = 0.50`
  - rule: apply downgrade on correction until fresh corroboration restores confidence

All constants are initial defaults and must be tuned after dark-run evaluation.

## 8. Copy / Naming Contract

Locked internal-to-user-facing mapping:

- `UserMapConclusion` -> `Your Map conclusion` / `Current Understanding item`
- `User Map` -> `Your Map`
- `Master Theory` -> `Current Understanding`
- `Investigation` -> `Active Question`
- `ModelUpdate` -> `What Changed`
- `FieldworkAssignment` -> `Watch For`
- `Action / Experiment` -> `Try This / Test This`
- `Tested Move` -> `What Worked`
- `MetaObserverFinding` -> `Confidence Check` (internal-only unless explicitly surfaced)

### Copy constraints

- Do not leak raw backend object names into UI copy.
- Do not use `Release / Understand / Move` as user-facing Explore labels.
- Use `Vent / Make sense / Decide` as user-facing Explore labels.

## 9. Existing Model Preservation Contract

The following systems must not be removed, renamed, or redefined out of role.

| Existing model/system | Feeds new layer by | Must not be overloaded into |
|---|---|---|
| PatternClaim | primary behavioral claim stream | User Map itself |
| PatternClaimEvidence | receipt/proof for pattern claims | synthesis object |
| ContradictionNode | investigation seed and uncertainty signal | full investigation system |
| ContradictionEvidence | evidence for/against contradictions | standalone conclusion layer |
| ProfileArtifact | low-level extracted signal | User Map claim layer |
| EvidenceSpan | provenance anchor | synthesis reasoning object |
| ReferenceItem | goals/preferences/context signal | Investigation/User Map object by itself |
| SurfacedAction | action outcomes and feedback signal | full experiment/fieldwork system |
| QuickCheckIn | state and switch context | structured journal or complete investigation layer |
| JournalEntry | reflective evidence stream | structured conclusion object |
| Session | container + chronology context | intelligence engine |
| Message | atomic textual evidence | sole supported-claim driver |
| Timeline aggregation | temporal/epistemic infrastructure | causal engine |
| Import pipeline | historical evidence ingestion | live intelligence computation |
| Eval pipeline | quality/blind-spot input | user-facing intelligence output by default |

## 10. Phase Boundary Contract

Locked phase boundaries:

- **Phase 1A**: schema foundation only
- **Phase 1B**: additive APIs
- **Phase 1C**: additive response links
- **Phase 2**: dark engine + gates
- **Phase 3**: web beta surfaces
- **Phase 4**: Actions/Experiments + Explore modes
- **Phase 5**: Receipts/Library deep linking
- **Phase 6**: mobile parity
- **Phase 7**: advanced intelligence

Additional boundary rules:

- Phase 3 Today suggested actions must use existing action pipeline semantics.
- Phase 4 is first phase for full Actions/Experiments semantics.
- Phase 7 advanced objects are not to be behaviorally implemented early.

## 11. First Implementation Prompt Requirements

The Phase 1A implementation prompt must require:

1. Inspect current schema conventions first.
2. Add only locked Phase 1A models and enums.
3. Create migration if repo convention requires.
4. Add minimal schema/data-access tests aligned with repo test patterns.
5. Do not build APIs/UI/engine logic.
6. Do not implement Phase 7 objects.
7. Run verification:
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
8. Do not commit.

The prompt must explicitly forbid:

- non-additive changes to existing models/endpoints
- legacy surface removal/renaming
- mobile-side intelligence logic
- random insight generation behavior

## 12. Open Decisions Remaining

Only true blockers for Phase 1A are allowed here.

### Phase 1A blockers

- **None identified** after this lock.

### Later-phase decisions (not Phase 1A blockers)

- Final UI copy examples per mode/surface
- Exact Explore mode UX controls and transitions
- Mobile detail-level reduction strategy for first parity drop
- High-correction escalation policy behavior beyond base downgrade rule
- Whether explicit join tables should be added later for high-volume link paths

## 13. Final Verdict

- **Is Phase 1A schema implementation ready after this contract lock?** Yes.
- **Are there any blockers?** No Phase 1A blockers remain.
- **Exact title of first implementation prompt:**
  - `Step 4 Prompt 1 — Understanding Engine Foundation Schema and Enum Contract (Phase 1A)`

