# ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001

Delivery: `DEL-005` (Assault B)

Machine-readable twin: `docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.json`

Controlling audit: `docs/audits/FULL-ORVEK-LIVE-DATA-INTELLIGENCE-ARCHITECTURE-AUDIT-001.md`

## Purpose

Declare semantic authority for Orvek intelligence objects so live database rows are not
automatically treated as current-model truth, and so projections / movement ledgers /
proposals cannot silently outrank governed canonical objects.

## Production live-provider rule (DEL-003)

Authenticated production: genuine owned live provider data wins; else honest empty/unavailable. Reference/composition cannot suppress live rails except on explicit composition-authority paths.

## Semantic roles

| Role | Meaning |
|---|---|
| `RAW_EVIDENCE` | Receipt / evidence substrate; not automatic current truth |
| `EXPLICIT_MEMORY` | Stable user-provided memory/context/preference/goal |
| `PATTERN_INTELLIGENCE` | Evidence-linked pattern across the five PatternType families |
| `CANONICAL_CURRENT_MODEL` | Governed current-model representation for a concept |
| `CONTRADICTION_OR_CONFLICT` | Canonical contradiction/conflict object |
| `OPEN_INQUIRY` | Investigation process; existence ≠ truth |
| `FIELDWORK_OR_OBSERVATION` | Observation task; not truth; not movement |
| `INTERNAL_CANDIDATE_OR_PROPOSAL` | Reviewable proposal/candidate only |
| `ACTION_PROJECTION` | Action-state projection; not Decision |
| `DECISION` | Reserved future first-class decision |
| `OUTCOME` | Reserved future durable outcome |
| `MODEL_MOVEMENT_LEDGER` | Immutable movement/audit history |
| `USER_FACING_PROJECTION` | Shell/report presentation derived from canonical objects |
| `LEGACY_OR_TRANSLATION_INPUT` | Legacy/translation-layer input; not competing current truth |

## Pattern families (locked)

- `trigger_condition`
- `inner_critic`
- `repetitive_loop`
- `contradiction_drift`
- `recovery_stabilizer`

## Authority matrix

| Object | Canonical role | Raw evidence | Current truth | Strengthens | Candidate-only | Immutable history | Future AI context | Status |
|---|---|---|---|---|---|---|---|---|
| `Session` | `RAW_EVIDENCE` | yes | no | no | no | no | no | `PRESENT` |
| `Message` | `RAW_EVIDENCE` | yes | no | no | no | yes | no | `PRESENT` |
| `JournalEntry` | `RAW_EVIDENCE` | yes | no | no | no | no | no | `PARTIAL` |
| `QuickCheckIn` | `RAW_EVIDENCE` | yes | no | no | no | no | no | `PARTIAL` |
| `ImportUploadSession` | `RAW_EVIDENCE` | yes | no | no | no | no | no | `PARTIAL` |
| `ImportUploadChunk` | `RAW_EVIDENCE` | yes | no | no | no | no | no | `PARTIAL` |
| `EvidenceSpan` | `RAW_EVIDENCE` | yes | no | no | no | yes | no | `PRESENT` |
| `ReferenceItem` | `EXPLICIT_MEMORY` | no | yes | yes | no | no | yes | `PARTIAL` |
| `ProfileArtifact` | `LEGACY_OR_TRANSLATION_INPUT` | no | no | yes | yes | no | no | `PARTIAL` |
| `PatternClaim` | `PATTERN_INTELLIGENCE` | no | no | yes | no | no | no | `PRESENT` |
| `PatternClaimEvidence` | `RAW_EVIDENCE` | yes | no | no | no | yes | no | `PRESENT` |
| `ContradictionNode` | `CONTRADICTION_OR_CONFLICT` | no | yes | yes | no | no | yes | `PRESENT` |
| `ContradictionEvidence` | `RAW_EVIDENCE` | yes | no | no | no | yes | no | `PRESENT` |
| `UserMapConclusion` | `CANONICAL_CURRENT_MODEL` | no | yes | yes | no | no | yes | `PARTIAL` |
| `Investigation` | `OPEN_INQUIRY` | no | no | no | no | no | no | `PARTIAL` |
| `FieldworkAssignment` | `FIELDWORK_OR_OBSERVATION` | no | no | no | no | no | no | `PARTIAL` |
| `ExploreMovementProposal` | `INTERNAL_CANDIDATE_OR_PROPOSAL` | no | no | no | yes | no | no | `PARTIAL` |
| `SurfacedAction` | `ACTION_PROJECTION` | no | no | no | no | no | no | `PARTIAL` |
| `ModelUpdate` | `MODEL_MOVEMENT_LEDGER` | no | no | no | no | yes | no | `PARTIAL` |
| `UnderstandingEvidenceLink` | `RAW_EVIDENCE` | yes | no | no | no | no | no | `PARTIAL` |
| `SurfacedEvidencePointer` | `USER_FACING_PROJECTION` | no | no | no | no | no | no | `PARTIAL` |
| `CanonicalTodayComposition` | `USER_FACING_PROJECTION` | no | no | no | no | no | no | `REFERENCE_ONLY` |
| `CanonicalModelMovementReport` | `USER_FACING_PROJECTION` | no | no | no | no | no | no | `REFERENCE_ONLY` |
| `Decision` | `DECISION` | no | no | no | no | no | no | `RESERVED_FUTURE` |
| `Outcome` | `OUTCOME` | no | no | no | no | no | no | `RESERVED_FUTURE` |
| `UserFacingProjection` | `USER_FACING_PROJECTION` | no | no | no | no | no | no | `PRESENT` |

