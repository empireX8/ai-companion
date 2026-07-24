# OLD-TO-NEW-INTELLIGENCE-COMPATIBILITY-AUDIT-001

Date: `2026-07-24`

Repository: `empireX8/ai-companion`

Branch: `desktop-old-new-intelligence-compatibility-audit-001`

Base commit: `44d9ac939dd889818b6c3a16ef7bab4f968cabbe`

## Executive Verdict

The audit completed as a read-only repository audit. The current Orvek product is not
whole-product production ready.

The production root uses one canonical live shell and starts from an honest empty provider.
Several genuine, owned database readers are connected to Map, Today, Timeline, Explore,
Inspector, and the import-review overlay. The contradiction path is the proven control:
`PASS_PROVEN_CONTROLLED_PRODUCTION_PATHWAY`.

The remaining architecture is not one continuous old-to-new intelligence system:

1. `ProfileArtifact`, `ReferenceItem`, `PatternClaim`, and `UserMapConclusion` overlap without
   one declared semantic authority.
2. Normal message and import processing can create the four understanding-engine candidate
   families, but the complete operator review page is masked by the canonical shell.
3. Persisted exact/reference composition rows can replace most live workbench rails.
4. The canonical Decisions page presents template-derived `SurfacedAction` rows as decisions.
   Its visible outcome action is local component state and falsely says the outcome will be
   folded into the model.
5. Explore can publish a real, evidence-linked `ModelUpdate`, but publication does not mutate
   the affected model object and the general assistant prompt does not consume
   `UserMapConclusion`, `PatternClaim`, `Investigation`, `FieldworkAssignment`, or
   `ModelUpdate`.
6. The current schema has no first-class `UserMap`, goal, decision, outcome, active-question,
   uncertainty, contextual-trigger, or receipt table. Some concepts are represented indirectly;
   some are not implemented.
7. Current record counts and orphan/coverage rates are blocked because no sanctioned general
   immutable/read-only database harness was found. No database connection was attempted.

Seven bounded implementation deliveries remain. The first is
`CANONICAL-UNDERSTANDING-CANDIDATE-REVIEW-RESTORATION-001`.

## Scope And Boundaries

### VERIFIED

- The complete current Prisma schema and relevant migration history were inspected.
- Normal message, chunked import, extraction, candidate, publish, evidence, provider, hybrid,
  shell, and canonical presentation paths were traced statically.
- Production provider precedence and reference/fixture boundaries were traced from the mounted
  root component.
- No database query, mutation, model-provider call, runtime activation, commit, or push occurred.

### INFERRED

- A production account containing a `CanonicalTodayComposition` row would see composition-owned
  rails because the authenticated route reads that row and the hybrid provider gives it
  precedence. Actual account row presence is unknown because database access was blocked.
- Existing internal candidates can accumulate without reaching a user-visible model because
  normal-entry writers are connected while the complete four-family review page is not mounted.
  Actual candidate counts are unknown.

### UNKNOWN

- Current counts, status distribution, evidence-link coverage, ownership anomalies, orphaned
  records, and fixture-composition row presence in any deployed database.
- The deployed contradiction-ingestion runtime status is `UNKNOWN_NOT_INSPECTED`. The repository
  default is off, but this audit did not inspect deployment secrets, environment values, or
  runtime configuration and therefore does not claim direct observation of the deployed value.

### BLOCKED

- Existing-data inventory is `BLOCKED_READ_ONLY_DATA_ACCESS`. The repo contains local/isolated
  mutation harnesses and a contradiction-specific read-only gate, but no sanctioned general
  read-only account/database harness for this audit. Historical ledger counts were not reused.

## Canonical Architecture Map

```text
Authenticated root layout
  -> AppShell
  -> OrvekWorkbenchShell
  -> CanonicalLiveRuntimeEntry
  -> useOrvekHybridWorkbenchDataApi
  -> buildHybridWorkbenchDataApi
  -> buildCanonicalLiveRuntimeData
  -> CanonicalWorkbench
  -> Today | Map | Decisions | Timeline | Explore | shared Inspector | overlays
```

Evidence:

- `components/layout/AppShell.tsx:5-8` mounts `OrvekWorkbenchShell`.
- `components/orvek-workbench/OrvekWorkbenchShell.tsx:8-50` mounts
  `CanonicalLiveRuntimeEntry` for every root route except the exact approved child
  `/contradictions/candidates`.
- `components/orvek-v0-canonical/canonical-live-runtime-entry.tsx:16-45` binds the hybrid data API
  to the canonical runtime.
