# MindLab Step 6 — Phase 2 Dark Engine + Gates Contract

## 1. Purpose and Boundary

This document locks the implementation contract for **Phase 2 (Dark Engine + Gates)** of the MindLab Understanding Engine.

Phase 2 is the first phase where the system may perform conservative, evidence-first synthesis and write **internal/candidate** understanding objects under strict gates.

Phase 2 is:
- dark engine execution (non-UI-first)
- evidence packet assembly + candidate synthesis
- objectivity/safety gating
- abstention when evidence is insufficient
- internal/candidate model movement only unless explicitly promoted later

Phase 2 is not:
- UI rollout
- mobile rollout
- Explore runtime behavior changes
- Actions/Experiments semantic expansion
- full agent/lens architecture
- Intelligence Library or domain retrieval
- therapy mode positioning
- random insight feed
- fake progress/model movement
- generic AI coaching

## 2. Authority and Source Order

For Phase 2 implementation prompts, use this precedence:
1. `docs/step6-phase2-dark-engine-gates-contract.md` (this document)
2. `docs/step5-foundation-closeout-and-next-work-map.md`
3. `docs/step4b-phase1b-additive-api-contract.md`
4. `docs/step4-phase0-contract-lock.md`
5. `docs/step4a-category-agent-knowledge-addendum.md`
6. `docs/step3-6-preimplementation-consolidation.md`
7. `docs/step3-execution-map.md`
8. `docs/step2c-product-surface-ui-map.md`
9. `docs/step2b-architecture-application-map.md`
10. `docs/step2a-infrastructure-audit.md`

Step 4A remains strategic guardrail context and does not expand Phase 2 scope into Phase 7 features.

## 3. Current Baseline (What Exists Before Phase 2)

Already implemented and available:
- Phase 1A storage objects: `UserMapConclusion`, `Investigation`, `ModelUpdate`, `FieldworkAssignment`, `UnderstandingEvidenceLink`
- Phase 1B controlled APIs for those objects with auth, validation, lifecycle checks, and ownership checks
- Phase 1C include-gated `relatedUnderstanding` links on selected existing endpoints
- Existing derivation substrate: pattern detection/orchestration, contradiction detection/materialization, timeline aggregation, surfaced actions, evidence spans, imports, references/profile artifacts

What does not exist yet:
- dark synthesis pipeline that assembles full EvidencePacket v1 and writes gated candidates
- Phase 2 objectivity gate runner
- high-emotion + single-episode gating pipeline for understanding writes
- dark-run diagnostics suite for acceptance review

## 4. Phase 2 Contract Summary

Phase 2 introduces a **conservative, gated, abstention-friendly** dark engine that may write:
- candidate/internal `UserMapConclusion`
- candidate/internal `Investigation`
- internal/candidate `ModelUpdate`
- candidate `FieldworkAssignment`
- typed, justified `UnderstandingEvidenceLink`

All writes must be:
- user-scoped
- evidence-linked
- gate-approved
- diagnosable (reason codes + run metadata)

No user-visible promotion path is automatic in Phase 2.

## 5. EvidencePacket v1 Input Contract

Phase 2 must assemble EvidencePacket v1 from existing sources only.