## Object contracts

### Session

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** _none_
- **Eligibility:** Owned APP or imported session.
- **Correction rule:** Do not rewrite conversational history as model truth.
- **Supersession rule:** Not superseded; remains receipt substrate.
- **Evidence-link expectations:** May be UEL source as session.
- **Production writers:** session create routes; import processor
- **Production readers:** message prompt; Timeline; Explore; patterns
- **User-visible surfaces:** Explore; Timeline
- **Known overlap:** `Message`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### Message

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** _none_
- **Eligibility:** Owned message under owned session.
- **Correction rule:** Preserve original text; corrections are separate objects.
- **Supersession rule:** Immutable evidence; not replaced by ModelUpdate.
- **Evidence-link expectations:** May be UEL source as message; EvidenceSpan FK.
- **Production writers:** message route; import processor; Explore send
- **Production readers:** assistant prompt; patterns; profile; contradictions; Timeline; Explore
- **User-visible surfaces:** Explore; Timeline; Inspector
- **Known overlap:** `EvidenceSpan`, `JournalEntry`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### JournalEntry

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** _none_
- **Eligibility:** Owned journal entry.
- **Correction rule:** User edit of entry text is allowed; does not auto-mutate model objects.
- **Supersession rule:** Not current model truth.
- **Evidence-link expectations:** Optional PatternClaimEvidence FK; UEL source journal_entry.
- **Production writers:** journal entry routes
- **Production readers:** patterns; Today; Timeline; Explore grounding
- **User-visible surfaces:** Timeline; Today
- **Known overlap:** `Message`, `QuickCheckIn`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### QuickCheckIn

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** _none_
- **Eligibility:** Owned check-in.
- **Correction rule:** Preserve original; not model mutation.
- **Supersession rule:** Not current model truth.
- **Evidence-link expectations:** UEL source quick_check_in.
- **Production writers:** check-ins route
- **Production readers:** Timeline; dark engine
- **User-visible surfaces:** Timeline
- **Known overlap:** `JournalEntry`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### ImportUploadSession

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** `LEGACY_OR_TRANSLATION_INPUT`
- **Eligibility:** Owned upload session.
- **Correction rule:** Processing states only; does not become model truth.
- **Supersession rule:** Batch substrate only.
- **Evidence-link expectations:** Mapped as import_record UEL source convention.
- **Production writers:** import upload service; import processor
- **Production readers:** upload status; import review
- **User-visible surfaces:** Import Review
- **Known overlap:** `ImportUploadChunk`, `Session`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### ImportUploadChunk

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** _none_
- **Eligibility:** Owned through upload session.
- **Correction rule:** Temporary; deleted after processing.
- **Supersession rule:** Not model truth.
- **Evidence-link expectations:** Import substrate only.
- **Production writers:** import upload service
- **Production readers:** import processor
- **User-visible surfaces:** _none_
- **Known overlap:** `ImportUploadSession`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### EvidenceSpan

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** _none_
- **Eligibility:** Owned span with Message FK.
- **Correction rule:** Immutable exact quote location.
- **Supersession rule:** Never rewritten as current model.
- **Evidence-link expectations:** UEL source evidence_span; profile/contradiction lineage.
- **Production writers:** derivation ensureEvidenceSpan; contradiction ingestion
- **Production readers:** profile links; contradiction lineage; Inspector
- **User-visible surfaces:** Inspector
- **Known overlap:** `Message`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### ReferenceItem