- `components/orvek-v0-canonical/workbench.tsx:23-57` maps `/`, `/your-map`, `/actions`,
  `/timeline`, and `/explore` to the five canonical pages.
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts:183-215` initializes production
  from `EMPTY_ORVEK_DATA_API`, not the frozen reference data.
- `components/orvek-v0-canonical/live-provider.ts:57-196` maps only fields supplied by the live
  hybrid API and does not invent fixture identities.
- `middleware.ts:9-41,93-112` quarantines legacy surfaces. The authenticated exceptions do not
  change the shell rule.

### Route Reachability Consequence

Component or route-file existence is not production integration. In particular:

- `/internal/user-map/review` is preserved by middleware but its page is replaced by the
  canonical workbench because it is not an approved route-child path
  (`middleware.ts:40-45`; `OrvekWorkbenchShell.tsx:15-50`).
- `/patterns`, `/context`, `/memories`, `/references`, `/projections`, `/audit`, `/journal`,
  `/import`, and other legacy surfaces are blocked or masked (`middleware.ts:9-27`).
- The active canonical destinations are Today `/`, Map `/your-map`, Decisions `/actions`,
  Timeline `/timeline`, Explore `/explore`, the shared Inspector, and shell overlays.

## Intelligence Compatibility Matrix

| Human concept / pathway | Technical representation | Capture and interpretation | Model effect | Canonical user experience | Classification |
|---|---|---|---|---|---|
| App evidence capture | `Session`, `Message`, `groundingPayload` | Explore creates APP sessions/messages; message route persists both roles and schedules derivation | Feeds transcript/retrieval, reference memory, patterns, dark-engine candidates, and Explore grounding | Explore transcript and Timeline session activity | `FULLY_CONNECTED` |
| Archive import | `ImportUploadSession`, `ImportUploadChunk`, imported `Session`/`Message`, `DerivationRun`/`Artifact` | Chunk processor parses ChatGPT archives, relevance-gates messages, extracts profile/reference candidates, then runs pattern/dark-engine hooks | Imported evidence can feed patterns, references, and candidates | Existing pending candidates can be reviewed, but no canonical upload entry is mounted | `PARTIALLY_CONNECTED` |
| Preferences and constraints | Active/candidate `ReferenceItem`; Map profile facts | Explicit normal-message governance and import extraction create candidates; Explore/import review accepts or rejects | Active items enter assistant prompt; preferences/constraints can enrich Map | Map Background/Context shell and Inspector summary; evidence is only direct session/message provenance | `PARTIALLY_CONNECTED` |
| Goals and directions | `ReferenceItem(type=goal)`, `ProfileArtifact(GOAL)`, goal-like `UserMapConclusion` | Three separate extractors/representations can encode a goal | Active goal references choose static action templates and enter the prompt; UMC can surface as Model Goal | Decisions, Map, Explore, Today if the relevant row becomes visible | `DUPLICATED_AUTHORITY` |
| Self-concept and identity | `ProfileArtifact(IDENTITY|TRAIT|BELIEF)`; generic UMC areas | Rule-based profile derivation creates candidate artifacts with exact spans | Used only as capped dark-engine evidence; not in assistant prompt | No canonical profile reader or promotion flow | `STORED_NOT_SURFACED` |
| Background and context | `ReferenceItem`, `ProfileArtifact(TOPIC)`, UMC, Map context projection | Only preferences/constraints have a canonical fact mapping; no TOPIC extraction rule exists | Reference items can affect assistant context; UMC can affect Explore grounding | Map context is fragmented and may use static section narrative | `DUPLICATED_AUTHORITY` |
| Values | `ProfileArtifact(VALUE)` | Rule-based profile derivation stores candidate + exact span | Capped dark-engine input only | No canonical reader, review, or active promotion | `STORED_NOT_SURFACED` |
| Strengths | No dedicated object or classifier; `TRAIT` is not a governed strength contract | No specific extraction/write path | None | None | `NOT_IMPLEMENTED` |
| Recurring difficulties | `PatternClaim` families: trigger condition, inner critic, repetitive loop, contradiction drift, recovery stabilizer | Native message and import-completion pattern batches call `patternDetectorV1` | Drives template action selection and dark-engine evidence | Active patterns appear in Map Mind Context and Inspector; legacy pattern detail is quarantined | `PARTIALLY_CONNECTED` |
| Working style | `ProfileArtifact(HABIT|TRAIT)`, `PatternClaim`, UMC operating logic | Multiple generic interpretations, no single working-style contract | Patterns can prioritize template actions; profile candidates are capped dark-engine input | Only indirect Map/Inspector presentation | `DUPLICATED_AUTHORITY` |
| Emotional triggers | `ProfileArtifact(EMOTIONAL_PATTERN|FEAR)`, `PatternClaim(trigger_condition)` | Profile regex and pattern detector can derive signals | Pattern claims affect actions and dark-engine candidates | Pattern projection in Map/Inspector; profile evidence remains invisible | `PARTIALLY_CONNECTED` |
| Environmental triggers | No typed environmental-trigger object or classifier | Generic trigger patterns may mention environment but do not encode it as a governed concept | None specific | None specific | `NOT_IMPLEMENTED` |
| Goal-behaviour-evidence relationships | `ReferenceItem`, `PatternClaim`, `SurfacedAction`, UMC, `UnderstandingEvidenceLink` | Actions can link a goal or pattern; dark engine links multiple evidence families | Links affect action choice and candidate confidence | Map/Inspector/Decisions show fragments, not one relationship model | `PARTIALLY_CONNECTED` |
| Claims / current model | `UserMapConclusion` (there is no `UserMap` table) | Dark engine can create internal candidates from APP journal/explore messages or import completion; manual POST can create visible rows | Visible UMC is used by Explore post-reply grounding and proposal anchoring | Real Map/Inspector readers exist; normal candidate publication is blocked by masked review | `PARTIALLY_CONNECTED` |
| Active questions | `Investigation` projected as active question | Dark engine can create an internal candidate; manual API also exists | Visible investigations affect Explore, Map preview, Today, and Timeline | Real live providers exist, but normal review/publication is not canonically reachable | `PARTIALLY_CONNECTED` |
| Uncertainty | UMC status/area, `Investigation`, confidence/evidence fields | Derived indirectly by dark-engine gates and lifecycle | Affects grouping, confidence copy, and evidence-needed presentation | Map Uncertainty and Explore Active Questions when visible | `PARTIALLY_CONNECTED` |
| Experiment / fieldwork | `FieldworkAssignment` | Dark engine can create internal candidate; manual API/lifecycle paths exist | Visible rows affect Experiment, Explore, Today, and Timeline | Live provider and evidence Inspector exist; normal candidate review is masked | `PARTIALLY_CONNECTED` |
| Decisions | No `Decision` table; `SurfacedAction` projected as `type: "decision"` | GET `/api/actions` selects hard-coded templates from patterns/goals and persists action state | Action state can change; it is not a decision model | Canonical Decisions renders these template actions as decisions | `SURFACED_FROM_SYNTHETIC_OR_REFERENCE_DATA` |
| Outcomes | `PatternClaimAction.outcomeSignal`, `SurfacedAction.note/status`, fieldwork observations, projection resolution; no canonical outcome record | Canonical Add outcome only updates local React state | No durable write or model effect from the visible control | UI claims the local state will be folded into the model | `MISSING_WRITE_PATH` |
| Explore grounding | `Message.groundingPayload`, `ExploreMovementProposal`, owned evidence retrieval | Grounding runs after the assistant reply using Journal, visible UMC, pattern evidence, and ReferenceItem rows | It labels the completed reply and may propose movement; it does not ground the provider call that produced the reply | Grounding and proposal review are visible in the shared Inspector | `PARTIALLY_CONNECTED` |
| Model movement and revision | `ModelUpdate`, `ExploreMovementProposal`, UMC publish-created updates | Several publish helpers create or promote evidence-linked, user-visible ModelUpdates | Today/Timeline/report/Inspector change, but Explore publish does not update the affected UMC and general chat does not consume ModelUpdate | Strong movement ledger presentation; incomplete semantic revision | `MISSING_MODEL_EFFECT` |
| Evidence lineage and receipts | `EvidenceSpan`, artifact links, profile links, pattern evidence, contradiction evidence, `UnderstandingEvidenceLink`, surfaced pointers | Multiple family-specific writers | Enables confidence gates and safe Inspector projections | Evidence visible for UMC, investigations, fieldwork, movement, patterns, and contradiction; ReferenceItem targeting is unsupported | `PARTIALLY_CONNECTED` |
| Reports | ModelUpdate report projection, `CanonicalModelMovementReport`, legacy `WeeklyAudit` | Live ModelUpdate reports and fixture-seeded canonical reports use different authorities; WeeklyAudit is message-triggered legacy analytics | ModelUpdate reports describe change; WeeklyAudit has no canonical product effect | Report overlay is mounted; canonical seeded report can override live; Audit pages are quarantined | `DUPLICATED_AUTHORITY` |
| Forecast projections | `Projection` | Historical writer is absent; scalar source IDs have no FKs | No current model effect | Routes redirect toward a quarantined legacy page and canonical shell masks them | `UNUSED_OR_LEGACY` |
| Candidate/review surfaces | Import overlay; Explore session review; hidden four-family operator workbench | Reference and Explore movement decisions persist; four-family lifecycle/publish helpers exist | Accepted references and movement affect current providers; four-family candidates require operator publish | Import/Explore review is canonical; complete UMC/Investigation/Fieldwork/ModelUpdate review is masked | `PARTIALLY_CONNECTED` |
| Canonical composition authority | `CanonicalTodayComposition`, `CanonicalModelMovementReport` | Only exact/full reference round-trip seed code writes these rows | A row makes composition own most workbench rails | Can make fixture/reference objects appear in authenticated canonical product | `DUPLICATED_AUTHORITY` |
| Existing deployed data | All intelligence tables | Not inspected | Unknown | Unknown | `BLOCKED_READ_ONLY_DATA_ACCESS` |
| Active conflicts and contradictions | `ContradictionNode` and exact evidence lineage | Established controlled normal-message pathway | Established evidence-backed prompt, Map, and Inspector effect | Candidate confirmation and durable Map/Inspector lifecycle proven | `PASS_PROVEN_CONTROLLED_PRODUCTION_PATHWAY` |

## Object And Storage Inventory

| Object family | Ownership / lifecycle / confidence | Evidence and relationship notes | Current authority finding |
|---|---|---|---|
| `Session`, `Message` | Both have `userId`; session has APP/import origin and surface type | Message owns exact `EvidenceSpan`; direct source for references/contradictions | Canonical capture substrate |
| `JournalEntry`, `QuickCheckIn` | Both user-owned and timestamped | Pattern evidence can FK to Journal; dark engine reads both | Real evidence, but dedicated legacy capture surfaces are quarantined |
| `ImportUploadSession`, `ImportUploadChunk` | Upload session owns user; chunks cascade through session | Completion records diagnostics but candidate-to-batch FK is absent | Real processing substrate with provenance ambiguity |
| `DerivationRun`, `DerivationArtifact` | User-owned run/artifact, candidate/promoted/rejected status | Artifact-to-span and artifact-to-promoted-entity links | Receipt/scaffolding layer, not a canonical user model |
| `EvidenceSpan` | User-owned, exact message offsets/hash, unique span tuple | Exact FK to Message; profile and contradiction lineage | Strong lineage primitive |
| `ReferenceItem` | User-owned; typed status/confidence; supersession relation | Optional source session/message FKs; cannot be a UEL target | Active prompt memory and partial Map facts |
| `ProfileArtifact` | User-owned; float confidence; string lifecycle; unique normalized claim | Many-to-many exact span links | Legacy candidate store with no promotion/surface |
| `PatternClaim` | User-owned; candidate/active/paused/dismissed; strength; normalized uniqueness | Evidence rows may point to message/session/journal | Current pattern authority |
| `PatternClaimAction` | User-owned through claim; action status/outcome signal | Claim FK | Legacy/current micro-experiment outcome, not canonical Decision |
| `SurfacedAction` | User-owned; unique surface key; state/note | Scalar linked pattern/goal IDs without FKs | Template action state projected as Decision |
| `ContradictionNode` | User-owned; confidence/status/salience; duplicate controls | Exact dual-side spans, evidence rows, reference links, UEL support | Proven controlled pathway |
| `UserMapConclusion` | User-owned; status, visibility, candidate lifecycle, confidence, correction, supersession | UEL target; Investigation resolution relation | Current Map object; no parent `UserMap` table |
| `Investigation` | User-owned; status, visibility, candidate lifecycle, seed type | UEL target; may resolve to UMC | Active Question / Investigation representation |
| `FieldworkAssignment` | User-owned; status, visibility, candidate lifecycle | UEL target; scalar linked object identity | Experiment / watch-for representation |
| `ModelUpdate` | User-owned; visibility, meaningful flag, update type | UEL target; affected object is a typed scalar ID, not FK | Current movement ledger |
| `ExploreMovementProposal` | User-owned; proposed/published/rejected; linked ModelUpdate | Sources held as JSON, later materialized as UEL | Real Explore review staging object |
| `UnderstandingEvidenceLink` | User-owned; unique target/source/role tuple | Polymorphic scalar IDs validated by writer, no database FK | Current cross-family graph with orphan risk |
| `Projection` | User-owned; confidence/status/resolution | Source session/message are nullable scalar IDs without relations | Preserved legacy data, no writer/reader |
| `WeeklyAudit` | User-owned; draft/locked lifecycle; generated metrics | Snapshot contains aggregate contradiction/reference metrics | Internal legacy analytics, not canonical report authority |
| `CanonicalTodayComposition`, `CanonicalModelMovementReport` | User-owned exact payload snapshots | Report ID is scalar; no general production generator | Exact/reference fixture authority in production read path |

### Absent First-Class Objects

The current schema contains no models named `UserMap`, `Goal`, `Decision`, `Outcome`,
`ActiveQuestion`, `Uncertainty`, `Context`, `Trigger`, or `Receipt`. These names are UI,
projection, enum, or indirect semantic roles. Evidence:
`prisma/schema.prisma:35-1092` and the migrations
`20260228000000_profile_artifact`, `20260314191736_add_pattern_claim`,
`20260514171847_add_understanding_engine_phase1a_foundation`.

### Duplicate And Orphan Risks

- Goal truth can exist in three families with different lifecycle rules:
  `ReferenceItem(goal)`, `ProfileArtifact(GOAL)`, and goal-like `UserMapConclusion`.
- Context/self truth can exist in `ReferenceItem`, `ProfileArtifact`, PatternClaim, and UMC.
- `UnderstandingEvidenceLink`, `ModelUpdate.affectedObjectId`,
  `FieldworkAssignment.linkedObjectId`, and Projection source IDs are polymorphic/scalar and
  cannot receive database-enforced target FKs.
- Import candidates have source session/message FKs but no exact candidate-to-upload-batch FK;
  `listPendingImportCandidates` only assigns a batch when exactly one completed batch exists
  (`lib/import-candidate-review-query.ts:100-237`).
- `ReferenceItem` acceptance cannot create a ModelUpdate or UEL target by current enums
  (`lib/import-candidate-review-actions.ts:216-257`).

## Extraction And Write-Path Inventory

| Path | Invocation | Writes | Status |
|---|---|---|---|
| `POST /api/message` | Canonical Explore and other APP message clients | User/assistant Message, governed ReferenceItem candidate; schedules weekly audit, ProfileArtifact, PatternClaim, dark-engine candidate, gated contradiction | Current normal entry |
| `processMessageForProfile` | APP journal/explore and relevant imported user messages | EvidenceSpan, candidate ProfileArtifact, profile evidence link | Current writer; no active promotion |
| `patternBatchOrchestrator.runForUser` + `patternDetectorV1` | Native message trigger and import completion | DerivationRun, PatternClaim, PatternClaimEvidence, lifecycle advancement | Current deterministic writer |
| Chunked import processor | Upload queue | Import batch/chunks, imported Session/Message, derivation artifacts, ReferenceItem/ProfileArtifact candidates | Current backend; canonical upload entry missing |
| Dark-engine APP/import bridges | APP journal/explore message and import completion | At most one internal candidate among UMC, Investigation, Fieldwork, ModelUpdate | Current event-only writer |
| Four-family publish helpers | Hidden operator page/API | Promote candidate to user-visible object and/or meaningful ModelUpdate | Current backend; canonical page masked |
| Explore grounding orchestrator | After assistant reply persistence | Message grounding payload and optional ExploreMovementProposal | Current post-reply writer |
| Explore movement publish | Canonical Inspector review | User-visible meaningful ModelUpdate + UEL + snapshots | Current writer; does not mutate affected UMC |
| Actions GET/sync | Canonical Decisions hydration | `SurfacedAction` rows from hard-coded templates | Current synthetic/reference-driven writer |
| Decision outcome control | Canonical Decisions local state | None | Missing durable write |
| Projection | No current caller found | None | Legacy/dead |
| Canonical composition/report | Exact/full reference round-trip seed only | Persisted composition and report payloads | Fixture/dev writer on production read path |
| Contradiction production ingestion | Normal message after-hook, explicit env gate default off | Proven ContradictionNode and exact lineage | Proven controlled path; public activation not performed |

Key evidence:

- `app/api/message/route.ts:137-263,328-427,453-650`
- `lib/profile-derivation.ts:23-79,290-452`
- `lib/native-derivation-trigger.ts:256-313`
- `lib/pattern-batch-orchestrator.ts:65-146`
- `lib/pattern-detector-v1.ts:792-937`
- `lib/import-chatgpt.ts:1296-1500`
- `lib/import-upload-processor.ts:201-369`
- `lib/import-upload-queue.ts:17-82`
- `lib/understanding-dark-engine/app-message-candidate-bridge.ts:49-141`
- `lib/understanding-dark-engine/dark-run-orchestrator.ts:164-270`
- `lib/explore-grounding-orchestrator.ts:130-220`
- `lib/explore-movement-proposal.ts:196-358`
- `lib/actions-v1.ts:124-216,352-377,757-839`
- `components/orvek-v0-canonical/pages/decisions.tsx:10-17,85-103,333-359`
- `lib/exact-fixture-round-trip-seed.ts:327-421`
- `lib/contradiction-production-ingestion.ts:1-120`

## Provider And Read-Path Inventory

| Provider / merge | Genuine source | Fallback and precedence | Canonical result |
|---|---|---|---|
| Root base API | `EMPTY_ORVEK_DATA_API` | Honest empty | No frozen reference fallback in production |
| Today hydration | Today re-entry APIs and meaningful visible ModelUpdates | Empty snapshot on failure | Honest live Today unless composition exists |
| Map | Visible UMC, active PatternClaim/ReferenceItem context, movement/question previews, open contradiction control | Empty/error state; no generic reference fallback | Genuine Map/Inspector |
| Timeline | QuickCheckIn, Session/Message, Journal, actions, investigations, fieldwork, meaningful ModelUpdates | Empty/error state | Genuine activity and model layers |
| Decisions | `SurfacedAction` generated from real PatternClaim/goal inputs | Hard-coded action template libraries | Convincing but not a decision model |
| Experiment | Visible FieldworkAssignment | Empty list | Genuine when published |
| Active Questions / Investigations | Visible Investigation | Empty list | Genuine when published |
| Explore chat | Real Session/Message and provider response | Honest empty when no messages | Genuine chat; no fixture conversation in production |
| Explore review | Session-scoped ReferenceItem, understanding candidates, Explore proposals | Honest empty/error | Genuine ReferenceItem and movement actions; lower families read-only here |
| Import review | Import-derived ReferenceItem and ContradictionNode | Explicitly overrides composition import review | Genuine accept/reject overlay |
| Reports | Live ModelUpdate projection or canonical composition report | Composition may own report | Duplicated report authority |
| Canonical composition | Persisted exact/full-reference payload | If Map categories exist, disables most live rail merges | Can mask genuine data and genuine emptiness |

The decisive precedence is in
`lib/orvek-v0/production/hybrid-workbench-api.ts:571-617,730-828`:
`compositionWorkbench` prevents Map, Timeline, Decisions, Experiment, Active Questions, and
Investigations overlays, then `applyCompositionWorkbenchRails` restores composition. Only Free
Explore and the narrow live contradiction conflict overlay remain independently merged.

`components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts:273-338,393-860,1020-1116`
confirms the source APIs, empty-on-failure behavior, and the explicit genuine import-review
override.

## Canonical Product-Surface Inventory

| Destination | Mounted production component | Live intelligence | Gaps |
|---|---|---|---|
| Today `/` | `components/orvek-v0-canonical/pages/today.tsx` | Today snapshot, meaningful ModelUpdate, surfaced evidence pointers | Composition can replace rails; no content is honest empty otherwise |
| Map `/your-map` | `components/orvek-v0-canonical/pages/map.tsx` | UMC, patterns, preferences/constraints, questions, movement, contradiction control | ProfileArtifact absent; goals/context have duplicate authority |
| Decisions `/actions` | `components/orvek-v0-canonical/pages/decisions.tsx` | SurfacedAction state from real pattern/goal inputs | No decision object; static templates; local-only outcome claim |
| Experiment | Explore Fieldwork Bridge plus Experiment provider contract | Published FieldworkAssignment | Candidate publication page masked |
| Explore `/explore` | `components/orvek-v0-canonical/pages/explore.tsx` | Live chat, investigations, questions, fieldwork, Inspector review | Grounding is post-reply; generic movement prompt is shown even without proposal |
| Timeline `/timeline` | `components/orvek-v0-canonical/pages/timeline.tsx` | Check-ins, sessions, journal, actions, investigations, fieldwork, ModelUpdate | Composition can replace live rails |
| Inspector | Canonical authority panel plus production bridge/router | UMC, investigation, fieldwork, pattern, contradiction, ModelUpdate, Explore review | ProfileArtifact and full ReferenceItem evidence are not first-class |
| Reports overlay | `components/orvek-v0/overlays.tsx:535-704` | Live ModelUpdate report projection | Canonical fixture report and legacy WeeklyAudit are separate authorities |
| Model Movement | Today, Timeline, Inspector, report overlay | User-visible meaningful ModelUpdate | Event may not change affected model object or later provider interpretation |
| Profile sections | Map context projection | Active preferences and constraints only | Static default section narrative; no identity, values, strengths, or ProfileArtifact |
| Goal surfaces | Map model-goal projection and template-driven Decisions | Goal reference and goal-like UMC | Three goal authorities; no first-class Goal |
| Import candidate review | Top-bar overlay | Genuine pending import candidates | No canonical upload entry; no duplicate/type-correction context |
| Explore review | Shared Inspector | ReferenceItem and Explore movement confirm/reject | UMC/Investigation/Fieldwork are read-only; generic internal ModelUpdate cards can show no-op Confirm/Reject controls |
| Four-family operator review | Route file under `/internal/user-map/review` | Complete lifecycle/publish controls in unused child | Masked by canonical shell |
| Contradiction candidates | Exact approved child route | Proven candidate review | Intentionally the only route-child exception |

## Mock, Reference, And Fallback Findings

1. Production starts from an honest empty provider. Frozen `orvek-data.ts` is not the root
   fallback (`useOrvekHybridWorkbenchDataApi.ts:183-190`).
2. Canonical composition rows are not a fallback in memory; they are persisted exact/reference
   payloads and receive higher merge precedence than live providers
   (`canonical-today-composition.ts:19-104`; `hybrid-workbench-api.ts:730-828`).
3. Only `exact-fixture-round-trip-seed.ts` writes those rows. No production composition
   generator was found.
4. Decisions use static libraries even when their selection inputs are genuine
   (`actions-v1.ts:124-216`).
5. `map-profile-facts.ts:53-79` includes static default summaries for newly created live
   Preferences/Constraints shells. Facts are real, but section-level narrative is reference copy.
6. The production Explore page only uses its hard-coded sample conversation when
   `referenceSurface === true`; production uses live messages or an honest empty state
   (`components/orvek-v0-canonical/pages/explore.tsx:76-118`).
7. The sidebar always renders a pulse titled `Model changed in 4 places`, independent of live
   movement data (`components/orvek-v0/sidebar.tsx:70-79`). It is an ungrounded production claim.
8. Failed live reads generally resolve to empty/error state, not convincing reference rows.

## Existing-Data Findings

Classification: `BLOCKED_READ_ONLY_DATA_ACCESS`.

No counts are reported. Specifically unknown:

- total rows and candidate/active/visible status distributions;
- user ownership completeness;
- ProfileArtifact evidence-link coverage;
- PatternClaim evidence coverage;
- UMC/Investigation/Fieldwork/ModelUpdate UEL coverage;
- polymorphic target orphans;
- records unreachable from current providers;
- canonical composition/report row presence;
- old Projection and WeeklyAudit row counts;
- duplicate goals/context across ReferenceItem, ProfileArtifact, PatternClaim, and UMC;
- pending import candidate count and quality distribution.

The contradiction-specific CEQR read-only gate and isolated local test URLs are not a general
authorization to inspect deployed user data. Local fixture scripts are mutation harnesses. The
audit therefore did not read `DATABASE_URL`, instantiate Prisma against an account database, or
reuse historical counts.

## Remaining Candidate Quality Boundary

The real import-review query is restricted to candidate `ReferenceItem` and `ContradictionNode`
rows whose source session origin is `IMPORTED_ARCHIVE`
(`lib/import-candidate-review-query.ts:100-237`). The canonical overlay shows:

- raw/evidence excerpt;
- proposed title;
- candidate type;
- confidence;
- source session/message/batch metadata in the provider contract;
- accept or keep-as-receipt-only actions.

This is enough for a human to judge many cases as useful, trivial, obvious coding/project noise,
inaccurate, or speculative. It is not enough to reliably classify duplicate or wrong-object-type
cases because the UI does not show:

- nearest active ReferenceItem/ProfileArtifact/PatternClaim/UMC matches;
- duplicate score or supersession target;
- broader source conversation context beyond a 280-character excerpt;
- editable proposed type;
- route to reclassify instead of binary accept/reject.

The query also attaches a batch ID only when there is exactly one completed import batch. With
multiple completed batches, exact batch provenance is null. No candidates were accepted,
rejected, or edited during this audit.

The separate Explore session review has another boundary. Its UMC, Investigation, and Fieldwork
candidate cards deliberately use read-only actions. Generic internal ModelUpdate cards are mapped
with confirm/reject capability, but `ExploreConversationReviewCard` only persists a movement
proposal or ReferenceItem action; a generic ModelUpdate reaches neither handler and returns
without mutation (`lib/explore-session-review-items-server.ts:390-500`;
`components/explore/ExploreConversationReviewStrip.tsx:110-165`). This does not replace the
masked four-family operator workbench.

## Contradiction Pathway Status

`PASS_PROVEN_CONTROLLED_PRODUCTION_PATHWAY`

This audit records, without re-auditing semantics:

- normal message route hook exists;
- adjudicator/referee/confidence pipeline exists;
- repaired writer exists;
- isolated PostgreSQL persistence is proven;
- candidate review exists;
- confirmation into Map/Inspector exists;
- refresh persistence and ownership isolation are proven;
- public contradiction ingestion remains deployment-gated;
- historical import/backfill is not part of the contradiction pathway.

### Activation Checkpoint

Repository and activation status:

- `repositoryDefaultEnabled: false`
- `publicActivationAuthorised: false`
- `publicActivationVerified: false`
- `deployedRuntimeEnvironmentInspected: false`
- `deployedRuntimeStatus: UNKNOWN_NOT_INSPECTED`

The required footer value `PUBLIC_CONTRADICTION_INGESTION_ENABLED: NO` means: "No verified or
authorised public activation exists in this project state." It is a repository/project
authorization verdict, not a direct observation of the unseen deployed environment.

1. Display of already-stored open contradiction records is already a live canonical Map/Inspector
   concern and remains enabled independently of ingestion.
2. A controlled staging/live-provider smoke test belongs after the canonical composition/data
   authority swap and before public ingestion activation. It must use an explicitly authorized
   account/provider budget and verify abstention, bounded calls, persistence, candidate review,
   Map/Inspector display, refresh, and ownership isolation.
3. Public production activation is a separate deployment decision after that smoke test. It means
   setting `RUN_PRODUCTION_CONTRADICTION_INGESTION` under controlled rollout; this audit did not do
   so.
4. Historical import/backfill remains separate, optional, and out of the controlled contradiction
   pathway. It is not a prerequisite for displaying already-stored records or for a staged
   normal-entry smoke test.

Evidence: `lib/contradiction-production-ingestion.ts:1-120`,
`app/api/message/route.ts:399-427`, and the task's established contradiction status.

## Prioritised Repair Order

### 1. CANONICAL-UNDERSTANDING-CANDIDATE-REVIEW-RESTORATION-001

Mount an allowlisted, canonical-safe review surface for UMC, Investigation, Fieldwork, and
ModelUpdate candidates. Reuse existing lifecycle and publish helpers; do not broaden public
routes. Prove each family can move from normal/import candidate to evidence review, publish,
canonical surface, refresh, and owner-isolated Inspector.

### 2. CANONICAL-COMPOSITION-AUTHORITY-SWAP-001

Prevent exact/full-reference composition rows from owning authenticated production rails. Keep
fixture seeding on explicit dev/test routes only. Make live providers and honest emptiness the
single production authority; retain the proven contradiction overlay.

### 3. PROFILE-MEMORY-AUTHORITY-CONSOLIDATION-001

Declare canonical ownership and translation rules across ReferenceItem, ProfileArtifact,
PatternClaim, and UMC. Add a governed lifecycle and evidence-backed canonical projection for
identity, values, preferences, constraints, strengths, background, working style, and triggers.
Do not silently migrate or merge user claims.

### 4. DECISION-OUTCOME-PERSISTENCE-001

Replace SurfacedAction-as-Decision presentation with a truthful decision contract or relabel it
as actions. Add durable decision/outcome writes, evidence lineage, review lifecycle, and model
effect. Remove the local-only outcome claim before exposing the control.

### 5. MODEL-REVISION-SEMANTIC-EFFECT-001

Make confirmed movement update the affected current-model object through an evidence-gated,
versioned transition, and make the resulting current model available to later interpretation.
Keep the existing ModelUpdate ledger, report, and evidence snapshots as the audit trail. Replace
the hard-coded sidebar `Model changed in 4 places` pulse with a live, evidence-backed movement
state/count or an honest empty state.

### 6. CANONICAL-IMPORT-CAPTURE-AND-CANDIDATE-QUALITY-001

Restore a governed canonical import-upload entry and add read-only duplicate/type/context
diagnostics to candidate review. Preserve binary mutation safety until the user explicitly
confirms.

### 7. LEGACY-INTELLIGENCE-TRANSLATION-AND-RETIREMENT-001

Begin by creating or adapting a narrowly scoped immutable/read-only inventory harness and proving
that it cannot write. Use it to obtain ownership, status, evidence-coverage, orphan, and canonical
reachability counts for Projection, WeeklyAudit, ProfileArtifact candidates, derivation
artifacts, old pattern outputs, and unreachable rows. Then define explicit
translate/archive/retain rules. Allow migration only after the inventory findings and per-family
ownership, lineage, and rollback rules are reviewed and approved.

## Production-Readiness Conclusion

The product has a strong evidence substrate, several genuine live readers, a real pattern
pipeline, an evidence-gated understanding kernel, a real Explore movement review path, and a
proven contradiction control. Those components are not sufficient for whole-product readiness.
Canonical review reachability, authority duplication, fake Decision/outcome semantics, and the
absence of a downstream semantic model effect are blocking defects.

No public contradiction activation should occur as part of these repairs. The next work is the
bounded canonical four-family review restoration. A controlled contradiction staging smoke test
is required later at the data-swap activation checkpoint, not during this read-only audit.

AUDIT_EXECUTION: PASS
WHOLE_PRODUCT_PRODUCTION_READY: NO
CONTRADICTION_PATHWAY: PASS_PROVEN_CONTROLLED_PRODUCTION_PATHWAY
PUBLIC_CONTRADICTION_INGESTION_ENABLED: NO
CONTROLLED_STAGING_LIVE_SMOKE_TEST_REQUIRED: YES
REPAIR_DELIVERY_COUNT: 7
NEXT_DELIVERY: CANONICAL-UNDERSTANDING-CANDIDATE-REVIEW-RESTORATION-001