| Source | Role | Weight class | Can support | Cannot prove by itself | Provenance requirements | Required quality gates |
|---|---|---|---|---|---|---|
| `PatternClaim` | Primary behavioral signal | critical | candidate pattern-level conclusions, investigation seeding | durable identity conclusion without corroboration | claim id + userId + linked evidence path | status admissibility, claim freshness, contradiction check |
| `PatternClaimEvidence` | Direct quote/receipt for pattern claims | critical | confidence lift, rationale anchoring | full conclusion semantics alone | quote/snippet + parent claim id + source message/session refs | quote quality, duplication check, out-of-context check |
| `ContradictionNode` | Uncertainty/tension signal | high | investigation creation, conclusion dispute/uncertainty flags | conclusion resolution without additional evidence | node id + status + recent evidence refs | status gate, unresolved/active determination |
| `ContradictionEvidence` | Evidence for/against competing theories | high | investigation movement, disconfirmation handling | standalone user map conclusion | evidence id + linked node id + source refs | contradiction lineage check, quote quality |
| `ProfileArtifact` | Extracted low-level hint | low-to-moderate (0.25–0.45 contribution cap) | candidate hypothesis hints and fieldwork gaps | durable User Map conclusion or supported promotion by itself | artifact id + extractor version + source links | bounded extracted-signal use only; confidence cap; no direct promotion rule |
| `EvidenceSpan` | Provenance anchor | moderate | traceability and receipt integrity | synthesis logic alone | span id + userId + messageId + offsets | offset validity, text availability |
| `ReferenceItem` | Goals/preferences/constraints context | moderate | interpretation context and investigation framing | user-specific conclusion by itself | reference id + type + status + authored timestamps | status gate (active/candidate rules), corroboration gate |
| `SurfacedAction` | Behavior attempt/outcome signal | high | strategy adjustment, uncertainty detection, fieldwork need | complete causal claim alone | action id + status/outcome + linked source | outcome quality, repeated-unclear detection |
| `QuickCheckIn` | State snapshot stream | moderate | state trend hints, high-emotion detection, time spread | stable identity claim by itself | check-in id + timestamp + tags | single-event limitation, emotional dominance guard |
| `JournalEntry` | Long-form reflective evidence | high | narrative continuity, investigation evidence, candidate conclusions | supported conclusion from one entry | entry id + authored/created timestamps | single-entry limitation, quote extraction quality |
| `Session` | Container/timing context | low | temporal grouping and spread analysis | direct claim | session id + origin + startedAt | container-only usage rule |
| `Message` | Atomic utterance evidence | moderate | quote-backed support, contradiction and trend detection | supported conclusion from one message | message id + session linkage + createdAt | single-message limitation, quote quality gate |
| Timeline aggregation | Longitudinal context overlay | high | temporal spread and recurrence context | causal proof alone or persisted provenance link ownership by itself | aggregation window + source references | context-only gate; no-causality gate; aggregation fidelity checks |
| Import pipeline outputs | Historical context from imports | moderate-high | broader longitudinal context | direct proof without user evidence corroboration | import session/chunk ids + parsed provenance | import quality filter, staleness/relevance checks |
| User corrections | Calibration/dispute signal | critical | confidence downgrade, lifecycle changes, reopening investigations | automatic deletion of model history or persisted provenance link ownership by itself | correction source id + timestamp + target reference | downgrade multiplier, corroboration-before-recovery rule; context/diagnostic-first handling when direct ownership mapping is unavailable |

Locked boundary rule:
- User-specific conclusions require user evidence.
- External/domain theory may interpret but cannot prove user-specific claims by itself.

Source-label mapping note (implementation alignment):
- Timeline aggregation context maps to `UnderstandingLinkSourceType.timeline_aggregation`.
- User correction context maps to `UnderstandingLinkSourceType.user_correction`.
- Import pipeline outputs map to `UnderstandingLinkSourceType.import_record` using existing import/upload persisted conventions.

Phase 2 handling rule for non-linkable source labels:
- `timeline_aggregation` and `user_correction` may be included in EvidencePacket v1 as bounded context/diagnostic/calibration inputs.
- They must not be persisted as `UnderstandingEvidenceLink` sources unless a concrete, verifiable same-user ownership mapping path is explicitly defined and approved in a later implementation prompt.
- Phase 2 must not fake ownership checks for these source types.
- If no safe mapping exists, treat them as non-link context inputs and surface their influence via diagnostics/rejection reasons, not persisted provenance links.
- Any candidate object materially influenced by these inputs must also include linkable/verifiable evidence from other approved source types before persistence.

## 6. Evidence Packet Assembly Requirements

EvidencePacket v1 assembly must:
- be fully user-scoped
- include typed provenance for every item
- preserve source identity and timestamps
- attach quality flags per item
- compute source diversity and time-spread metrics
- mark high-emotion dominance signals
- capture correction signals and active contradictions