- **Canonical role:** `EXPLICIT_MEMORY`
- **Secondary roles:** `CANONICAL_CURRENT_MODEL`
- **Eligibility:** Active qualifying owned ReferenceItem (not candidate-only).
- **Correction rule:** User archive/supersede; preserve originals.
- **Supersession rule:** Superseded/archived lose future-AI eligibility.
- **Evidence-link expectations:** UEL source reference_item; not PatternClaim or ModelUpdate.
- **Production writers:** reference memory writers; import review accept
- **Production readers:** assistant prompt; Map context; Explore grounding; import review
- **User-visible surfaces:** Map context; Import Review; Inspector
- **Known overlap:** `ProfileArtifact`, `UserMapConclusion`, `PatternClaim`
- **Migration/translation:** Do not merge into ProfileArtifact/PatternClaim/UMC in this delivery.

### ProfileArtifact

- **Canonical role:** `LEGACY_OR_TRANSLATION_INPUT`
- **Secondary roles:** `INTERNAL_CANDIDATE_OR_PROPOSAL`
- **Eligibility:** Owned candidate artifact; never outranks governed canonical current object.
- **Correction rule:** May supply evidence/candidate input only.
- **Supersession rule:** Cannot independently compete where qualifying UMC/Reference/Contradiction exists.
- **Evidence-link expectations:** ProfileArtifactEvidenceLink to spans; UEL source profile_artifact.
- **Production writers:** profile derivation; import extraction
- **Production readers:** dark-engine evidence packet
- **User-visible surfaces:** _none_
- **Known overlap:** `ReferenceItem`, `PatternClaim`, `UserMapConclusion`
- **Migration/translation:** Translation-layer only until authorised inventory (DEL-009).

### PatternClaim

- **Canonical role:** `PATTERN_INTELLIGENCE`
- **Secondary roles:** _none_
- **Eligibility:** One of five PatternType families; evidence-linked; lifecycle qualifying.
- **Correction rule:** Governed correction/weakening deferred to DEL-006; preserve five families.
- **Supersession rule:** Strengthens model; is not the entire current model; not ModelUpdate.
- **Evidence-link expectations:** PatternClaimEvidence + UEL source/target pattern_claim.
- **Production writers:** pattern detector v1; pattern lifecycle
- **Production readers:** Map; Inspector; actions; Explore grounding
- **User-visible surfaces:** Map; Inspector; Decisions
- **Known overlap:** `UserMapConclusion`, `ProfileArtifact`, `ReferenceItem`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### PatternClaimEvidence

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** `PATTERN_INTELLIGENCE`
- **Eligibility:** Owned through PatternClaim.
- **Correction rule:** Append-only receipts.
- **Supersession rule:** Does not become current model alone.
- **Evidence-link expectations:** UEL source pattern_claim_evidence.
- **Production writers:** pattern claim evidence writers
- **Production readers:** pattern lifecycle; Inspector; Explore grounding
- **User-visible surfaces:** Inspector
- **Known overlap:** `EvidenceSpan`, `Message`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### ContradictionNode

- **Canonical role:** `CONTRADICTION_OR_CONFLICT`
- **Secondary roles:** `CANONICAL_CURRENT_MODEL`
- **Eligibility:** Confirmed/qualifying open contradiction; controlled ingestion gate unchanged.
- **Correction rule:** Lifecycle transitions; preserve dual-source evidence.
- **Supersession rule:** Resolved/dismissed lose normal future-interpretation effect.
- **Evidence-link expectations:** ContradictionEvidence + UEL target contradiction_node.
- **Production writers:** contradiction production ingestion
- **Production readers:** assistant prompt; Map conflicts; Today; Inspector
- **User-visible surfaces:** Map; Today; Inspector; contradiction review
- **Known overlap:** `PatternClaim`, `UserMapConclusion`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### ContradictionEvidence

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** `CONTRADICTION_OR_CONFLICT`
- **Eligibility:** Owned through ContradictionNode.
- **Correction rule:** Append evidence; preserve lineage.
- **Supersession rule:** Not current truth alone.
- **Evidence-link expectations:** UEL source contradiction_evidence.
- **Production writers:** contradiction writers
- **Production readers:** contradiction detail; Inspector
- **User-visible surfaces:** Inspector
- **Known overlap:** `EvidenceSpan`, `Message`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### UserMapConclusion

- **Canonical role:** `CANONICAL_CURRENT_MODEL`
- **Secondary roles:** _none_
- **Eligibility:** Qualifying current owned UserMapConclusion for the concept.
- **Correction rule:** User/Inspector correction; preserve prior versions via supersession.
- **Supersession rule:** Where qualifying UMC exists, it outranks movement-ledger ModelUpdate as current representation.
- **Evidence-link expectations:** UEL target usermap_conclusion.
- **Production writers:** candidate publish helper; UMC correction writers
- **Production readers:** Map; Today; Explore grounding; Inspector; reports
- **User-visible surfaces:** Map; Today; Inspector
- **Known overlap:** `PatternClaim`, `ReferenceItem`, `ProfileArtifact`, `ModelUpdate`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### Investigation

- **Canonical role:** `OPEN_INQUIRY`
- **Secondary roles:** _none_
- **Eligibility:** Owned investigation; open status is not current truth.
- **Correction rule:** Lifecycle open/active/resolved/archived.
- **Supersession rule:** Open inquiry is not current truth merely because it exists.
- **Evidence-link expectations:** UEL target investigation.
- **Production writers:** investigation publish helper
- **Production readers:** Explore; Today; Timeline; Inspector
- **User-visible surfaces:** Explore Active Questions/Investigations; Today
- **Known overlap:** `FieldworkAssignment`, `UserMapConclusion`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### FieldworkAssignment

- **Canonical role:** `FIELDWORK_OR_OBSERVATION`
- **Secondary roles:** _none_
- **Eligibility:** Owned visible fieldwork assignment.
- **Correction rule:** Observation/check-in updates; not model mutation.
- **Supersession rule:** Not current truth; not model movement.
- **Evidence-link expectations:** UEL target fieldwork_assignment.
- **Production writers:** fieldwork publish helper
- **Production readers:** Explore Fieldwork; Today; Timeline; Inspector
- **User-visible surfaces:** Explore Experiment/Fieldwork; Today
- **Known overlap:** `Investigation`, `SurfacedAction`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### ExploreMovementProposal

- **Canonical role:** `INTERNAL_CANDIDATE_OR_PROPOSAL`
- **Secondary roles:** _none_
- **Eligibility:** User-reviewable proposal only; Phase 0 containment active.
- **Correction rule:** Reject/publish gates; unsafe fixed semantics contained (DEL-001A).
- **Supersession rule:** Not current model truth; not ModelUpdate until governed publish.
- **Evidence-link expectations:** sourcesJson; publish may materialize UEL.
- **Production writers:** explore movement proposal helpers
- **Production readers:** Explore review; Inspector
- **User-visible surfaces:** Explore
- **Known overlap:** `ModelUpdate`, `UserMapConclusion`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### SurfacedAction