EvidencePacket v1 assembly must not:
- infer missing provenance
- silently coerce weak artifacts into strong evidence
- treat import/profile/reference context as standalone proof
- include opaque “LLM intuition” without linked user evidence
- persist non-linkable context inputs (`timeline_aggregation`, `user_correction`) as provenance links without an explicitly approved ownership mapping path

## 7. Dark-Run Behavior Contract

During Phase 2 dark-run, engine execution may:
- assemble EvidencePacket v1
- generate candidate hypotheses
- create candidate/internal `UserMapConclusion` when gates pass
- create candidate `Investigation` when uncertainty is genuine
- create internal/candidate `ModelUpdate` only for meaningful deltas
- create candidate `FieldworkAssignment` for concrete evidence gaps
- create typed, justified `UnderstandingEvidenceLink`
- abstain with explicit reason codes when gates fail

Phase 2 dark-run must not:
- produce supported durable conclusions from one episode
- auto-create user-visible `ModelUpdate`
- fabricate “insight of the day” entries
- write broad personality claims from sparse evidence
- overfit high-emotion episodes into identity claims
- treat `ProfileArtifact`/`ReferenceItem`/imports as sufficient alone
- invoke Phase 7 multi-lens deliberation architecture

## 8. Objectivity Gates and Threshold Constants

These constants are conservative initial defaults for Phase 2. Tune only after dark-run evaluation.

### 8.1 UserMapConclusion thresholds
- `UMAP_MIN_EVIDENCE_EMERGING = 2`
- `UMAP_MIN_SOURCE_TYPES_EMERGING = 2`
- `UMAP_MIN_EVIDENCE_SUPPORTED = 4`
- `UMAP_MIN_SOURCE_TYPES_SUPPORTED = 2`
- `UMAP_MIN_TIME_SPREAD_DAYS_SUPPORTED = 7`

### 8.2 Confidence caps
- `UMAP_CONF_CAP_2_EVIDENCE = 0.30`
- `UMAP_CONF_CAP_3_TO_5_EVIDENCE = 0.50`
- `UMAP_CONF_CAP_6_TO_10_EVIDENCE = 0.70`
- `UMAP_CONF_CAP_10_PLUS_EVIDENCE = 0.85`

### 8.3 Guard rules
- `SINGLE_EPISODE_SUPPORTED_BLOCK = true`
- `HIGH_EMOTION_STATUS_CAP = emerging`
- `HIGH_EMOTION_IDENTITY_CLAIM_BLOCK = true`
- `LANGUAGE_OVERCLAIMING_BLOCK = true`
- `RECEIPT_REQUIRED_FOR_PROMOTION = true`

### 8.4 ModelUpdate delta gates
- `MODEL_UPDATE_REQUIRES_MEANINGFUL_DELTA = true`
- `MODEL_UPDATE_REQUIRES_EVIDENCE_LINK = true`
- `MODEL_UPDATE_MIN_CONF_DELTA = 0.08`
- `MODEL_UPDATE_BLOCK_SYNTHETIC_DAILY_INSIGHT = true`

### 8.5 Investigation/Fieldwork gates
- `INVESTIGATION_RESOLVE_MIN_EVIDENCE = 3`
- `INVESTIGATION_RESOLVE_MIN_SOURCE_TYPES = 2`
- `INVESTIGATION_RESOLVE_MIN_COMPETING_THEORIES = 2`
- `INVESTIGATION_RESOLVE_REQUIRES_FIELDWORK_OR_EXPERIMENT = true`
- `INVESTIGATION_RESOLVE_BLOCK_IF_ACTIVE_BLOCKING_CONTRADICTION = true`
- `FIELDWORK_ASSIGN_IF_EVIDENCE_GAP = true`
- `FIELDWORK_ASSIGN_IF_EMERGING_STALE_DAYS = 14`
- `FIELDWORK_ASSIGN_IF_REPEATED_UNCLEAR_OUTCOMES = true`