- **Canonical role:** `ACTION_PROJECTION`
- **Secondary roles:** `USER_FACING_PROJECTION`
- **Eligibility:** Owned surfaced action row.
- **Correction rule:** Action-state transitions; not Decision schema.
- **Supersession rule:** Not automatically a genuine user Decision; does not own model truth.
- **Evidence-link expectations:** UEL target/source surfaced_action; scalar linked claim/goal IDs.
- **Production writers:** actions-v1
- **Production readers:** Today; Decisions; Timeline; Inspector
- **User-visible surfaces:** Decisions; Today
- **Known overlap:** `Decision`, `PatternClaimAction`, `Outcome`
- **Migration/translation:** Future Decision object is DEL-004; do not fabricate Decision rows here.

### ModelUpdate

- **Canonical role:** `MODEL_MOVEMENT_LEDGER`
- **Secondary roles:** _none_
- **Eligibility:** Owned published movement ledger row.
- **Correction rule:** Immutable audit trail; do not mutate as current object.
- **Supersession rule:** Not itself the canonical current model object; target mutation is DEL-007.
- **Evidence-link expectations:** UEL target model_update; affected object scalar type/id.
- **Production writers:** model update publish helpers; Explore publish
- **Production readers:** Today; Timeline; Map preview; Explore; Inspector/report
- **User-visible surfaces:** Today; Timeline; Reports/What Changed; Model Movement
- **Known overlap:** `UserMapConclusion`, `ExploreMovementProposal`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### UnderstandingEvidenceLink

- **Canonical role:** `RAW_EVIDENCE`
- **Secondary roles:** `MODEL_MOVEMENT_LEDGER`
- **Eligibility:** Owned polymorphic link with supported pair + ownership checks.
- **Correction rule:** Lineage only; not semantic truth authority.
- **Supersession rule:** Proves edges; does not become current truth.
- **Evidence-link expectations:** Unique target/source/role tuple; validate ownership-verifiable pair + ownership. timeline_aggregation and user_correction are reserved non-writable sources.
- **Production writers:** understanding-evidence-link-writer; publish helpers
- **Production readers:** Inspector; report builders
- **User-visible surfaces:** Inspector
- **Known overlap:** `SurfacedEvidencePointer`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### SurfacedEvidencePointer

- **Canonical role:** `USER_FACING_PROJECTION`
- **Secondary roles:** _none_
- **Eligibility:** Owned pointer for Today/Inspector depth overlay.
- **Correction rule:** Projection only; must derive from canonical objects/evidence.
- **Supersession rule:** Must not become parallel truth store.
- **Evidence-link expectations:** Scalar model/source IDs; rationale relation.
- **Production writers:** live evidence depth write hook
- **Production readers:** Today evidence-depth overlay; Inspector
- **User-visible surfaces:** Today; Inspector
- **Known overlap:** `UnderstandingEvidenceLink`, `ModelUpdate`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

### CanonicalTodayComposition

- **Canonical role:** `USER_FACING_PROJECTION`
- **Secondary roles:** `LEGACY_OR_TRANSLATION_INPUT`
- **Eligibility:** Reference/dev/test only; never production authority (DEL-003).
- **Correction rule:** Persisted rows ignored in production runtime; no destructive delete.
- **Supersession rule:** Live providers outrank composition.
- **Evidence-link expectations:** Embedded densograph IDs; no relational lineage.
- **Production writers:** exact/full reference seed (dev)
- **Production readers:** dev live-candidate composition path; tests
- **User-visible surfaces:** dev composition routes only
- **Known overlap:** `CanonicalModelMovementReport`
- **Migration/translation:** Deployed inventory/cleanup deferred to DEL-009.

### CanonicalModelMovementReport

- **Canonical role:** `USER_FACING_PROJECTION`
- **Secondary roles:** `LEGACY_OR_TRANSLATION_INPUT`
- **Eligibility:** Reference/dev/test report snapshot only.
- **Correction rule:** Not live ModelUpdate authority in production.
- **Supersession rule:** Live movement/report projections outrank.
- **Evidence-link expectations:** Related IDs as JSON arrays.
- **Production writers:** exact/full reference seed (dev)
- **Production readers:** dev composition path; tests
- **User-visible surfaces:** dev composition routes only
- **Known overlap:** `ModelUpdate`, `CanonicalTodayComposition`
- **Migration/translation:** Deployed inventory deferred to DEL-009.