### 8.6 Correction calibration
- `CORRECTION_CONFIDENCE_MULTIPLIER = 0.50`
- correction-driven downgrades apply before any confidence recovery
- recovery requires new corroborating evidence

### 8.7 Mandatory abstention rule
When required gates fail, engine must abstain and emit explicit failure reason(s) instead of writing candidates.

## 9. Object Creation Policy by Model

### 9.1 `UserMapConclusion`
Phase 2 may create:
- candidate/internal conclusions only after threshold + safety gate pass
- `emerging` status only if `>=2` evidence items and `>=2` source types
- `supported` status only if all supported thresholds pass

Phase 2 must not:
- create `supported` from one episode
- produce identity-level claims from acute/high-emotion evidence alone
- bypass provenance/receipt requirements

Additional rule:
- if high-emotion dominates new evidence, cap at `emerging` and block identity language until non-acute corroboration.

### 9.2 `Investigation`
Phase 2 may create investigations when one or more are true:
- unresolved contradiction
- competing theories need adjudication
- evidence gap blocks conclusion confidence
- user correction reopens uncertainty

Phase 2 must not:
- generate generic curiosity spam
- create investigation without organizing question/seed
- mark resolved without resolution thresholds

Required minimum fields on creation:
- organizing question
- seed type
- `competingTheories` array (required; may be empty)
- `evidenceNeeded` array (required; may be empty)

### 9.3 `ModelUpdate`
Phase 2 may create model updates only when:
- real object movement occurred
- meaningful delta gate passed
- evidence link exists

Phase 2 must not:
- log backend churn as user-relevant movement
- create fake novelty updates
- auto-promote to `user_visible`

Default visibility in Phase 2:
- `internal_only` or `candidate`
- user-visible promotion requires later explicit policy gate

### 9.4 `FieldworkAssignment`
Phase 2 may create fieldwork assignments when:
- a concrete evidence gap blocks confidence
- investigation progression needs observation signal
- recurring ambiguity persists

Phase 2 must enforce:
- observation-only framing (not prescriptive action)
- specific, lightweight prompts
- direct link to uncertainty/conclusion/investigation context

Phase 2 must not:
- generate generic journaling homework
- merge fieldwork into action semantics

### 9.5 `UnderstandingEvidenceLink`
Phase 2 may create links only when:
- source/target types are valid enum values
- source and target are user-scoped and resolvable
- link role is justified
- dedupe uniqueness is respected
- for `timeline_aggregation` / `user_correction`, an explicitly approved and verifiable same-user ownership mapping exists (otherwise no persisted link writes for these sources)

Phase 2 must not:
- write orphan links
- write untyped/free-form links
- write links with unverifiable provenance
- fake ownership verification for non-linkable source labels

## 10. High-Emotion and Safety Boundary

For distressed/suicidal/panicked/ashamed/angry/dysregulated evidence:
- preserve evidence as data when appropriate
- separate raw evidence from durable identity interpretation
- prefer stabilization framing, investigation, or fieldwork over durable conclusions
- avoid deterministic “you are X” language
- cap confidence/status unless corroborated by non-acute evidence
- block diagnosis/therapy-style framing in understanding objects

Safety posture:
- no therapy positioning
- no diagnostic labeling
- no moralizing language
- no identity crystallization from acute-state evidence alone

## 11. Candidate vs User-Visible Policy

Phase 2 allows:
- candidate/internal writes after gate pass
- internal diagnostics for gate outcomes

Phase 2 does not allow automatic user-visible movement:
- `ModelUpdate.user_visible` is not auto-generated
- “What Changed” exposure requires explicit later promotion path
- absence of updates is acceptable and preferred over synthetic movement
- no fake progress bars or fake completion percentages

User-facing update eligibility (future promotion path) must require:
- meaningful delta
- linked receipts/provenance
- safe/objective language
- real affected object change

## 11A. Phase 2 UserMapConclusion Candidate Persistence Contract

This section is a narrowing amendment for the first candidate-persistence step. Where this section conflicts with broader Phase 2 language, this section wins for first-write scope.

### 11A.1 Allowed object scope (first persistence step)
- Only `UserMapConclusion` is in scope for first candidate persistence.
- `Investigation`, `ModelUpdate`, and `FieldworkAssignment` remain dry-run only.
- `UnderstandingEvidenceLink` writes are allowed only as required provenance links for a newly created `UserMapConclusion`, via shared library writer logic (`lib/understanding-evidence-link-writer.ts`), not route-local ad hoc validation.
- `timeline_aggregation` and `user_correction` are context-only and must not be persisted as `UnderstandingEvidenceLink` sources in this step.

### 11A.2 Visibility prerequisite and candidate exposure rule (locked)
- Candidate `UserMapConclusion` persistence is blocked until **all** of the following are implemented and verified:
  - `UserMapConclusion.visibility` exists with `UserMapConclusionVisibility` enum semantics.
  - `visibility` defaults/backfill existing rows to `user_visible`.
  - default `GET /api/user-map/conclusions` excludes `internal_only`.
  - default `GET /api/user-map/conclusions/[id]` does not expose `internal_only` rows by direct ID access.
- No candidate persistence is allowed before visibility migration + route filtering are complete.
- Once the visibility prerequisite is implemented and verified:
  - first-step dark-engine candidate writes may persist only as `visibility=internal_only`.
  - `visibility=user_visible` is forbidden for first-step dark-engine candidate persistence.
  - promotion from `internal_only` to `user_visible` is out of scope for first-step persistence.

### 11A.3 Status rules (when visibility is unblocked)
- `abstain`: write nothing.
- `pass`: may write at most `emerging` in first step.
- `pass_with_cap`: may write at most `tentative` in first step.
- `supported` must not be written in first persistence step, even if gate math could allow it.
- First-write posture is candidate-level only (`tentative`/`emerging`), never `supported`.

### 11A.4 Confidence cap to `UserMapConfidenceLevel` mapping
- Use `confidenceScore = min(gateConfidenceCap, post-correction-cap)`.
- Map score to level conservatively:
  - `<= 0.30` => `low`
  - `> 0.30` and `<= 0.55` => `medium` only if minimum evidence/source gates pass
  - `> 0.55` => still `medium` in first persistence step
- `high` confidence is not allowed in first persistence step.

### 11A.5 Area/category mapping
- `area` must be an explicit required enum value (`UserMapConclusionArea`) on the candidate write target.
- No free-form area strings and no implicit LLM-only area inference are allowed.
- If `area` is missing or not a valid enum value, block write.

### 11A.6 Title and summary strategy
- `title` must come from an explicit candidate field or deterministic formatter output, not ad hoc free-form generation at write time.
- `summary` must come from the gated candidate summary text with safety/language checks applied.
- Conservative max lengths for first step:
  - `title`: 120 chars
  - `summary`: 600 chars
- Block overclaiming language and deterministic identity framing.
- If high-emotion cap/block is active, identity-level claims are forbidden; uncertainty wording must be preserved.

### 11A.7 Dedupe / upsert policy
- No blind insert.
- Before create, check exact duplicate for same `userId` + `area` + normalized `title` + normalized `summary` on non-superseded rows.
- Exact duplicate: do not create a new row; count as `duplicateCandidates` in diagnostics.
- Near-duplicate heuristics may be added later, but first step must at minimum prevent exact-duplicate spam.
- First step must not overwrite existing rows, must not auto-supersede existing conclusions, and must not mutate existing active/supported conclusions.

### 11A.8 Evidence-link policy for candidate write
- Minimum linkable evidence for a persisted conclusion:
  - at least 2 linkable evidence items
  - from at least 2 allowed source types