### Decision

- **Canonical role:** `DECISION`
- **Secondary roles:** _none_
- **Eligibility:** Reserved future contract; no schema in this task.
- **Correction rule:** DEL-004 will implement persistence.
- **Supersession rule:** SurfacedAction must not masquerade as Decision.
- **Evidence-link expectations:** Reserved; must link evidence when implemented.
- **Production writers:** _none_
- **Production readers:** _none_
- **User-visible surfaces:** Decisions shell (future)
- **Known overlap:** `SurfacedAction`, `Outcome`
- **Migration/translation:** No fabricated Decision rows; DEL-004 owns implementation.

### Outcome

- **Canonical role:** `OUTCOME`
- **Secondary roles:** _none_
- **Eligibility:** Reserved future contract; no schema in this task.
- **Correction rule:** DEL-004 will implement durable outcome truth.
- **Supersession rule:** Local React outcome state is not Outcome authority.
- **Evidence-link expectations:** Reserved; must link decision + evidence when implemented.
- **Production writers:** _none_
- **Production readers:** _none_
- **User-visible surfaces:** Decisions / Inspector (future)
- **Known overlap:** `SurfacedAction`, `Decision`
- **Migration/translation:** No fabricated Outcome rows; DEL-004 owns implementation.

### UserFacingProjection

- **Canonical role:** `USER_FACING_PROJECTION`
- **Secondary roles:** _none_
- **Eligibility:** Today/Map/Timeline/Inspector/report cards must derive from canonical objects.
- **Correction rule:** Change data adapters, not parallel truth stores.
- **Supersession rule:** Projections never outrank canonical objects.
- **Evidence-link expectations:** Must retain inspectable live IDs/evidence.
- **Production writers:** production page APIs; hybrid workbench
- **Production readers:** canonical shell pages; Inspector
- **User-visible surfaces:** Today; Map; Decisions; Timeline; Explore; Reports
- **Known overlap:** `CanonicalTodayComposition`, `SurfacedEvidencePointer`
- **Migration/translation:** No migration in DEL-005; preserve existing rows.

## Evidence-link supported pairs

A supported pair means the current UnderstandingEvidenceLink writer can ownership-verify both ends. It does not independently prove a semantic claim is true. Prisma enum values timeline_aggregation and user_correction remain reserved/deferred and are not writer-eligible.

Runtime writers must validate source/target pairs against the JSON `evidenceLinkSupportedPairs`
list (91 pairs) and reject cross-user or missing targets.

Reserved non-writable Prisma enum sources (not currently writer-eligible):

- `timeline_aggregation`
- `user_correction`

## Deferred items

| ID | Reason | Requires |
|---|---|---|
| `DEL-009-COMPOSITION-ROW-INVENTORY` | Deployed CanonicalTodayComposition / report row counts and ownership were not inspected. | Authorised read-only deployed inventory |
| `DEL-009-ORPHAN-POLYMORPHIC-LINK-INVENTORY` | Orphan rates for polymorphic UEL / scalar affected-object IDs need deployed inventory before migration. | Authorised read-only deployed inventory |
| `DEL-004-DECISION-OUTCOME-SCHEMA` | Decision and Outcome are reserved contracts only; no schema in this delivery. | Approved schema contract in DEL-004 |
| `DEL-007-TARGET-OBJECT-MUTATION` | ModelUpdate ledger does not yet mutate the affected current-model object. | DEL-007 authorised implementation |

## Non-goals for this delivery

- No Prisma schema changes
- No migrations
- No deployed data deletion/cleanup
- No Decision/Outcome persistence
- No ModelUpdate target-object mutation (DEL-007)
- No contradiction ingestion activation
- No live provider calls / deployed DB connections