- Allowed source types for persisted links are the currently verifiable/source-owned types supported by the shared writer contract (for example: `pattern_claim`, `pattern_claim_evidence`, `contradiction_node`, `contradiction_evidence`, `profile_artifact`, `evidence_span`, `reference_item`, `surfaced_action`, `quick_check_in`, `journal_entry`, `session`, `message`, `import_record`).
- Disallowed source types for persisted links in this step: `timeline_aggregation`, `user_correction`.
- All links must target `UnderstandingLinkTargetType.usermap_conclusion`.
- Ownership must be verifiable via shared writer rules only; no synthetic ownership mapping.
- If required links cannot be created safely, do not persist the conclusion.

### 11A.9 Write transaction policy
- `UserMapConclusion` create and required `UnderstandingEvidenceLink` creates must be atomic (single transaction) where supported.
- If any required link write fails, roll back the conclusion write.
- Duplicate link tuples inside the attempted set must be deduped before write attempt.
- Duplicate candidate outcome is non-fatal but must result in no additional row write.

### 11A.10 Mandatory block conditions
Block persistence when any of the following is true:
- gate outcome is `abstain`
- missing/invalid `area`
- missing/invalid `title` or `summary`
- insufficient linkable evidence count or source diversity
- support relies only on non-linkable context inputs
- unresolved ownership for required links
- high-emotion identity block active
- language overclaiming block active
- disconfirmation remains unresolved under abstention conditions
- correction downgrade active when requested status/confidence would exceed corrected cap

### 11A.11 Diagnostics requirements when persistence is attempted
Dark-run diagnostics artifact must include, in addition to existing counters:
- `candidatesProposed`
- `candidatesWritten`
- `evidenceLinksAttempted`
- `evidenceLinksWritten`
- `blockedWriteReasons`
- `duplicateCandidates`
- `rollbackCount`

### 11A.12 Non-goals lock (first persistence step)
- no `Investigation` persistence
- no `ModelUpdate` persistence
- no `FieldworkAssignment` persistence
- no runtime triggers
- no UI/mobile work
- no agents/lenses
- no Intelligence Library/domain retrieval
- no automatic promotion to `supported`
- no automatic promotion to `high` confidence

## 12. Dark-Run Evaluation Protocol

Before any UI exposure, Phase 2 must run dark evaluations with diagnostics.

### 12.1 Run-level diagnostics
Record at minimum:
- packets assembled
- candidates proposed
- candidates written
- abstentions
- gate rejections by reason
- high-emotion caps/blocks
- single-episode blocks
- visibility outcomes (`internal_only` vs `candidate`)

### 12.2 Rejection reason taxonomy
Use explicit codes, for example:
- `INSUFFICIENT_EVIDENCE_COUNT`
- `INSUFFICIENT_SOURCE_DIVERSITY`
- `INSUFFICIENT_TIME_SPREAD`
- `HIGH_EMOTION_DOMINANCE_CAP`
- `SINGLE_EPISODE_SUPPORTED_BLOCK`
- `MISSING_PROVENANCE`
- `LOW_QUOTE_QUALITY`
- `DISCONFIRMATION_UNRESOLVED`
- `CORRECTION_DOWNGRADE_ACTIVE`
- `NO_MEANINGFUL_DELTA`

### 12.3 Required audit slices
- evidence packet spot samples
- gate-failure samples
- high-emotion guard samples
- single-episode block samples
- false-positive audit
- link integrity audit (typed/source-target/ownership)
- imported-vs-native evidence split analysis
- no-regression checks for patterns/contradictions/actions/timeline

### 12.4 Manual review checklist
- Are claims receipt-backed and bounded?
- Are alternative explanations considered before writes?
- Are uncertain cases abstained rather than forced?
- Are high-emotion events over-weighted?
- Are corrections downgrading confidence appropriately?
- Are updates reflecting real movement only?

## 13. Integration Architecture (Implementation Guidance, No Code Changes)

Phase 2 should be implemented as minimal additive modules aligned with current repo patterns.

Recommended component boundaries:
- `EvidencePacketAssembler` (user-scoped source adapters, packet metrics)
- `CandidateSynthesizer` (conservative hypothesis generation)
- `ObjectivityGateEvaluator` (thresholds + safety + abstention)
- `HighEmotionGuard` (acute-state caps/blocks)
- `MeaningfulDeltaEvaluator` (model movement scoring)
- `UnderstandingLinkWriter` (typed evidence link persistence)
- `DarkRunDiagnosticsReporter` (run stats + rejection taxonomy)

Likely integration points in current architecture:
- existing derivation lifecycle patterns in `lib/derivation-layer.ts`
- orchestration pattern from `lib/pattern-batch-orchestrator.ts`
- async trigger boundary style from `lib/native-derivation-trigger.ts`
- existing understanding object validation/lifecycle in `lib/understanding-engine-api.ts`
- existing link integrity constraints in `app/api/understanding/evidence-links/route.ts`

Likely persistence context:
- can reuse `DerivationRun` / `DerivationArtifact` for run diagnostics metadata if extension is additive and safe
- understanding object writes stay in existing Phase 1A tables
- link writes stay in `UnderstandingEvidenceLink`

## 14. Explicit Non-Goals / Anti-Creep

Phase 2 must exclude:
- UI changes
- mobile changes
- Explore runtime behavior changes
- Actions/Experiments semantic expansion
- Timeline model-event layers
- Phase 7 agents/lenses
- Intelligence Library and domain retrieval
- Generative Self-Model
- Meta-Observer / Blind Spot Engine
- model maturity signals
- therapy branding/diagnostic experiences
- automatic user-visible claim feeds
- random insight generation
- broad profiling from sparse evidence
- schema changes or migrations unless separately approved in a later prompt

## 15. Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Over-claiming from sparse evidence | strict threshold gates + abstention + confidence caps |
| High-emotion overfit | dedicated high-emotion guard + identity claim block |
| Random insight feed drift | meaningful-delta gate + no auto user-visible updates |
| Link garbage | typed enums + ownership checks + dedupe + diagnostics |
| Imported/context data overweighting | bounded weight class + corroboration requirements |
| Contradiction blindness | mandatory disconfirmation/contradiction check before promotion |
| Hidden regressions in existing systems | no-regression checks against patterns/contradictions/actions/timeline |

## 16. Phase 2 Implementation Readiness

### 16.1 What the next Phase 2 implementation prompt should do
- implement dark-run EvidencePacket v1 assembly
- implement gate evaluator with locked threshold constants
- for first persistence work, follow Section 11A scope only
- do not write `UserMapConclusion` rows until visibility migration + default route filters are implemented and verified
- implement abstention + rejection reason recording
- implement diagnostics reporting outputs for review
- keep all writes user-scoped and provenance-linked

### 16.2 What the prompt must inspect first
- current schema and existing Phase 1A/1B/1C contracts
- existing derivation orchestration/lifecycle modules
- ownership/validation conventions already used in understanding APIs
- existing evidence source identities and join paths

### 16.3 What the prompt must not touch
- Prisma schema or migrations
- existing endpoint default response contracts
- UI/mobile routes/components
- agent/domain-knowledge/Intelligence Library work
- timeline model-event layers
- automatic user-visible promotion

### 16.4 Tests and diagnostics required for implementation
- unit tests for gate thresholds and transitions
- unit tests for high-emotion and single-episode blocks
- unit tests for meaningful delta evaluator
- integration tests for candidate write vs abstain behavior
- integration tests for link integrity and ownership
- dark-run diagnostics test assertions (reason codes, counts)
- no-regression tests proving existing pattern/contradiction/action/timeline behavior remains stable

### 16.5 Blockers that must halt implementation
- unresolved provenance mapping for required evidence inputs
- inability to enforce user-scoped ownership on link writes
- requirement for schema changes without explicit approval prompt
- inability to capture diagnostics/rejection reasons per run

## 17. Final Contract Verdict

Phase 2 dark-run/gating implementation is ready and active under this contract.
UserMapConclusion candidate persistence is blocked until the visibility prerequisite in Section 11A.2 is implemented and verified.

Recommended next implementation prompt title:
- `Step 6 Prompt 2 — Phase 2 Dark Engine Evidence Packet + Objectivity Gates (Dark-Run Only)`
