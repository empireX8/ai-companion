# FULL-ORVEK-LIVE-DATA-INTELLIGENCE-ARCHITECTURE-AUDIT-001

Date: `2026-07-25`

Repository: `empireX8/ai-companion`

Branch: `desktop-full-orvek-live-data-intelligence-architecture-audit-001`

Base commit: `239b659e3ec95a28590ef1d5e4ef67998b3c24f4`

Controlling desktop authority:
`docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md`

Machine-readable equivalent:
`docs/audits/FULL-ORVEK-LIVE-DATA-INTELLIGENCE-ARCHITECTURE-AUDIT-001.json`

## Executive verdict

The current Orvek repository is not whole-product production ready.

The approved frozen desktop shell is present and mounted. It begins from an honest empty data
API, loads multiple real authenticated/user-owned readers, and projects genuine persisted objects
into Today, Map, Decisions, Timeline, Explore, the shared Inspector, and the import-review
overlay. The schema contains a substantial evidence substrate, five real deterministic pattern
families, internal candidate lifecycle/publish mechanics, a model-movement ledger, and one
well-controlled semantic AI path for contradictions.

Those components do not yet form one safe live intelligence architecture:

1. The canonical Explore pathway contains a proven critical semantic-authority break.
   `orchestrateExploreReplyGrounding` can write an `ExploreMovementProposal` whose
   `afterSummary`, rationale, and user-facing summary are fixed to stop-point sensitivity after
   meetings/evening, regardless of the conversation. Deterministic lexical overlap is labelled
   `VERIFIED`/`INFERRED`; there is no semantic AI judgment or referee for the proposed movement.
   A user can then publish that proposal as a meaningful `ModelUpdate`.
2. The production Capture button routes to `/journal-chat`, but the canonical shell masks that
   child and leaves the user in the workbench. Explore text is a real canonical input; the named
   Capture entry is not.
3. A persisted full `CanonicalTodayComposition` can replace most genuine Map, Timeline,
   Decisions, and Explore rails with reference/composition objects. Live import review and live
   contradiction conflicts are narrow exceptions. Whether deployed accounts contain these rows
   is blocked because no database was inspected.
4. Decisions displays deterministic static `SurfacedAction` templates as decisions and labels
   their text “What Orvek would choose.” The canonical page's outcome success is local React state
   and says Orvek will fold it into the model. A separate durable outcome control exists in the
   production Inspector, so the page and Inspector do not share one truth.
5. `ModelUpdate` is a strong movement/audit projection, but publishing it does not necessarily
   mutate the affected current-model object. The general assistant prompt consumes active
   `ReferenceItem` rows and qualifying `ContradictionNode` rows, but not `PatternClaim`,
   `ProfileArtifact`, `UserMapConclusion`, `Investigation`, `FieldworkAssignment`, or
   `ModelUpdate`.
6. `ReferenceItem`, `ProfileArtifact`, `PatternClaim`, and `UserMapConclusion` overlap for goals,
   identity, values, habits, background, and current-model claims without one declared semantic
   authority or translation contract.
7. The five pattern families are real and evidence-linked, but their production authority is
   deterministic rules. The optional LLM labels are shadow-only for two families and cannot
   affect product decisions. There is no pattern-level referee, and claim strength has no
   weakening path.
8. Import processing is real, but the upload page is masked, its queue is in-process, and the
   schema has no exact candidate-to-upload-session relationship.
9. Deployed data, deployed configuration, provider availability, row counts, orphan rates, and
   runtime activation were not inspected and are not inferred from source existence.

The next implementation delivery is
`EXPLORE-MOVEMENT-FIXED-SEMANTICS-CONTAINMENT-001` (`DEL-001A`). It is a narrow containment
step because it immediately closes a proven reachable path that can store and publish fabricated
semantic movement without prematurely building the replacement AI layer. The prior fixed
seven-delivery roadmap and the audit’s former simple nine-step priority order are superseded;
the nine top-level engineering boundaries remain for traceability under the controlling
phase/campaign roadmap.

## Scope and proof boundary

This was a read-only repository audit. It did not change application code, schema, routes,
environment, data, or provider configuration. It did not connect to a database, inspect deployed
data, call an AI provider, commit, or push.

### Stage status vocabulary

| Status | Meaning in this audit |
|---|---|
| `PRESENT_AND_PROVEN` | Present in the current source and supported by an appropriate test or accepted isolated proof. |
| `PRESENT_STATICALLY_NOT_RUNTIME_PROVEN` | Source wiring exists, but this audit has no current runtime proof. |
| `PARTIAL` | Some stages exist, but a named authority, lifecycle, evidence, reachability, or model-effect gap remains. |
| `TEST_ONLY` | The capability exists only in test/dev/fixture proof. |
| `DESIGNED_ONLY` | Contract/interface exists without a complete concrete production implementation. |
| `ABSENT` | No current implementation was found. |
| `LEGACY` | Preserved old capability outside the canonical product authority. |
| `MASKED` | Page/backend exists but the current shell/middleware does not expose it as a canonical surface. |
| `BLOCKED_NOT_INSPECTED` | The answer requires deployed configuration/data/provider access that this audit did not use. |
| `NOT_APPLICABLE` | The stage does not apply to the pathway. |

### Proof vocabulary

| Proof | Meaning |
|---|---|
| `VERIFIED_STATIC` | Directly established from current source/contracts. |
| `VERIFIED_TEST` | Established by current isolated/unit/integration test coverage without a live provider or deployed database. |
| `VERIFIED_LOCAL_ROUND_TRIP` | Established by an accepted isolated local persistence/runtime proof already in the repository record. |
| `INFERRED` | A conclusion derived from proven source behavior, explicitly identified as inference. |
| `UNKNOWN` | Current source does not resolve the question. |
| `BLOCKED` | The question requires prohibited or unavailable external/deployed inspection. |

### Current audit counters

| Counter | Value |
|---|---:|
| Prisma models inventoried | 38 |
| User input types inventoried | 13 |
| Writer groups inventoried | 26 |
| Major end-to-end pathways traced | 18 |
| AI judgment layers classified | 9 |
| AI referee layers classified | 6 |
| Deterministic gate groups classified | 14 |
| Pattern families classified | 5 |
| Provider groups classified | 11 |
| Canonical/internal output surfaces classified | 19 |
| Stable risks | 13 |
| Derived future deliveries | 9 |
| Database connections | 0 |
| Live provider calls | 0 |

## Corrections to the prior audit

These corrections supersede the corresponding interpretation and roadmap in
`OLD-TO-NEW-INTELLIGENCE-COMPATIBILITY-AUDIT-001`.

| ID | Corrected finding | Proof |
|---|---|---|
| `CORR-001` | `UserMapConclusion`, `Investigation`, `FieldworkAssignment`, and `ModelUpdate` are four candidate object types handled in one internal operator workbench. They are not four pattern families. | `VERIFIED_STATIC` — `app/(root)/(routes)/internal/user-map/review/page.tsx`; `prisma/schema.prisma:PatternType` |
| `CORR-002` | The five real pattern families are `trigger_condition`, `inner_critic`, `repetitive_loop`, `contradiction_drift`, and `recovery_stabilizer`. | `VERIFIED_STATIC` — `prisma/schema.prisma:PatternType`; `lib/pattern-detector-v1.ts` |
| `CORR-003` | A hidden internal route is not automatically a public-product defect. The page explicitly identifies itself as internal operator tooling. Whether it must be reachable through this shell is an unresolved product/operations intent question. | `VERIFIED_STATIC` — internal review page; `OrvekWorkbenchShell`; current desktop authority |
| `CORR-004` | The fixed seven-delivery roadmap is withdrawn. The future plan must follow the current dependency graph and the highest-impact proven live break. | `VERIFIED_STATIC` — Explore grounding/proposal/publish path |
| `CORR-005` | Remains valid: canonical shell mount, honest empty base, genuine live readers, composition precedence, missing first-class Decision/Outcome/Goal objects, and the deployed-data proof boundary. | `VERIFIED_STATIC` — shell, empty API, hybrid provider, schema |
| `CORR-006` | Incomplete: Explore was correctly described as post-reply grounding plus reviewable movement, but the prior audit missed the fixed proposal semantics and forced mixed lexical labels. | `VERIFIED_STATIC` — Explore retrieval/orchestrator |
| `CORR-007` | Recommendation withdrawn: candidate-review restoration is not automatically the next product task. It assumed an internal tool belonged in the canonical user experience and missed the higher-severity live Explore break. | `VERIFIED_STATIC` — internal workbench and Explore proposal source |

## Canonical architecture map

```text
Authenticated root
  -> AppShell
    -> OrvekWorkbenchShell
      -> exact approved child: /contradictions/candidates
      -> otherwise CanonicalLiveRuntimeEntry
        -> useOrvekHybridWorkbenchDataApi
          -> genuine authenticated API readers
          -> optional persisted CanonicalTodayComposition/report
          -> buildHybridWorkbenchDataApi
        -> buildCanonicalLiveRuntimeData
          -> CanonicalWorkbench
            -> Today | Map | Decisions | Timeline | Explore
            -> shared production Inspector
            -> Import / report / reference overlays
```

Key authority facts:

- `components/layout/AppShell.tsx:AppShell` mounts `OrvekWorkbenchShell`.
- `components/orvek-workbench/OrvekWorkbenchShell.tsx:OrvekWorkbenchShell` mounts the exact
  contradiction child separately and mounts `CanonicalLiveRuntimeEntry` for other root routes.
- `components/orvek-v0-canonical/canonical-live-runtime-entry.tsx` binds the hybrid API to the
  canonical presentation.
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` begins with
  `EMPTY_ORVEK_DATA_API` and loads live slices independently.
- `lib/orvek-v0/production/hybrid-workbench-api.ts:buildHybridWorkbenchDataApi` applies provider
  precedence.
- `components/orvek-v0-canonical/live-provider.ts:buildCanonicalLiveRuntimeData` adapts selected
  live/composition data without falling back to the frozen fixture provider.
- `components/orvek-v0-canonical/workbench.tsx:CanonicalWorkbench` preserves the approved frozen
  shell/presentation and mounts the shared production Inspector bridge.

### Canonical route authority

| Route | Surface | Current status | Notes |
|---|---|---|---|
| `/` | Today | `PRESENT_AND_PROVEN` | Live Today or explicit composition. |
| `/your-map` | Map | `PRESENT_AND_PROVEN` | Live object providers or composition. |
| `/actions` | Decisions | `PARTIAL` | Real `SurfacedAction` rows, overstated as decisions. |
| `/timeline` | Timeline | `PRESENT_AND_PROVEN` | Live activity/model layers or composition. |
| `/explore` | Explore | `PARTIAL` | Real chat; unsafe fixed movement proposal path. |
| `/contradictions/candidates` | Contradiction review child | `PRESENT_AND_PROVEN` | Exact approved route child. |
| All other root children | Canonical shell or masked route | `MASKED` | File/middleware existence is not product integration. |

## Major pathway register

The following three keyed tables jointly contain every required field for every major pathway.
The JSON artifact stores the same rows as complete objects.

### Pathway identity, input, extraction, writer, and objects

| ID | Concept | Input | Raw persisted | Extractor | AI judgment | AI referee | Deterministic gate | Writer | Object(s) |
|---|---|---|---|---|---|---|---|---|---|
| `PATH-001` | Canonical Explore text → generated conversation evidence | Canonical Explore composer | `Session`, user/assistant `Message` | OpenAI reply plus background deterministic extractors | Conversational generation | Absent | Auth, owned APP Explore session, model/mode allowlist | `WR-002` | Session, Message |
| `PATH-002` | Top-bar Capture → life evidence | Capture button → `/journal-chat` | None | Absent | Absent | Absent | Shell route quarantine | No reachable writer | None |
| `PATH-003` | Archive → imported evidence → review | Chunked ChatGPT export | Upload session/chunks, imported Session/Message | Deterministic archive/reference/profile/contradiction extraction; pattern/dark hooks | No semantic AI | Absent | File/chunk, relevance, review gates | `WR-010`/`011`/`012` | Import substrate, Reference, Profile, Pattern, Contradiction, understanding candidates |
| `PATH-004` | Evidence → ProfileArtifact | APP/import message | Message | Regex rule registry | No | Absent | APP/import relevance, quality, dedupe | `WR-007` | EvidenceSpan, ProfileArtifact, link |
| `PATH-005` | Evidence → five pattern families | Message, JournalEntry, imported history, qualifying contradictions | Message/Journal/Contradiction | `patternDetectorV1` family adapters | Deterministic authority; optional shadow LLM for two families | Absent | Behavioral filter, family thresholds, lifecycle | `WR-008` | DerivationRun/Artifact, PatternClaim/Evidence |
| `PATH-006` | Normal message → controlled contradiction | Canonical Explore or reachable APP message | Message | Structured AI adjudicator | `AIJ-002` | Concrete `AIREF-001` | Default-off activation, schema-v4, lineage, referee, confidence, duplicate/provider caps | `WR-013` | ContradictionNode/Evidence, EvidenceSpan, UEL |
| `PATH-007` | Evidence packet → internal understanding candidate | APP message/import completion | Message, Journal, check-in, references, profile, patterns, contradictions | Deterministic safe-summary priority: UMC → Investigation → Fieldwork → ModelUpdate | No | Absent | Dark-engine objectivity gates | `WR-016` | One internal candidate plus derivation/evidence rows |
| `PATH-008` | Internal review → public understanding object | Allowlisted operator decision | Existing candidate/UEL | Not applicable | Not applicable | Not applicable | Ownership, promoted lifecycle/status, internal visibility, evidence | `WR-017`–`020` | UMC, Investigation, Fieldwork, ModelUpdate, UEL |
| `PATH-009` | Explore reply → grounding → movement proposal | Persisted Explore turn | Message | Lexical overlap over owned evidence | No semantic judgment; fixed proposal prose | Absent | Mixed lexical `VERIFIED` + `INFERRED`, visible UMC | `WR-021` | Message.groundingPayload, ExploreMovementProposal |
| `PATH-010` | Explore proposal → ModelUpdate | User publish/reject | ExploreMovementProposal | Not applicable | Inherits invalid `PATH-009` authority | Absent | Ownership/status/evidence and ModelUpdate publish gates | `WR-023` | ExploreMovementProposal, ModelUpdate, UEL, pointer |
| `PATH-011` | Pattern/goal → action/decision/outcome | PatternClaim and active goal ReferenceItem | Pattern/Reference | Static family/goal template selection | No | Absent | Visible claim, goal-shape filter | `WR-009` | SurfacedAction |
| `PATH-012` | Reference memory → future reply | Native/import/manual memory | ReferenceItem | Explicit deterministic type/statement extraction | No | Absent | Quality, active lifecycle, relevance | `WR-005`/`006`/`011`/`012` | ReferenceItem |
| `PATH-013` | ModelUpdate → Today/Timeline/report/depth | Published meaningful movement | ModelUpdate, UEL | Deterministic snapshot/report/evidence-depth projection | None at this stage | Not applicable | Public/meaningful, snapshot/pointer readiness | `WR-024` | SurfacedEvidencePointer/rationale |
| `PATH-014` | Composition/report → authenticated workbench | Pre-existing/dev-seeded composition | Canonical composition/report | Exact/full reference manifest mapping | Not applicable | Not applicable | Contract/local seed guards | `WR-026` | CanonicalTodayComposition/report |
| `PATH-015` | UMC correction → downstream gates | Inspector correction chip | UMC correction fields | Human label | Not applicable | Not applicable | Ownership, non-empty, summary immutable | Manual UMC PATCH | UserMapConclusion |
| `PATH-016` | Journal/check-in → evidence surfaces | Journal/check-in forms/APIs | JournalEntry/QuickCheckIn | Human structured input | Absent | Absent | Auth/schema | `WR-003`/`004` | JournalEntry, QuickCheckIn |
| `PATH-017` | Search/navigation → object discovery | Top-bar query | None | Client substring over command labels | Not applicable | Not applicable | None | Not applicable | None |
| `PATH-018` | Voice/image → evidence/intelligence | Waveform/image widget fragments | None | Absent | Absent | Absent | None | Absent | None |

### Pathway evidence, ownership, lifecycle, strength, and model effects

| ID | Evidence relationship | Ownership | Lifecycle | Strength/confidence | Model effect | Future AI effect |
|---|---|---|---|---|---|---|
| `PATH-001` | Message → exact EvidenceSpan downstream | Direct user and Session FK | Append APP Explore messages | N/A | Memory, Reference/Profile/Pattern/dark candidates, optional contradiction, grounding | Only transcript/external memory/Reference/Contradiction enter prompt |
| `PATH-002` | None | N/A | None | N/A | None | None |
| `PATH-003` | Profile spans, pattern receipts, UEL/direct reference provenance | User-scoped upload and candidates | Upload states then candidate review | Pattern/reference/contradiction-specific | Accepted reference/contradiction; patterns; internal candidates | Active Reference and qualifying Contradiction only |
| `PATH-004` | Exact EvidenceSpan join | Direct user plus exact owned span | Candidate upsert; no promotion found | Float, capped in dark engine | Dark-engine input only | No |
| `PATH-005` | PatternClaimEvidence; Journal FK optional; message/session scalar | Claim direct user; source owner checked by writer | candidate/active/paused/dismissed; monotonic strength | tentative → developing → established; no downgrade | Map, Inspector, action templates, dark engine, Explore retrieval | PatternClaim itself: no |
| `PATH-006` | Controlled exact dual-span/evidence/UEL lineage | Same user and same-session resolution | candidate → human-confirmed/open → lifecycle | Calibrated confidence/salience | Map, Today, Inspector, prompt, contradiction-drift | Yes when lifecycle qualifies |
| `PATH-007` | UEL polymorphic graph | Direct user and writer validation | internal_only/pending_review | Evidence/objectivity caps | None before publication | No |
| `PATH-008` | UEL plus ModelUpdate affected object | User ownership plus internal reviewer | promoted/internal → user-visible/meaningful | Candidate confidence preserved | Map, Explore, Today, Timeline, Inspector/report | No direct prompt consumption |
| `PATH-009` | JSON source list until publish | Direct user and owned-source filter | proposed | No calibrated semantic confidence | Review proposal only | No |
| `PATH-010` | Materialized UEL and movement snapshots | Direct user | proposal published/rejected; ModelUpdate meaningful | No semantic referee | Movement ledger/report, not guaranteed object mutation | No |
| `PATH-011` | Scalar linked claim/goal IDs | Direct user | not_started/done/helped/didnt_help | Template selection only | Action state and optional ranking diagnostics | No |
| `PATH-012` | Optional Session/Message FKs, no exact span/UEL target | Direct user | candidate/active/archived/superseded | low/medium/high | Prompt memory, Map, Explore grounding | Yes |
| `PATH-013` | UEL, affected object scalar, pointer/rationale | Direct user | movement/pointer lifecycle | Evidence readiness, not semantic confidence | Visible movement/report | No |
| `PATH-014` | Embedded JSON IDs/objects, no relational graph | Row user-owned | Seed/upsert snapshot | N/A | Overrides presentation authority | No |
| `PATH-015` | Correction fields; dark gates consume correction state | Direct user | Correction count/timestamp | Can cap later candidate confidence | Map refresh/future candidate gate | No |
| `PATH-016` | Pattern optional Journal FK; dark packet sources | Direct user | Journal CRUD; check-in append | N/A | Raw evidence until derived; Timeline | No direct prompt consumption |
| `PATH-017` | None | N/A | Local query state | N/A | Navigation only | No |
| `PATH-018` | None | N/A | Absent | N/A | None | No |

### Pathway provider, output, Inspector, fallback, proof, and classification

| ID | Provider + merge precedence | Destinations | Inspector | Fallback risk | Proof | Classification | Source files/symbols |
|---|---|---|---|---|---|---|---|
| `PATH-001` | Free Explore/live assistant; transcript can merge with composition | Explore, Timeline, Inspector | Grounding/review | Reply not grounded in canonical model before generation | static + test | `PARTIAL` | `app/api/message/route.ts:POST`; canonical `FreeExplore`; free-explore API |
| `PATH-002` | None; shell replaces child | Capture affordance only | None | Click has no evidence-write result | static | `MASKED` | `top-bar.tsx:TopBar`; `OrvekWorkbenchShell` |
| `PATH-003` | Import review is forced live over composition | Import overlay, Map, Inspector | Review/detail | Upload masked, in-process queue, ambiguous batch attribution | test | `PARTIAL` | upload processor; `importExtractedConversations`; import queue |
| `PATH-004` | No canonical provider | None | None | Invisible semantic candidates can diverge | test | `PARTIAL` | `profile-derivation.ts`; dark-engine packet |
| `PATH-005` | Map/Decisions/Explore; composition may suppress rails | Map, Decisions, Inspector | Pattern detail | Static actions, no referee, stale strength | test | `PARTIAL` | pattern orchestrator/detector/lifecycle |
| `PATH-006` | Map/prompt; live conflicts merge over composition | Candidate review, Map, Today, Inspector | Dual-source evidence | Default-off; deployed activation unknown | test + local round trip + blocked deploy | `PARTIAL` | contradiction production/natural-entry/adapters |
| `PATH-007` | Internal only | Internal workbench | Internal diagnostics | Fixed deterministic wording; operator route intent unknown | test | `PARTIAL` | dark-run orchestrator/persistence |
| `PATH-008` | Live providers unless composition suppresses rail | All live surfaces | Typed panels | Route masked; not automatically a public defect | test | `PARTIAL` | four publish helpers |
| `PATH-009` | Latest live grounding; composition may own other rails | Explore/Inspector | Movement review | Critical unrelated fixed proposal | static + test | `PARTIAL` | grounding orchestrator/retrieval |
| `PATH-010` | Live movement unless composition dominates | Today, Timeline, Inspector/report | Movement/evidence | Confirmation cannot fix bad semantics; UMC not mutated | test | `PARTIAL` | movement proposal/publish helper |
| `PATH-011` | Decisions live unless composition | Decisions, Today, Inspector | Durable Inspector outcome | No Decision object; local page false success | static + test | `PARTIAL` | `actions-v1`; decisions API/page |
| `PATH-012` | Map/Explore/prompt; Map can be suppressed | Map, Explore, Inspector | Thin source view | Manual active bypass; semantic overlap | test | `PARTIAL` | reference memory/message route |
| `PATH-013` | Today/Timeline/Inspector; composition can replace identities | Today, Timeline, report, Inspector | Full movement/depth | Ledger does not guarantee object change | test | `PARTIAL` | movement/report/depth modules |
| `PATH-014` | Highest Today/full-rail authority; live import/conflict exceptions | Whole workbench | Embedded graph | Fixture can mask live; deployed rows unknown | static + local round trip + blocked deploy | `PARTIAL` | seed/composition/hybrid |
| `PATH-015` | Live Map/Inspector unless shadowed | Map, Inspector | Durable correction | No direct prompt/current narrative update | test | `PARTIAL` | durable controls; UMC PATCH |
| `PATH-016` | Today/Timeline/Explore; composition can suppress | Today, Timeline | Limited | Dedicated inputs masked | test | `PARTIAL` | journal/check-in APIs |
| `PATH-017` | Command palette only | Command navigation | None | Promises object search; only commands; some routes masked | static | `PARTIAL` | `CommandPalette` |
| `PATH-018` | None | None | None | Visual fragments can be mistaken for capture | static | `ABSENT` | `VoiceWaveform`; `ImageUpload` |

## 1. Schema/object inventory

Each Prisma model is assigned exactly one primary role. Secondary roles explain mixed-purpose
objects without weakening the primary classification.

| ID | Object | Primary role | Secondary role(s) | Ownership/lifecycle | Evidence/authority finding | Status / proof |
|---|---|---|---|---|---|---|
| `OBJ-001` | `Category` | `LEGACY_OR_UNUSED` | — | No user ID; legacy companion parent | No intelligence evidence | `LEGACY` / static |
| `OBJ-002` | `Companion` | `LEGACY_OR_UNUSED` | — | No user ID; category relation | Legacy companion/chat entity | `LEGACY` / static |
| `OBJ-003` | `Session` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | Raw evidence | Direct user; APP/import origin and journal/explore surface | Owns messages | proven / test |
| `OBJ-004` | `Message` | `RAW_EVIDENCE` | Capture substrate | Direct user + Session FK; grounding enrichment | Exact spans and many downstream readers | proven / test |
| `OBJ-005` | `JournalEntry` | `RAW_EVIDENCE` | — | Direct user; CRUD | Pattern optional FK; dark/Today/Timeline/Explore readers | partial / static |
| `OBJ-006` | `UserSubscription` | `LEGACY_OR_UNUSED` | — | Direct user; Stripe lifecycle | Commerce, not intelligence | legacy / static |
| `OBJ-007` | `StripeEvent` | `LEGACY_OR_UNUSED` | — | Stripe event ID; idempotency | Commerce ledger | legacy / static |
| `OBJ-008` | `WeeklyAudit` | `MODEL_MOVEMENT_OR_AUDIT_LEDGER` | Legacy | Direct user; draft/locked | Aggregate legacy audit, not canonical report | legacy / static |
| `OBJ-009` | `ReferenceItem` | `CANONICAL_ORVEK_INTELLIGENCE` | Proposal/candidate | Direct user; candidate/active/archive/supersede | Prompt memory and partial Map authority; thin provenance | partial / test |
| `OBJ-010` | `ContradictionNode` | `CANONICAL_ORVEK_INTELLIGENCE` | Proposal/candidate | Direct user; governed lifecycle | Strong controlled AI/referee path plus legacy/manual paths | proven path / local round trip |
| `OBJ-011` | `ContradictionReferenceLink` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | — | Inherited owner; link lifecycle | Real FK join | static / static |
| `OBJ-012` | `ContradictionEvidence` | `RAW_EVIDENCE` | Processing substrate | Inherited owner; append evidence | Session/message scalar IDs in this table | proven / test |
| `OBJ-013` | `ImportUploadSession` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | — | Direct user; full upload lifecycle | Real batch diagnostics, no candidate FK | partial / test |
| `OBJ-014` | `ImportUploadChunk` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | — | Inherited owner; temporary/cascade | Checksum/chunk substrate | partial / test |
| `OBJ-015` | `InternalMetricEvent` | `INTERNAL_OPERATOR_TOOLING` | — | Optional user; append event | Operational only; masked reader | legacy / static |
| `OBJ-016` | `DerivationRun` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | Movement/audit ledger | Direct user; pending/running/completed/failed | Algorithm/input-window receipt | proven / test |
| `OBJ-017` | `EvidenceSpan` | `RAW_EVIDENCE` | Processing substrate | Direct user + Message FK | Exact offsets/hash/unique tuple | proven / test |
| `OBJ-018` | `DerivationArtifact` | `AI_PROPOSAL_OR_CANDIDATE` | Processing substrate | Direct user/run; candidate/promoted/rejected | Candidate/debug substrate, including shadow labels | partial / test |
| `OBJ-019` | `ArtifactEvidenceLink` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | — | Inherited through two FKs | Exact artifact-to-span join | proven / test |
| `OBJ-020` | `ArtifactPromotionLink` | `MODEL_MOVEMENT_OR_AUDIT_LEDGER` | Processing substrate | Promoted entity scalar ID | Promotion receipt with orphan risk | partial / test |
| `OBJ-021` | `ProfileArtifact` | `AI_PROPOSAL_OR_CANDIDATE` | Legacy | Direct user; candidate writer | Rule-derived, exact evidence, no canonical promotion/display | partial / test |
| `OBJ-022` | `ProfileArtifactEvidenceLink` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | — | Inherited through FKs | Exact profile-to-span join | proven / test |
| `OBJ-023` | `Projection` | `LEGACY_OR_UNUSED` | User-facing projection | Direct user; pending/validated/resolved/dismissed | Legacy/masked; source IDs scalar | legacy / static |
| `OBJ-024` | `QuickCheckIn` | `RAW_EVIDENCE` | — | Direct user; append/list | Dark/Timeline input; canonical ingress masked | partial / test |
| `OBJ-025` | `PatternClaim` | `PATTERN_STRENGTHENING_INTELLIGENCE` | Canonical intelligence | Direct user; claim/strength lifecycle | Current five-family pattern authority | proven / test |
| `OBJ-026` | `PatternClaimAction` | `LEGACY_OR_UNUSED` | User-facing projection | Direct user + claim FK | Old micro-experiment/action lifecycle | legacy / static |
| `OBJ-027` | `SurfacedAction` | `USER_FACING_PROJECTION` | Movement/audit state | Direct user; action/outcome states | Static action projected as decision; scalar links | partial / test |
| `OBJ-028` | `SurfacedEvidencePointer` | `USER_FACING_PROJECTION` | Movement/audit ledger | Direct user; pointer lifecycle | Evidence-depth projection with scalar sources | partial / test |
| `OBJ-029` | `EvidencePointerSurfacingRationale` | `MODEL_MOVEMENT_OR_AUDIT_LEDGER` | — | Inherited through pointer | Deterministic surfacing reason | partial / test |
| `OBJ-030` | `PatternClaimEvidence` | `RAW_EVIDENCE` | Pattern intelligence | Claim owner; append receipts | Journal FK optional; message/session scalar | proven / test |
| `OBJ-031` | `UserMapConclusion` | `CANONICAL_ORVEK_INTELLIGENCE` | Proposal/candidate | Direct user; status/visibility/candidate/correction/supersession | Current Map object, no parent `UserMap` table | partial / test |
| `OBJ-032` | `Investigation` | `CANONICAL_ORVEK_INTELLIGENCE` | Proposal/candidate | Direct user; public and candidate lifecycle | Active-question/investigation object | partial / test |
| `OBJ-033` | `ModelUpdate` | `MODEL_MOVEMENT_OR_AUDIT_LEDGER` | Canonical intelligence | Direct user; visibility/meaningful | Current movement ledger; affected object scalar | partial / test |
| `OBJ-034` | `ExploreMovementProposal` | `AI_PROPOSAL_OR_CANDIDATE` | Movement ledger | Direct user; proposed/published/rejected | Current writer has invalid fixed semantic prose | partial / test |
| `OBJ-035` | `FieldworkAssignment` | `CANONICAL_ORVEK_INTELLIGENCE` | Proposal/candidate | Direct user; public/candidate/observation lifecycle | Fieldwork/watch-for object | partial / test |
| `OBJ-036` | `UnderstandingEvidenceLink` | `CAPTURE_OR_PROCESSING_SUBSTRATE` | Movement ledger | Direct user; polymorphic tuple | Current cross-family graph; no target/source FK | partial / test |
| `OBJ-037` | `CanonicalTodayComposition` | `REFERENCE_OR_SYNTHETIC_FIXTURE` | User-facing projection | Unique user row; payload snapshot | Production reader, dev/reference writer | partial / local round trip |
| `OBJ-038` | `CanonicalModelMovementReport` | `REFERENCE_OR_SYNTHETIC_FIXTURE` | User-facing projection | Direct user; report snapshot | Production reader, dev/reference writer; JSON IDs | partial / local round trip |

Absent first-class schema objects include `UserMap`, `Goal`, `Decision`, `Outcome`,
`ActiveQuestion`, `Uncertainty`, `Context`, `Trigger`, and `Receipt`. Some of those concepts are
represented indirectly; their absence alone is not a requirement to add tables. Any future
schema change must follow a declared semantic authority and phase.

All 52 migration directories under `prisma/migrations` were inspected as static lineage and
reconciled with the current schema. They cover the legacy capture/commerce substrate, reference
and contradiction lifecycles, imports, derivation artifacts, the five-family pattern substrate,
surfaced actions/evidence depth, the user-map candidate/movement graph, canonical
composition/report reference rows, and Explore grounding/movement proposals. No migration was
executed. Static migration history cannot prove deployed migration state, backfill success, row
counts, or orphan rates; those remain `BLOCKED_NOT_INSPECTED`.

## 2. Input inventory

| ID | Input | Raw persistence | Downstream | Canonical reach | Main risk |
|---|---|---|---|---|---|
| `IN-001` | Explore text | APP Session and Messages | Generation, memory, profile, patterns, dark candidates, optional contradiction, grounding | proven | Post-hoc/fixed movement proposal |
| `IN-002` | Top-bar Capture | None | None | masked | Named canonical ingress does not write |
| `IN-003` | Legacy journal-chat text | APP Session/Message | Shared message pipeline | masked | Page includes static context claims if ever exposed |
| `IN-004` | Journal entry | JournalEntry | Pattern, Today, Timeline, dark engine, Explore grounding | masked | Backend real, capture UI quarantined |
| `IN-005` | Quick check-in | QuickCheckIn | Timeline/dark engine | masked | No canonical ingress |
| `IN-006` | ChatGPT archive upload | Upload rows and imported Session/Message | Import extraction/pattern/dark candidates | masked | Review exists without upload; queue/provenance gaps |
| `IN-007` | Import candidate decision | Lifecycle/evidence/movement writes | Map/prompt/movement | proven | Reference acceptance has thinner graph |
| `IN-008` | Manual reference/memory | ReferenceItem | Prompt/Map/Explore/dark engine | masked | Manual active path outside candidate review |
| `IN-009` | URL reference | ReferenceItem | Reference readers | masked | External fetch outside canonical entry |
| `IN-010` | Voice | None | None | absent | Random waveform is presentation, not capture |
| `IN-011` | Image/media | Cloudinary widget URL is not a canonical evidence write | None | absent | No evidence/intelligence consumer |
| `IN-012` | Pasted text | Message | Pattern filters may reject quoted/pasted material | partial | No typed paste provenance |
| `IN-013` | Correction/action outcome/fieldwork check-in | UMC fields, action state/note, fieldwork observation | Refresh and limited downstream rules | partial | Duplicate local outcome control |

## 3. Writer inventory

| ID | Writer | Trigger | Writes | Authority/gates | Status |
|---|---|---|---|---|---|
| `WR-001` | Session API | New surface session | Session | Clerk, surface/origin, owner | proven |
| `WR-002` | Message route | Send text | User/assistant Message | Owner, session, model/mode | proven |
| `WR-003` | Journal API | CRUD | JournalEntry | Owner, Zod | masked |
| `WR-004` | Check-in API | POST | QuickCheckIn | Owner, Zod | masked |
| `WR-005` | Native reference extractor | Explicit governed memory intent | Reference candidate | Intent/quality/dedupe | proven |
| `WR-006` | Manual reference actions | Reference APIs | Reference lifecycle | Owner/source validation | masked |
| `WR-007` | Profile derivation | APP/import message | Span, Profile candidate/link | Rule/quality/dedupe | partial |
| `WR-008` | Pattern batch | Native cooldown, Journal create, import complete | Run, Pattern claim/evidence, optional shadow artifact | Behavioral/family/lifecycle gates | proven |
| `WR-009` | Surfaced action sync/outcome | Actions GET/PATCH | SurfacedAction | Pattern/goal selection, owner | partial |
| `WR-010` | Chunk upload | init/chunk/finalize | Upload session/chunk | Type/size/checksum/owner | masked |
| `WR-011` | Archive processor | In-process queue | Imported evidence/candidates | Parser/relevance/transaction/checkpoint | partial |
| `WR-012` | Import review | Accept/reject | Reference/Contradiction lifecycle, UEL/ModelUpdate | Owner/human decision | proven |
| `WR-013` | Controlled contradiction AI | Gated normal message | Contradiction and exact lineage | AI adjudicator/referee + deterministic gates | partial activation |
| `WR-014` | Manual/legacy contradiction | APIs | Contradiction lifecycle/evidence | Owner/schema | partial |
| `WR-015` | Contradiction candidate review | Approved child actions | Open/delete candidate | Owner/human confirmation | proven |
| `WR-016` | Dark candidate bridge | APP event/import completion | One internal candidate + derivation/UEL | Deterministic objectivity/priority | proven mechanics |
| `WR-017` | UMC publish | Internal operator | Visibility + ModelUpdate | Owner/promoted/internal/atomic | proven mechanics |
| `WR-018` | Investigation publish | Internal operator | Visibility + ModelUpdate | Owner/promoted/status/internal | proven mechanics |
| `WR-019` | Fieldwork publish | Internal operator | Visibility + ModelUpdate | Owner/promoted/status/internal | proven mechanics |
| `WR-020` | ModelUpdate publish | Internal operator | Meaningful/visible update, snapshots/pointer | Owner/evidence/internal | proven mechanics |
| `WR-021` | Explore grounding/proposal | Persisted assistant reply | groundingPayload + proposal | Lexical mixed labels + visible UMC | unsafe/partial |
| `WR-022` | Manual public intelligence APIs | POST/PATCH | Public UMC/Investigation/Fieldwork/ModelUpdate | Owner/schema, legacy/manual | partial |
| `WR-023` | Explore proposal publish/reject | User review | Proposal, ModelUpdate, UEL, depth | Owner/status/evidence/publish gates | unsafe inheritance |
| `WR-024` | Evidence-depth author/publish | Eligible ModelUpdate | UEL slots, pointer/rationale | Type/public-readiness gates | partial |
| `WR-025` | Weekly audit | Message/API | WeeklyAudit | Owner/week/lock | legacy |
| `WR-026` | Exact/full-reference seed | Explicit dev route | Composition/report/fixture graph | Local dev/auth/explicit seed | test-only |

## 4. Lifecycle inventory

| ID | Object | States | Transition authority | Finding |
|---|---|---|---|---|
| `LIFE-001` | ReferenceItem | candidate, active, archived, superseded | Human/manual/import review | Partial; multiple create paths |
| `LIFE-002` | ContradictionNode | candidate, open, explored, snoozed, resolved, dismissed | AI/manual creation then human/API | Strongest governed path |
| `LIFE-003` | PatternClaim | candidate, active, paused, dismissed; three strengths | Deterministic thresholds/user actions | No weakening |
| `LIFE-004` | DerivationArtifact | candidate, promoted, rejected | Internal helpers | Diagnostic substrate |
| `LIFE-005` | UserMapConclusion | domain status + pending/held/promoted/rejected/expired | Internal operator/manual API | Partial |
| `LIFE-006` | Investigation | open/active/resolved/archived + candidate lifecycle | Internal operator/manual API | Partial |
| `LIFE-007` | FieldworkAssignment | proposed/assigned/active/completed/dismissed + candidate lifecycle | Internal operator/manual API | Partial |
| `LIFE-008` | ModelUpdate | internal/nonmeaningful → user-visible/meaningful | Publish/manual API | Ledger does not guarantee object mutation |
| `LIFE-009` | ExploreMovementProposal | proposed/published/rejected | Canonical user review | Invalid proposal authority |
| `LIFE-010` | SurfacedAction | not_started/done/helped/didnt_help | User PATCH | Page/Inspector truth split |
| `LIFE-011` | ImportUploadSession | pending through complete/failed/expired | Chunk processor | In-process queue |

## 5. Evidence relationship inventory

| ID | Relationship | Integrity | Finding |
|---|---|---|---|
| `EVID-001` | Message → EvidenceSpan | FK + offsets/hash/unique tuple | Strong exact evidence primitive |
| `EVID-002` | ProfileArtifact ↔ EvidenceSpan | Two-FK join | Strong lineage, weak lifecycle/output |
| `EVID-003` | DerivationArtifact ↔ EvidenceSpan | Two-FK join | Strong derivation lineage |
| `EVID-004` | PatternClaim → evidence | Claim FK; Journal optional FK; Session/Message scalar | Partial DB integrity |
| `EVID-005` | Contradiction → dual spans/evidence | Controlled path proves same-user dual lineage | Strong in controlled path |
| `EVID-006` | Understanding object ↔ UEL ↔ source | Unique polymorphic tuple, no object/source FKs | Application integrity boundary |
| `EVID-007` | ReferenceItem → Session/Message | Optional FKs | No exact span; not a UEL target |
| `EVID-008` | ModelUpdate → affected object | Typed scalar ID | Orphan/semantic-drift risk |
| `EVID-009` | Explore proposal → turn/sources | Scalar IDs/JSON, then UEL on publish | Partial integrity |
| `EVID-010` | Composition/report → embedded graph | JSON IDs only | Fixture projection, not evidence authority |

## 6. AI judgment inventory

| ID | Object/purpose | Implementation/provider | Referee | Product-decision status | Finding |
|---|---|---|---|---|---|
| `AIJ-001` | Assistant reply | OpenAI `streamText`, allowed gpt-4o models | None | Production-wired, runtime not inspected | Prompt omits most canonical intelligence |
| `AIJ-002` | Contradiction adjudication | Strict structured OpenAI call | Concrete independent call | Controlled path | Default-off activation; strongest architecture |
| `AIJ-003` | Pattern shadow labels | OpenAI gpt-4o-mini for two families | None | `usedForProductDecision=false` | Shadow only |
| `AIJ-004` | Five PatternClaims | Rule-based `patternDetectorV1` | None | Canonical authority | Evidence-backed but no semantic model |
| `AIJ-005` | Four internal candidate object types | Deterministic priority/proposal builders | None | Can be operator-published | Objectivity gates are not AI judgment |
| `AIJ-006` | Explore grounding/movement | Lexical overlap + fixed proposal prose | None | Can publish ModelUpdate | Critical invalid semantic authority |
| `AIJ-007` | ProfileArtifact | Regex/rules | None | Candidate only | Exact evidence but invisible |
| `AIJ-008` | Import candidates | Deterministic rules/heuristics | None | Review-dependent | Import contradiction differs from controlled path |
| `AIJ-009` | SurfacedAction recommendation | Static template library | None | User-facing | Not a decision intelligence layer |

## 7. AI referee inventory

| ID | Scope | Implementation | Outcomes/authority | Status |
|---|---|---|---|---|
| `AIREF-001` | Contradiction | Concrete separate structured OpenAI referee | PASS, lower confidence, route, request evidence, abstain; no persistence authority | proven controlled path |
| `AIREF-002` | Shared kernel | Interface, validator, fail-closed wrapper | Same outcomes; no generic concrete adapter | `DESIGNED_ONLY` |
| `AIREF-003` | PatternClaim | None; shadow label is not referee | — | absent |
| `AIREF-004` | UMC/Investigation/Fieldwork/ModelUpdate candidates | None; deterministic objectivity gates only | — | absent |
| `AIREF-005` | ExploreMovementProposal | None | — | absent |
| `AIREF-006` | Profile/Reference/SurfacedAction | None | — | absent |

The kernel explicitly separates semantic judgment from deterministic provenance, schema,
persistence, and validation. `ObjectivityReferee` does not itself implement an AI referee and
never grants persistence authority. The only concrete product object using the full
judgment/referee split is `ContradictionNode`.

### Complete AI judgment/routing/referee control matrix

The two keyed tables below explicitly answer all 18 required control questions. “N/A” means the
path has no provider result or PASS concept; it does not imply the control exists.

| ID | Writer/object | Semantic AI + provider | Structured | Proposed type | Route | Request evidence | Abstain | Independent referee | Lower confidence |
|---|---|---|---|---|---|---|---|---|---|
| `AICOV-001` | ReferenceItem extraction | No / none | N/A | deterministic governed type | no | no | yes | no | deterministic enum only |
| `AICOV-002` | ProfileArtifact | No / none | N/A | regex artifact type | no | no | yes | no | rule confidence/cap |
| `AICOV-003` | trigger_condition | No authority AI; OpenAI shadow | shadow only | fixed family | no | threshold abstention | yes | no | no weakening |
| `AICOV-004` | inner_critic | No authority AI; OpenAI shadow | shadow only | fixed family | no | threshold abstention | yes | no | no weakening |
| `AICOV-005` | repetitive_loop | No / none | N/A | fixed family | no | threshold abstention | yes | no | no weakening |
| `AICOV-006` | contradiction_drift | No second AI / none | N/A | fixed family | no | threshold abstention | yes | no pattern referee | no weakening |
| `AICOV-007` | recovery_stabilizer | No / none | N/A | fixed family | no | threshold abstention | yes | no | no weakening |
| `AICOV-008` | Controlled ContradictionNode | Yes / OpenAI, models separately configurable | strict schema-v4 | yes | yes | yes | yes | yes, separate call/role | yes |
| `AICOV-009` | UMC dark candidate | No / none | typed deterministic | fixed priority lane | fallback only | gate blocks | yes | no | deterministic caps |
| `AICOV-010` | Investigation dark candidate | No / none | typed deterministic | fallback lane | fallback only | gate blocks | yes | no | deterministic caps |
| `AICOV-011` | Fieldwork dark candidate | No / none | typed deterministic | fallback lane | fallback only | gate blocks | yes | no | deterministic caps |
| `AICOV-012` | ModelUpdate candidate/publish | No at writer / none | typed | upstream/fallback | no semantic route | publish needs UEL | yes upstream | generally no | readiness only |
| `AICOV-013` | ExploreMovementProposal | No proposal AI; OpenAI reply earlier | no proposal schema output | always visible UMC target | no | lexical insufficient | yes | no | no semantic confidence |
| `AICOV-014` | Goal-like representations | No shared AI / none | separate schemas | separate stores | no router | object-specific | yes | no | object-specific |
| `AICOV-015` | Decision/outcome projection | No / none | template + PATCH | no Decision type | no | no | selection can return none | no | no |
| `AICOV-016` | Report projection | No / none | typed/contract | no | no | readiness only | yes | no | no |
| `AICOV-017` | Archive extraction | No shared AI / none | typed parser/writers | heuristic per extractor | no shared router | review defer/reject | yes | no | extractor-specific |

| ID | Deterministic gates after | Lineage before write | Malformed fails closed | Calls bounded | Wiring | Does PASS persist? | Write authority | Canonical reach / proof |
|---|---|---|---|---|---|---|---|---|
| `AICOV-001` | yes | partial Session/Message | yes | N/A | production + variants | no PASS concept | auth writer/review; manual active exception | Map/Explore/prompt / test |
| `AICOV-002` | yes | exact span | yes | N/A | production candidate | no PASS; rule writes candidate | background event | dark input only / test |
| `AICOV-003` | yes | receipt, some scalar IDs | shadow malformed cannot affect product | shadow one; authority zero | deterministic production | no PASS | background | Map/Inspector/Decisions / test |
| `AICOV-004` | yes | receipt, some scalar IDs | shadow malformed cannot affect product | shadow one; authority zero | deterministic production | no PASS | background | Map/Inspector/Decisions / test |
| `AICOV-005` | yes | receipt, some scalar IDs | N/A | zero | production | no PASS | background | Map/Inspector/Decisions / test |
| `AICOV-006` | yes | source contradiction/receipt | N/A | zero at pattern stage | production | no PASS | background | Map/Inspector/Decisions / test |
| `AICOV-007` | yes | receipt, some scalar IDs | N/A | zero | production | no PASS | background | Map/Inspector/Decisions / test |
| `AICOV-008` | yes | exact owned dual spans | yes | max four | production-wired, default off | no; continuation and writer gates remain | gated auth background | candidate→Map/Today/Inspector/prompt / local round trip |
| `AICOV-009` | yes | validated UEL inputs | yes | zero | internal candidate production event | no PASS; internal candidate only | publication internal-authorized | after publication / test |
| `AICOV-010` | yes | validated UEL inputs | yes | zero | internal candidate production event | no PASS; internal candidate only | publication internal-authorized | Explore/Today/Timeline / test |
| `AICOV-011` | yes | validated UEL inputs | yes | zero | internal candidate production event | no PASS; internal candidate only | publication internal-authorized | Explore/Today/Timeline / test |
| `AICOV-012` | yes | candidate links; publish needs UEL | yes | zero | internal/manual/Explore variants | no PASS | internal or canonical review | movement surfaces / test |
| `AICOV-013` | lexical gate only | owned source JSON | provider malformed N/A | one reply call; zero proposal calls | production | mixed labels directly write proposal; user publishes | canonical user review | Explore→movement / test |
| `AICOV-014` | yes, unequal | unequal | yes schema | zero | partial/duplicated | no PASS | native/import/manual/internal | Map/Decisions/Explore / test |
| `AICOV-015` | pattern/goal filters | scalar links | PATCH yes | zero | live projection; local page branch | no PASS | actions API plus local state | Decisions/Today/Inspector / test |
| `AICOV-016` | readiness/eligibility | UEL or report JSON | yes | zero | live + seed duplicate | no PASS | upstream publish/local seed | Today/report/Inspector / test |
| `AICOV-017` | yes | mixed; batch FK absent | parser errors close | zero extraction calls | backend live, ingress masked | no PASS; candidates/review | upload/internal hooks | import/Map/pattern/public objects / test |

## 8. Deterministic gate inventory

| ID | Gate | Scope/effect | Status |
|---|---|---|---|
| `GATE-001` | Authentication/ownership | User-scopes current APIs and writes | proven |
| `GATE-002` | Shell route allowlist/quarantine | Defines actual canonical reach | proven |
| `GATE-003` | Contradiction activation | Default-off; zero calls/writes when false | proven |
| `GATE-004` | Contradiction continuation | Schema/referee/lineage/confidence/dedupe/provider cap | proven controlled path |
| `GATE-005` | Behavioral evidence filter | Rejects procedural/quoted/non-behavioral material | proven |
| `GATE-006` | Pattern family thresholds | Family-specific abstention/minimums | proven |
| `GATE-007` | Pattern lifecycle | Monotonic activation/strength | partial; no downgrade |
| `GATE-008` | Dark-engine objectivity | Diversity/time/receipt/contradiction/correction/emotion/identity/overclaim caps | proven |
| `GATE-009` | Internal publication | Ownership/promoted/status/internal/evidence | proven mechanics |
| `GATE-010` | Explore lexical support | Requires mixed labels | unsafe: does not validate semantics |
| `GATE-011` | Import file/chunk | Type/size/count/checksum/owner/checkpoint | proven |
| `GATE-012` | Import human review | Blocks active lifecycle until decision | proven |
| `GATE-013` | Composition contract | Shape/version validation | partial; no truth/authority validation |
| `GATE-014` | Evidence-depth readiness | Only ready pointers merge | proven |

### Objectivity and reality-tracking protection coverage

| ID | Protection | Covered pathways | Partial/absent coverage |
|---|---|---|---|
| `PROTECT-001` | Evidence-count minimums | Patterns, dark engine, ModelUpdate publish | Manual Reference; Explore semantics |
| `PROTECT-002` | Source diversity | Dark engine, pattern container spread, contradiction sides | Profile; Reference; Explore lexical mix |
| `PROTECT-003` | Time spread | Dark supported threshold, pattern day/container accounting | Explore, Reference, Profile |
| `PROTECT-004` | Exact quote/span | EvidenceSpan, controlled contradiction, Profile, pattern receipt selection | Reference, polymorphic UEL, Explore JSON |
| `PROTECT-005` | Receipt requirement | Pattern, dark packet, ModelUpdate UEL, Today pointers | Manual public APIs; Explore semantic claim |
| `PROTECT-006` | Single-episode overreach | Dark block/caps, repeated pattern minimums | Manual Reference; Explore |
| `PROTECT-007` | High-emotion dominance | Dark confidence/identity caps | Most other writers |
| `PROTECT-008` | Identity overclaim | Dark identity/overclaim block, behavioral filters | Static actions, Explore fixed prose, manual APIs |
| `PROTECT-009` | Corrections | Durable UMC fields, dark correction multiplier | Pattern cannot weaken; prompt omits correction |
| `PROTECT-010` | Disconfirming evidence | Contradiction sides, UMC contested/correction, dark contradiction input | Pattern monotonic refresh; Explore |
| `PROTECT-011` | Unresolved contradiction | Dark gates, contradiction_drift | Static actions, Reference/Profile lifecycle |
| `PROTECT-012` | Confidence caps/reduction | Contradiction referee; dark evidence/emotion/profile/correction caps | Pattern weakening; Explore; actions |
| `PROTECT-013` | Duplicate prevention | Contradiction reuse, Pattern/Profile/Reference normalization, unique tuples | Cross-family duplicates; composition graph |
| `PROTECT-014` | Zero-or-one selection | Controlled contradiction; one dark priority proposal | Separate extractors can still write different families |
| `PROTECT-015` | Ambiguity abstention/routing | Contradiction AI/referee; deterministic abstention elsewhere | Only contradiction has semantic routing/request-more-evidence |
| `PROTECT-016` | Ownership/isolation | APIs, contradiction, Explore retrieval, publish, import review | Scalar polymorphic IDs depend on app checks |
| `PROTECT-017` | Cross-session restriction | Contradiction same-session pairing; explicit pattern/dark history aggregation | Scalar sources lack uniform FK |
| `PROTECT-018` | Provider/schema failure | Contradiction fail-closed; shadow non-authoritative; reply errors | Explore proposal has no semantic output validation |
| `PROTECT-019` | Referee failure | Contradiction safe wrapper | No referee elsewhere |
| `PROTECT-020` | Post-judgment persistence authorization | Contradiction continuation; publication gates; human review | Explore proposal lacks semantic judgment; manual public APIs bypass candidates |

## 9. Five pattern-family inventory

These five entries—and only these five entries—are the current `PatternType` families.

| ID | Family | Canonical detector | AI/referee | Evidence minimum/control | Strengthening effect | Current outputs | Future assistant AI |
|---|---|---|---|---|---|---|---|
| `PAT-001` | `trigger_condition` | Rule marker/aggregation adapter | No authority AI; optional shadow; no referee | At least three qualifying marker messages before clue | Monotonic claim/evidence lifecycle | Map, Inspector, static actions, dark engine | Not injected |
| `PAT-002` | `inner_critic` | Rule phrase/quality adapter | No authority AI; optional shadow; no referee | Repeated qualifying self-critical evidence | Monotonic | Map, Inspector, static actions, dark engine | Not injected |
| `PAT-003` | `repetitive_loop` | Rule aggregation across evidence containers | No AI/referee | Repeated loop support | Monotonic | Map, Inspector, static actions, dark engine | Not injected |
| `PAT-004` | `contradiction_drift` | Projects qualifying ContradictionNode rows | No second AI/referee | Source contradiction evidence/lifecycle | Monotonic | Map, Inspector, static actions, dark engine | Pattern not injected; source contradiction may be |
| `PAT-005` | `recovery_stabilizer` | Rule recovery/stabilizer adapter | No AI/referee | At least two qualifying observations | Monotonic | Map, Inspector, static actions, dark engine | Not injected |

| ID | Eligible evidence + trigger | Correction/disconfirming + duplicates | Native/import parity | Decisions / Explore / movement / missing links |
|---|---|---|---|---|
| `PAT-001` | Behavioral Message/Journal history; APP cooldown, Journal create, import completion | Reevaluation flag does not weaken; summaryNorm/type and receipt tuple dedupe | Same detector/history synthesis, different trigger | Static family action; evidence can ground Explore; indirect movement only; no referee/weakening/prompt |
| `PAT-002` | Self-critical Message/Journal evidence; same three triggers | Same monotonic limitation and dedupe | Same path | Static action; Explore evidence; indirect movement; no referee/weakening/prompt |
| `PAT-003` | Repeated Message/Journal support containers; same triggers | Filters abstain; existing strength does not weaken; same dedupe | Same path | Static action; Explore evidence; indirect movement; no referee/weakening |
| `PAT-004` | Qualifying ContradictionNode; same batch after source exists | Source lifecycle can remove later eligibility, but claim does not weaken; same dedupe | Pattern path same, source creation differs: controlled normal AI vs import heuristic/manual | Static action; pattern evidence plus source contradiction; indirect movement; unequal source authority/no pattern referee |
| `PAT-005` | Repeated stabilizing Message/Journal observations; same triggers | No weakening; same dedupe | Same path | Static action; Explore evidence; indirect movement; no referee/weakening/prompt |

All five use `PatternClaim`/`PatternClaimEvidence`, the same candidate/active/paused/dismissed
lifecycle, and the same tentative/developing/established strength machinery. All reach typed
Pattern Inspector evidence. None automatically writes a `ModelUpdate`.

Pattern lifecycle detail:

- Candidate → active requires evidence.
- Tentative → developing uses at least three evidence rows and two support containers.
- Developing → established uses at least seven evidence rows and three support containers.
- Evidence refresh is append-only and strength is monotonic.
- Paused/dismissed claims are frozen.
- A negative action/outcome can request reevaluation, but current refresh does not reduce
  strength. The product therefore strengthens patterns; it does not yet implement governed
  weakening or invalidation.

## 10. Model-effect inventory

| ID | Source | Immediate effect | Durable mutation | Future assistant AI |
|---|---|---|---|---|
| `ME-001` | Active ReferenceItem | Prompt, Map, Explore grounding | Lifecycle | yes |
| `ME-002` | Qualifying ContradictionNode | Map, Today, Inspector, prompt, contradiction pattern | Lifecycle/evidence | yes |
| `ME-003` | PatternClaim | Map, Inspector, actions, dark engine, Explore retrieval | Evidence/strength | no direct prompt |
| `ME-004` | ProfileArtifact | Dark-engine input | Candidate upsert | no |
| `ME-005` | Visible UMC | Map, Today, Explore grounding/anchor, Inspector | Correction/lifecycle; publish ledger | no |
| `ME-006` | Visible Investigation | Explore, Today, Timeline, Inspector | Status/lifecycle/ledger | no |
| `ME-007` | Visible Fieldwork | Explore, Today, Timeline, Inspector | Observation/status/ledger | no |
| `ME-008` | Meaningful ModelUpdate | Today, Timeline, Map preview, Inspector/report | Ledger/snapshots/pointers | no; target may remain unchanged |
| `ME-009` | Published Explore proposal | Creates ModelUpdate | Proposal/movement ledger | no |
| `ME-010` | SurfacedAction/outcome | Decisions/Today/ranking diagnostics | Action state/note | no |
| `ME-011` | Canonical composition/report | Replaces workbench rails | Projection row | no |

## 11. Production provider inventory

| ID | Provider | Reads | Merge precedence | Outputs/fallback | Status |
|---|---|---|---|---|---|
| `PROV-001` | Today re-entry | Journal, contradictions, patterns, movement, UMC, fieldwork, investigations, actions, Timeline layers | Composition owns Today | Today/Inspector; honest empty/loading | proven |
| `PROV-002` | Map | UMC, contradictions, Reference/Pattern context, movement preview | Full composition suppresses live Map except conflicts | Map/Inspector; honest empty | proven |
| `PROV-003` | Decisions | SurfacedAction from Pattern/goal | Full composition suppresses | Decisions/Today/Inspector | partial semantics |
| `PROV-004` | Timeline | Activity/raw evidence/public objects/movement | Full composition suppresses | Timeline/Inspector | proven |
| `PROV-005` | Free Explore | Session/Message/grounding | Transcript may remain live; composition owns rails | Explore/Inspector | unsafe proposal |
| `PROV-006` | Questions/investigations/fieldwork | Investigation/Fieldwork | Full composition suppresses | Explore tabs/Inspector | proven |
| `PROV-007` | Import review | Pending imported Reference/Contradiction | Always live override, never seed | Import overlay/disabled empty | proven |
| `PROV-008` | Canonical composition | Composition/report JSON | Highest Today/full-rail authority; import/conflict exceptions | Whole workbench | partial/duplicate |
| `PROV-009` | Production Inspector bridge | Selected object + typed evidence APIs | Selected hybrid identity | Shared Inspector; honest unsupported/empty | proven |
| `PROV-010` | Assistant generation | Transcript, external memory, Reference, Contradiction | Prompt assembly | Assistant Message | static; runtime blocked |
| `PROV-011` | SessionMemory external | Redis/Upstash, Pinecone, OpenAI embeddings | Combined with DB prompt history | Prompt context | blocked not inspected |

Provider precedence is a substantive authority decision:

1. `EMPTY_ORVEK_DATA_API` is the base.
2. Today/composition is applied first.
3. Full composition is detected by non-empty `mapCategories`.
4. When full composition exists, genuine Map, Timeline, Decisions, Experiment, Active Questions,
   and Investigations overlays are not globally merged; only their shell loading/error state may
   update.
5. Composition rails are then reapplied.
6. Live contradiction conflicts are narrowly merged after composition.
7. Live import-review data explicitly replaces any composition/seed import candidates.
8. Free Explore transcript has separate merge behavior and can remain live while composition
   owns related rails.

## 12. Output/surface inventory

| ID | Surface | Authority | Writes | Finding |
|---|---|---|---|---|
| `OUT-001` | Today | Live provider or composition | Inspector actions; hero control selects | Partial; duplicate authority |
| `OUT-002` | Map | Live UMC/Contradiction/context or composition | UMC correction in Inspector | Partial semantic overlap |
| `OUT-003` | Decisions | SurfacedAction or composition | Inspector durable outcome; page local outcome | Partial/overstated |
| `OUT-004` | Timeline | Live activity/model layers or composition | None | Partial duplicate authority |
| `OUT-005` | Explore | Live chat/questions/fieldwork plus optional composition rails | Message, proposal decision, fieldwork | Critical proposal defect |
| `OUT-006` | Shared Inspector | Selected object + typed APIs | Corrections, outcomes, check-ins, Explore review | Strongest shared output |
| `OUT-007` | Import review | Live candidates only | Accept/reject | Proven, no ingress |
| `OUT-008` | Report/what changed | Live ModelUpdate or seeded report | None | Two report authorities |
| `OUT-009` | Contradiction candidate child | Live candidates | Open/delete | Proven |
| `OUT-010` | Capture | Route navigation | None | Masked |
| `OUT-011` | Search | Command list | None | Does not search promised objects |
| `OUT-012` | Sidebar pulse | Hard-coded title | None | Unsupported “4 places” claim |
| `OUT-013` | Internal review workbench | Internal candidate APIs | Lifecycle/publish | Masked; intent unknown, not automatic defect |
| `OUT-014` | Experiment / Fieldwork | Live visible FieldworkAssignment or composition | Inspector check-in | Explore Fieldwork bridge is canonical; standalone child is masked |
| `OUT-015` | Model Movement | Live ModelUpdate/UEL/pointers or composition movement | Publication happens upstream | Cross-surface ledger is live but need not mutate its target |
| `OUT-016` | Profile / Context | Live Reference/Pattern Map projections; ProfileArtifact indirect; composition possible | Corrections through Inspector | Fragmented semantic authority |
| `OUT-017` | Goals | Goal Reference, goal-like UMC, action projection, or composition | Indirect capture/publish | No first-class Goal authority |
| `OUT-018` | Active Questions / Investigations | Live visible Investigation or composition | Internal/manual lifecycle upstream | Canonical Explore tabs are live; standalone child masked |
| `OUT-019` | Mounted overlays | Live import/report; reference-only capture/search branches | Import decisions | Mixed live/reference authority |

For every `OUT-*` row, the JSON equivalent additionally records the route, mounted component,
semantic purpose, database sources, API/provider, supplying writers, row requirement,
live/reference/composition status, empty-state honesty, unsupported copy, future-interpretation
effect, Inspector support, refresh, ownership evidence, and exact missing connections.

## 13. Masking inventory

| ID | Path | Real backend/page | Middleware/shell result | Classification |
|---|---|---|---|---|
| `MASK-001` | `/journal-chat` | APP message capture; static legacy context cards | Blocked/masked by canonical shell | `MASKED` |
| `MASK-002` | `/import` | Chunked upload UI/APIs | Blocked/masked | `MASKED` |
| `MASK-003` | `/journal` | Journal CRUD | Blocked/masked | `MASKED` |
| `MASK-004` | `/check-ins` | Check-in writer | Blocked/masked | `MASKED` |
| `MASK-005` | `/patterns` | Pattern readers/actions | Blocked/masked | `MASKED` |
| `MASK-006` | `/references`, `/context`, `/memories`, `/projections`, `/audit`, `/metrics` | Legacy/support readers/writers | Blocked/masked | `MASKED` |
| `MASK-007` | `/active-questions`, `/watch-for`, `/what-changed` | Real public projections | Some middleware exceptions, but shell masks child | `MASKED` |
| `MASK-008` | `/internal/user-map/review` | Internal operator workbench | Preserved by middleware, masked by shell | `UNKNOWN_INTENT_NOT_AUTOMATIC_PRODUCT_DEFECT` |
| `MASK-009` | `/contradictions/candidates` | Live candidate review | Exact approved child | `PRESENT_AND_PROVEN` |

## 14. Internal tooling inventory

| ID | Tool | Object types | Purpose/access | Reach/proof |
|---|---|---|---|---|
| `TOOL-001` | Internal understanding review | UMC, Investigation, Fieldwork, ModelUpdate | Allowlisted evidence/lifecycle/publish workbench | masked / static |
| `TOOL-002` | Contradiction candidate review | ContradictionNode | Authenticated owner confirmation/delete | canonical / test |
| `TOOL-003` | No-write dark-run API | Four candidate object types | Internal diagnostics without persistence | API-only / test |
| `TOOL-004` | Exact/full reference seed | Composition/report/fixture graph | Local dev visual/persistence proof | test-only / local round trip |
| `TOOL-005` | Runtime validation fixtures/scripts | Candidate/evidence/movement/contradiction objects | Explicit dry-run/execute operator validation | test/internal / static |

The operator page filters `internal_only` candidates and non-meaningful ModelUpdates, and its copy
identifies one internal workbench. It must not be exposed publicly merely because it is masked.

## 15. New-versus-old mapping

| ID | Concept | Current canonical authority | Old/parallel implementation | Verdict |
|---|---|---|---|---|
| `NVO-001` | Shell | Frozen five-surface workbench + Inspector | Root pages, old v0/mobile surfaces | Canonical shell wins |
| `NVO-002` | Chat evidence | Explore APP Session/Message | journal-chat/generic chat pages | Shared backend; Explore is reachable |
| `NVO-003` | Patterns | PatternClaim projected into Map/Inspector/Decisions | Masked Pattern pages and PatternClaimAction | Storage shared, display replaced |
| `NVO-004` | Current model | UMC/Contradiction/Reference/Pattern Map projections | ProfileArtifact, Context/Memories, Projection | Authority duplicated |
| `NVO-005` | Movement | ModelUpdate Today/Timeline/Inspector/report | WeeklyAudit/Projection | ModelUpdate is current ledger |
| `NVO-006` | Reports | ModelUpdate report projection | Canonical seeded report/WeeklyAudit | Duplicated |
| `NVO-007` | Import | Candidate review overlay | Masked upload page | Review canonical; ingress absent |
| `NVO-008` | Decisions | SurfacedAction projection | PatternClaimAction/no Decision model | Semantic overreach |

## 16. Duplicate-authority inventory

| ID | Concept | Competing authorities | Risk |
|---|---|---|---|
| `DUP-001` | Goal | goal Reference, GOAL ProfileArtifact, goal-like UMC, action scalar link | Different evidence/lifecycles |
| `DUP-002` | Identity/value/habit/background | Profile, Reference, Pattern, UMC, composition object | Divergent live claims |
| `DUP-003` | Report | ModelUpdate report, canonical report, WeeklyAudit | Different identities/evidence |
| `DUP-004` | Workbench rails | Genuine APIs vs composition JSON | Fixture masks live |
| `DUP-005` | Action/decision/outcome | SurfacedAction, PatternClaimAction, page local state, composition decision | No first-class authority |
| `DUP-006` | Contradiction creation | Controlled AI, import heuristic, manual API | Only one has full controls |
| `DUP-007` | Evidence graph | Family FKs, UEL, JSON/scalar IDs, surfaced pointers | Unequal integrity/coverage |

## 17. Writers without canonical readers

| ID | Object | Writer | Reader finding | Classification |
|---|---|---|---|---|
| `WWR-001` | ProfileArtifact | Rule derivation | Dark-engine input only; no canonical review/promotion/display | stored not surfaced |
| `WWR-002` | Shadow DerivationArtifact | Optional pattern LLM | Diagnostics only, not product decision | internal |
| `WWR-003` | Projection | Legacy API | Masked routes only | legacy |
| `WWR-004` | WeeklyAudit | Message/audit API | Masked audit; not canonical report | legacy |
| `WWR-005` | InternalMetricEvent | Metric writer | Masked metrics | legacy |
| `WWR-006` | Composition/report | Dev seed | Production reader exists without natural production writer | reference-only writer |

## 18. Readers without authoritative writers

| ID | Concept | Reader | Writer finding | Classification |
|---|---|---|---|---|
| `RWW-001` | Live Today composition | Composition/hybrid API | Only local exact/reference seed | reference-only writer |
| `RWW-002` | Decision | Decisions UI | No Decision model/writer; reads SurfacedAction | absent object |
| `RWW-003` | Outcome | Outcome/reveal UI | No Outcome model; indirect action note plus local state | partial indirect |
| `RWW-004` | Object search | Top-bar affordance | No owned object search provider | absent |
| `RWW-005` | Model status count | Sidebar pulse | No writer/provider for count four | absent |

## 19. Stored but not canonically surfaced

| ID | Stored object | Surface finding | Qualification |
|---|---|---|---|
| `SNS-001` | ProfileArtifact candidates | No canonical surface | Can influence dark candidates |
| `SNS-002` | DerivationArtifact/promotion links | No canonical surface | Internal provenance |
| `SNS-003` | Internal understanding candidates | No public surface before publish | By design; not automatically a defect |
| `SNS-004` | Projection | None | Legacy |
| `SNS-005` | WeeklyAudit | None | Legacy |
| `SNS-006` | Import upload history | None | Review sees candidates, not batches |

## 20. Surfaced but not durably stored/authorised

| ID | Surface claim | Storage reality | Risk |
|---|---|---|---|
| `SURF-001` | Sidebar “Model changed in 4 places” | Hard-coded title | Unsupported claim |
| `SURF-002` | Decisions outcome success | Local `outcomeAdded` state | False model-effect claim |
| `SURF-003` | Decisions draft | Local state, no handoff/persistence | Looks like entry |
| `SURF-004` | Search receipts/decisions/reports/timeline | Commands only | Affordance overclaim |
| `SURF-005` | Reference/dev CaptureOverlay receipt success | Local state | Not production branch today, unsafe if exposed |
| `SURF-006` | Reference/composition narrative | Embedded projection JSON | Can appear without live evidence authority |

## 21. Displayed without a current-model effect

| ID | Display | Actual effect |
|---|---|---|
| `DME-001` | Canonical Decisions local outcome | None |
| `DME-002` | Sidebar model pulse | None |
| `DME-003` | SurfacedAction recommendation | Action row/state only |
| `DME-004` | Journal/check-in Timeline event | Raw evidence until separately derived |
| `DME-005` | Command search labels | Navigation only |
| `DME-006` | ModelUpdate movement | Ledger/projection; target semantics may remain unchanged |

## 22. Model effect not consumed by future assistant AI

| ID | Object | Current effect | General assistant prompt |
|---|---|---|---|
| `MFA-001` | PatternClaim | Map/actions/dark engine/Explore retrieval | Not included |
| `MFA-002` | UserMapConclusion | Map/Today/Explore grounding | Not included |
| `MFA-003` | Investigation | Explore/Today/Timeline | Not included |
| `MFA-004` | FieldworkAssignment | Explore/Today/Timeline | Not included |
| `MFA-005` | ModelUpdate | Today/Timeline/report/Inspector | Not included |
| `MFA-006` | ProfileArtifact | Dark-engine evidence | Not included |
| `MFA-007` | SurfacedAction outcome | State/ranking diagnostics | Not included |

By contrast, active `ReferenceItem` rows and qualifying `ContradictionNode` rows do enter the
assistant system prompt. External transcript/vector memory also affects later generation, but its
deployed provider state was not inspected.

## 23. Ownership and orphan-risk inventory

| ID | Object | Ownership boundary | Orphan/integrity risk |
|---|---|---|---|
| `OWN-001` | Session/Message/EvidenceSpan | Direct user IDs + FKs | Low; duplicate owner equality is application-enforced |
| `OWN-002` | PatternClaimEvidence | Claim owner | Session/Message scalar IDs |
| `OWN-003` | ContradictionEvidence | Contradiction owner | Legacy session/message scalar IDs |
| `OWN-004` | UnderstandingEvidenceLink | Direct user | Both target/source polymorphic IDs lack FKs |
| `OWN-005` | ModelUpdate | Direct user | affected object type/ID lacks FK |
| `OWN-006` | FieldworkAssignment | Direct user | linked object type/ID lacks FK |
| `OWN-007` | ExploreMovementProposal | Direct user | Conversation/messages/target/update scalar; sources JSON |
| `OWN-008` | SurfacedAction | Direct user | claim/goal scalar links |
| `OWN-009` | Projection | Direct user | Legacy scalar source IDs |
| `OWN-010` | Composition/report | Direct user row | Embedded graph/related IDs not relational |
| `OWN-011` | Import candidates | User scoped | No upload-session FK |
| `OWN-012` | Deployed rows | Not inspected | Actual orphan counts blocked |

These risks do not authorize a schema change. They identify integrity boundaries that future
contracts must resolve before migration.

## 24. Runtime proof ledger

| ID | Subject | Proof | Current-audit execution | Status |
|---|---|---|---|---|
| `RTP-001` | Shell/route quarantine | test | Source/current isolated tests inspected; no browser | proven |
| `RTP-002` | Hybrid/empty/live provider merge | test | Source/tests inspected | proven |
| `RTP-003` | Five patterns/lifecycle | test | Source/tests inspected; no DB | proven |
| `RTP-004` | Understanding candidate mechanics | test | In-memory/isolated tests and ledger receipts; no current DB | proven mechanics |
| `RTP-005` | Contradiction AI/referee/writer | local round trip | Accepted isolated proof inspected; no calls now | proven controlled path |
| `RTP-006` | Deployed contradiction activation | blocked | Deployment not inspected | blocked |
| `RTP-007` | Exact/full composition | local round trip | Dev seed/receipts inspected; no current DB | test-only |
| `RTP-008` | Explore fixed proposal | test/static | Reachable write/publish path established | proven defect |
| `RTP-009` | Deployed data/counts/orphans/composition rows | blocked | No DB | blocked |
| `RTP-010` | Deployed external providers | blocked | No config/provider calls | blocked |

The contradiction classification requires precision:

- Repository architecture: controlled AI adjudicator + separate referee + deterministic
  continuation + repaired writer are proven.
- Repository default activation: off.
- Public activation authorised by this audit: no.
- Deployed activation/config/provider health: `BLOCKED_NOT_INSPECTED`.
- Existing stored open contradictions can still be read and displayed independently of new
  ingestion.

## 25. Unknown/blocked inventory

| ID | Question | Reason | Status |
|---|---|---|---|
| `BLK-001` | Do deployed users have composition/report rows? | No DB/deployed data access | blocked |
| `BLK-002` | Is contradiction ingestion enabled in deployment? | No deployment config inspection | blocked |
| `BLK-003` | Counts/status/evidence/orphan rates? | No DB | blocked |
| `BLK-004` | Must operators reach internal review through this shell? | Current authority does not state intent | unknown |
| `BLK-005` | Are OpenAI/Redis/Pinecone providers healthy? | No config/provider calls | blocked |
| `BLK-006` | Does import processing lose work under real restarts? | Static risk only | unknown |
| `BLK-007` | Are seed routes impossible under every deployment config? | Guards static; deploy uninspected | unknown |
| `BLK-008` | Are manual public POST APIs in active client use? | No traffic/log inspection | unknown |

## Stable risk register

| ID | Severity | Finding | Classification | Future delivery |
|---|---|---|---|---|
| `RISK-001` | Critical | Stored/publishable Explore movement uses fixed unrelated insight prose | proven live architecture break | `DEL-001` |
| `RISK-002` | High | Canonical Capture has no reachable write path | missing ingress | `DEL-002` |
| `RISK-003` | High | Persisted reference composition can suppress live rails | duplicate output authority | `DEL-003` |
| `RISK-004` | High | Decisions semantics exceed object/storage authority | surfaced not governed | `DEL-004` |
| `RISK-005` | High | Movement ledger does not guarantee current-object mutation | missing semantic model effect | `DEL-007` |
| `RISK-006` | High | Future assistant omits most canonical intelligence | model effect not future AI | `DEL-007` |
| `RISK-007` | Medium | Patterns lack semantic referee and weakening | partial intelligence control | `DEL-006` |
| `RISK-008` | Medium | Reference/Profile/Pattern/UMC overlap | duplicate semantic authority | `DEL-005` |
| `RISK-009` | Medium | Polymorphic/scalar relationships permit drift | integrity risk | `DEL-005` |
| `RISK-010` | Medium | Import ingress/queue/provenance incomplete | partial capture | `DEL-008` |
| `RISK-011` | Medium | Static model pulse and command-search overclaim | unsupported UI claim | `DEL-002` |
| `RISK-012` | Medium | Contradiction deployment activation unverified | blocked activation | `DEL-009` |
| `RISK-013` | Low | Internal review reachability intent unresolved | unknown operations intent | `DEL-009` |

### Critical Explore proof

`lib/explore-grounding-retrieval.ts:selectExploreGroundingSources`:

- tokenizes the user message and already-generated assistant reply;
- computes lexical overlap;
- labels high overlap `VERIFIED` and lower overlap `INFERRED`;
- when all hits look verified, can deliberately relabel a different owned family as inferred so
  the mixed-status gate can pass.

`lib/explore-grounding-orchestrator.ts:orchestrateExploreReplyGrounding`:

- runs after the assistant reply has already been generated and persisted;
- requires the lexical mix and a visible UMC;
- always constructs an `afterSummary` about “stop-point sensitivity after meetings”;
- always constructs a rationale saying the conversation supports movement;
- always constructs a user-facing summary about an “evening stop-point signal after meetings.”

`lib/explore-movement-proposal.ts:publishExploreMovementProposal`:

- creates an internal, non-meaningful `ModelUpdate`;
- materializes UEL rows;
- calls the normal ModelUpdate publish helper;
- makes it user-visible and meaningful after the user action.

Ownership checks, evidence links, and human confirmation do not establish that fixed prose is true.
This pathway must fail closed before broader capture or activation work.

## 26. Controlling completion roadmap

This amendment changes implementation control, not the completed technical inventory or risk
register. The nine `DEL-001`–`DEL-009` IDs remain top-level engineering boundaries for
traceability; they are not nine compulsory sequential weeks. The former simple priority order is
superseded by the phases, substeps, campaigns, gates, and parallelism rules below.

### Controlling architecture invariants

#### Presentation and navigation authority — `PRESENTATION_AND_NAVIGATION_AUTHORITY`

The approved final reference shell permanently controls component and page structure, card
structure, hierarchy, typography, spacing, Inspector placement, navigation destinations, visible
controls, and overall desktop presentation. The data swap must not redesign, simplify, delete,
rearrange, or redirect it.

```text
keep the shell
  -> replace displayed reference content with genuine live content
```

The replaced values include live text, IDs, statuses, timestamps, counts, evidence, selected
objects, button availability, and honest empty/unavailable states.

#### Production data authority — `PRODUCTION_DATA_AUTHORITY`

Authenticated production content must come from genuine user-owned persisted data, genuine
production providers, honest empty states, or honest unavailable states. Reference, demo,
fixture, and exact-composition payloads may remain only for development, visual comparison,
deterministic tests, and explicit reference mode. They must never override genuine production
rails.

#### Semantic authority — `SEMANTIC_AUTHORITY`

Canonical Orvek object contracts determine what a row means. The implementation must preserve
the distinction between raw evidence, stable explicit memory, patterns, current conclusions,
contradictions, investigations, fieldwork, decisions, outcomes, movement history, and current
model state. A live database row is not automatically authoritative current truth.

#### No routing drift — `NO_ROUTING_DRIFT`

No delivery may redirect an approved control to a legacy page because its backend already
exists, expose a masked internal route without an explicit product/operations decision, remove
an unfinished control, or change a control destination without approval. An unfinished control
remains disabled, neutral, or honestly unavailable inside the approved shell until its intended
pathway is connected.

### Permanent implementation gates

All four gates apply to every top-level delivery and every execution substep:

| Gate | Required proof |
|---|---|
| `VISUAL_PARITY_GATE` | No unexpected layout, spacing, hierarchy, typography, component-arrangement, Inspector-placement, responsive, or empty-state-placement change. |
| `NAVIGATION_PARITY_GATE` | For every affected control, prove control → intended destination/action → actual destination/action, with no routing drift. |
| `LIVE_DATA_ROUND_TRIP_GATE` | For every connected rail, prove real owned input → persisted row → production provider → exact existing shell slot → applicable Inspector/evidence → refresh → same object identity → foreign-user isolation. |
| `NO_REFERENCE_AUTHORITY_GATE` | Production shows only genuine live data or honest empty/unavailable state; never fixture prose as intelligence, synthetic IDs, hard-coded movement claims, or reference composition suppressing live rows. |

### Finding interpretation

| Category | Controlling interpretation |
|---|---|
| Actual unsafe bug | `RISK-001`: fixed Explore “meetings / stop-point” movement can become stored meaningful intelligence. |
| Core live-data or intelligence architecture breaks | `RISK-003`–`RISK-009`: reference override, duplicate semantic authority, movement without target mutation, incomplete future-AI context, drifting evidence relationships, and ungoverned Decision/Outcome truth. |
| Known unfinished product integration | `RISK-002`, `RISK-010`, `RISK-011`: Capture, command-only Search, static movement status, canonical import entry, and absent voice/image capture are unfinished work, not newly discovered catastrophic failures. |
| Operational unknowns prohibited from this audit | `BLK-001`–`BLK-008`, `RISK-012`, `RISK-013`: deployed rows/composition, runtime activation, provider health, environment values, orphan rates, and operator-tool reachability intent remain uninspected. |

### Controlling phases

#### Phase 0 — immediate intelligence containment — `PHASE-000` / `IMMEDIATE_INTELLIGENCE_CONTAINMENT`

`DEL-001A` — `EXPLORE-MOVEMENT-FIXED-SEMANTICS-CONTAINMENT-001`

- Dependencies: none.
- Scope: stop creation of the fixed unrelated movement proposal and prevent existing unsafe fixed
  proposals from publishing as meaningful/user-visible ModelUpdates.
- Preserve: Explore Session/Message persistence, safe evidence retrieval and grounding, honest
  no-movement states, ownership, refresh stability, and the exact shell/navigation.
- Exclude: replacement AI adjudication, Objectivity Referee, Explore redesign, route changes,
  provider calls, and contradiction activation.
- Required proof: unrelated conversation → no fixed movement proposal → no meaningful false
  ModelUpdate; Explore chat/persistence/safe grounding continue; no provider or non-local
  database is used.

#### Phase 1 — live-data and semantic-authority foundation — `PHASE-001` / `LIVE_DATA_AND_SEMANTIC_AUTHORITY_FOUNDATION`

`DEL-003` makes genuine live providers authoritative while preserving the exact approved
presentation. Its only execution dependency is `DEL-001A` plus an approved reversible handling
plan for any persisted composition rows. Capture/search/status is not a prerequisite.

`DEL-005` declares, for each human concept, its authoritative current object, raw evidence,
strengthening object, candidate/proposal, movement history, future-AI eligibility, and
correction/supersession rules. It covers at least `ReferenceItem`, `ProfileArtifact`,
`PatternClaim`, `UserMapConclusion`, `ContradictionNode`, `Investigation`,
`FieldworkAssignment`, `ModelUpdate`, `SurfacedAction`, and future Decision/Outcome.

The contract-writing portion of `DEL-005` may run with `DEL-003`. No semantic migration or
destructive merge may occur until the authority contract and authorised read-only inventory
requirements are satisfied.

Phase 1 completes only when every production shell slot has live authority, reference content
cannot masquerade as user data, empty/unavailable states are honest, the supplying object’s
semantic role is declared, and layout/navigation are unchanged.

#### Phase 2 — complete the core intelligence loop — `PHASE-002` / `COMPLETE_CORE_INTELLIGENCE_LOOP`

`DEL-001B` — `EXPLORE-MOVEMENT-SEMANTIC-RESTORATION-001`

- Dependencies: `DEL-003`, `DEL-005`, an approved structured proposal contract, and an authorised
  provider-fixture/budget plan.
- Scope: conversation-specific structured semantic judgment, affected-object routing,
  independent shared-kernel Objectivity Referee, `ROUTE` / `REQUEST_MORE_EVIDENCE` / `ABSTAIN`,
  deterministic evidence/ownership/confidence/persistence gates, and adversarial isolated
  round-trip proof.
- Presentation: render only in the unchanged Explore movement slots.

`DEL-004` builds the minimum real Decision/Outcome system in the existing approved Decisions
shell: statement, context/tension, evidence, chosen direction, lifecycle, durable outcome,
outcome evidence, and later model effect. Local-only success and unsupported decision semantics
must be removed.

`DEL-006` preserves all five pattern families while adding governed correction, disconfirming
evidence, weakening, confidence reduction, pause, dismissal, and supersession. Semantic
AI/referee use is decided family by family; no expensive referee call is mandatory without
justification.

`DEL-007` depends on `DEL-001B`, `DEL-004`, `DEL-005`, and `DEL-006`. Accepted movement must
update or version its affected current object and create an immutable ModelUpdate ledger record.
Later AI receives only relevant reviewed current intelligence—not every stored row—including
eligible memory, confirmed contradictions, reviewed conclusions, established patterns,
corrections/supersessions, active investigations, relevant recent movement, and current goals.

Phase 2 completes when the loop is life evidence → governed intelligence → current model → later
AI interpretation → new evidence → reviewed model movement. A ModelUpdate cannot claim change
without target-object change, and disputed/candidate/stale intelligence remains excluded or
qualified.

#### Phase 3 — essential shell-control connection — `PHASE-003` / `ESSENTIAL_SHELL_CONTROL_CONNECTION`

`DEL-002` now follows `DEL-001A`, `DEL-003`, and the relevant `DEL-005` semantic contracts. It
wires genuine APP text Capture into the existing control, preserves its exact placement and
intended action, makes Search query owned objects or truthfully identifies it as command
navigation, and makes movement status live or neutral. It must not restore an old page, redesign
the shell, redirect to an unintended legacy destination, or add voice/image.

`DEL-008A` — `CANONICAL-IMPORT-ENTRY-CONNECTION-001`

- Dependencies: `DEL-001A`, `DEL-003`, and `DEL-005`.
- Scope: connect the approved shell to the existing import pathway and review flow without
  exposing the old import page as the finished interface or claiming durability is complete.

Phase 3 completes when essential visible controls are genuine, truthful, refresh-stable,
owner-isolated, visually unchanged, and navigation-parity proven.

#### Phase 4 — import durability and controlled operational proof — `PHASE-004` / `IMPORT_DURABILITY_AND_CONTROLLED_OPERATIONAL_PROOF`

`DEL-008B` — `CANONICAL-IMPORT-DURABILITY-AND-PROVENANCE-001`

- Dependencies: `DEL-008A`, `DEL-003`, and `DEL-005`.
- Scope: upload → durable processing → restart-safe retry → exact upload-batch-to-candidate
  lineage → idempotent review → refresh persistence.
- Preserve: original imported evidence; no automatic historical backfill without separate
  approval.

`DEL-009` then uses an independently proven immutable read-only capability to inspect deployed
rows/lifecycles, composition/report rows, evidence coverage, scalar orphans, duplicate authority,
runtime flags, contradiction activation, provider availability, and internal operator-tool
requirements. Bounded staging proof and activation remain separate decisions. The internal
UMC/Investigation/Fieldwork/ModelUpdate workbench is not exposed as a normal user page without an
explicit decision.

#### Phase 5 — foundation-complete expansion — `PHASE-005` / `FOUNDATION_COMPLETE_EXPANSION`

This phase is outside the nine top-level audit deliveries. After desktop foundation completion it
may cover settings, universal voice, image/screenshot evidence, useful legacy capabilities mapped
into the approved shell, mobile readiness, and mobile development. Old pages are not restored
wholesale.

### Execution campaigns

| Campaign | Bounded execution |
|---|---|
| `ASSAULT A` | `DEL-001A`: Explore containment plus shell/navigation regression lock. |
| `ASSAULT B` | `DEL-003` live-provider authority plus `DEL-005` semantic-object authority. |
| `ASSAULT C` | `DEL-001B`, `DEL-004`, `DEL-006`, and `DEL-007`: safe movement, Decisions/Outcomes, pattern revision, and real model movement/future AI. |
| `ASSAULT D` | `DEL-002` plus `DEL-008A`: Capture/search/status and canonical import entry. |
| `ASSAULT E` | `DEL-008B` plus `DEL-009`: import durability, deployed inventory, staging proof, and separate activation decision. |

Expansion covers settings, voice, image, and mobile after the five controlling campaigns.

### Parallelism rules

- The nine top-level boundaries are not nine compulsory sequential weeks.
- `DEL-003` and the contract-writing portion of `DEL-005` may overlap after `DEL-001A`.
- `DEL-004` and `DEL-006` may run in parallel after `DEL-005` authority is approved.
- `DEL-002` wiring may begin during late Phase 2 after its data contracts are stable.
- `DEL-008A` is intentionally separate from `DEL-008B`.
- Tasks that can create conflicting semantic authority or competing writers must not run in
  parallel.

### Top-level delivery boundaries

| Traceability boundary | Controlling phase/substep dependency | Bounded outcome |
|---|---|---|
| `DEL-001` | Phase 0 `DEL-001A`; Phase 2 `DEL-001B` | Split immediate containment from deferred semantic restoration. |
| `DEL-002` | `DEL-001A`, `DEL-003`, relevant `DEL-005` contracts | Connect Capture/search/status only after live and semantic authority are stable. |
| `DEL-003` | `DEL-001A` | Give authenticated live providers production precedence without presentation drift. |
| `DEL-004` | `DEL-003`, `DEL-005` | Create governed Decision/Outcome truth inside the existing shell. |
| `DEL-005` | `DEL-001A`; contract work may overlap `DEL-003` | Declare semantic object/evidence authority before migration or broad exposure. |
| `DEL-006` | `DEL-005` | Add governed pattern revision and justified family-specific AI/referee use. |
| `DEL-007` | `DEL-001B`, `DEL-004`, `DEL-005`, `DEL-006` | Couple immutable movement history to actual target-object revision and later AI. |
| `DEL-008` | Phase 3 `DEL-008A`; Phase 4 `DEL-008B` | Split canonical shell entry from import durability/provenance. |
| `DEL-009` | Completion of unsafe/authority/core-loop/import prerequisites | Inspect deployment safely, prove staging, and decide activation separately. |

The prior simple nine-step priority ordering is superseded. The audit remains the complete
technical inventory, its risk register remains valid, and the approved reference shell remains
the permanent presentation/navigation authority. This is not a return to hybrid page replacement:
the objective is to map genuine live values into the approved shell.

### Delivery contracts

#### `DEL-001` — `EXPLORE-MOVEMENT-INTELLIGENCE-FAIL-CLOSED-001`

- Exact problem: `RISK-001`; a reachable writer can store and publish fixed, conversation-
  unrelated Explore movement as meaningful model change.
- Affected pathways: `PATH-009`, `PATH-010`.
- Affected objects: `OBJ-004`, `OBJ-031`, `OBJ-033`, `OBJ-034`, `OBJ-036`.
- Affected outputs: `OUT-005`, `OUT-006`, `OUT-015`.
- Prerequisites/dependencies: `DEL-001A` has none; `DEL-001B` later requires `DEL-003`,
  `DEL-005`, the semantic proposal contract, and an isolated provider-fixture/budget plan.
- Scope: the top-level boundary is split. `DEL-001A` immediately blocks fixed proposal
  creation/publication without building AI. `DEL-001B` later adds conversation-specific
  structured AI judgment, an independent shared-kernel referee, and deterministic
  evidence/ownership/confidence gates.
- Must remain unchanged: frozen shell/layout, genuine Explore Session/Message capture, safe
  ModelUpdate publication gates, and the lack of public contradiction activation.
- Proof required: containment proves unrelated conversation → no fixed proposal → no false
  ModelUpdate while chat/persistence/grounding remain safe; restoration later adds adversarial,
  malformed/referee-failure, isolation, and deterministic-provider round-trip proof.
- Delivery type/order: `PRODUCT_CODE` containment in Phase 0; `PRODUCT_CODE` + `AI_LAYER`
  restoration in Phase 2. Only containment is the immediate next delivery.

#### `DEL-002` — `CANONICAL-CAPTURE-SEARCH-AND-STATUS-TRUTH-001`

- Exact problem: `RISK-002`, `RISK-011`; canonical Capture does not write, command-only search
  overclaims object search, and the sidebar movement count is hard-coded.
- Affected pathways: `PATH-002`, `PATH-017`, `PATH-018`.
- Affected objects: `OBJ-003`, `OBJ-004`.
- Affected outputs: `OUT-010`, `OUT-011`, `OUT-012`, `OUT-019`.
- Prerequisites/dependencies: `DEL-001A`, `DEL-003`, and the relevant `DEL-005` semantic
  contracts.
- Scope: wire real APP text capture inside the frozen shell; either query owned objects or label
  search as commands; make movement status provider-backed or neutral.
- Must remain unchanged: frozen shell/chrome and evidence-gated downstream writers; voice/image
  remain unavailable until they have genuine evidence contracts.
- Proof required: canonical click→persist→refresh, no-write/error states, search/status source
  assertions, and owner isolation.
- Delivery type/order: `PRODUCT_CODE` + `PROVIDER_WIRING`; Phase 3, after the live-data and
  semantic-authority foundation rather than before it.

#### `DEL-003` — `CANONICAL-LIVE-AUTHORITY-PRECEDENCE-001`

- Exact problem: `RISK-003`; persisted reference composition can suppress genuine live Map,
  Timeline, Decisions, and Explore rails.
- Affected pathway: `PATH-014`.
- Affected objects: `OBJ-037`, `OBJ-038`.
- Affected outputs: `OUT-001`, `OUT-002`, `OUT-003`, `OUT-004`, `OUT-005`, `OUT-008`,
  `OUT-014`, `OUT-015`, `OUT-016`, `OUT-017`, `OUT-018`, `OUT-019`.
- Prerequisites/dependencies: `DEL-001A` containment and an approved reversible handling plan
  for composition rows, without assuming deployed row state. `DEL-002` is explicitly not a
  prerequisite.
- Scope: constrain full/reference composition to explicit dev/reference contexts and make
  authenticated live providers plus honest empty states production authority.
- Must remain unchanged: frozen presentation, live import-review override, live
  contradiction-conflict merge, and dev visual-reference route.
- Proof required: provider-precedence tests, production source assertion, owner-safe reversible
  cleanup plan, and visual parity using live empty/data fixtures.
- Delivery type/order: `PRODUCT_CODE` + `PROVIDER_WIRING` + `DATA_MIGRATION_PLANNING`; Phase 1
  foundation because later semantic/output work must be judged against real rails.

#### `DEL-004` — `DECISION-OUTCOME-TRUTH-AND-PERSISTENCE-001`

- Exact problem: `RISK-004`; deterministic actions are presented as Orvek decisions and the
  canonical outcome success is local state despite a separate durable Inspector writer.
- Affected pathway: `PATH-011`.
- Affected objects: `OBJ-009`, `OBJ-025`, `OBJ-027`.
- Affected outputs: `OUT-001`, `OUT-003`, `OUT-006`, `OUT-017`.
- Prerequisites/dependencies: `DEL-003`, `DEL-005`, and an explicit action-versus-decision
  product contract.
- Scope: choose truthful action/decision semantics, remove local-only success, and either persist
  evidence/model-effect outcomes or relabel/defer the unsupported interaction.
- Must remain unchanged: existing action history and, except where truth requires copy/control
  removal, the frozen Decisions layout; no schema before the contract.
- Proof required: one page/Inspector durable round trip, evidence and owner isolation, no
  unsupported AI-choice copy, and explicit downstream model-effect proof.
- Delivery type/order: `PRODUCT_CODE` + `POSSIBLE_SCHEMA_AFTER_CONTRACT`; Phase 2 after live and
  semantic authority, and before final semantic model revision.

#### `DEL-005` — `INTELLIGENCE-OBJECT-AUTHORITY-AND-EVIDENCE-GRAPH-001`

- Exact problem: `RISK-008`, `RISK-009`; overlapping Reference/Profile/Pattern/UMC concepts and
  polymorphic scalar relationships permit duplicate authority and orphan drift.
- Affected pathways: `PATH-004`, `PATH-005`, `PATH-007`, `PATH-008`, `PATH-012`, `PATH-013`,
  `PATH-015`, `PATH-016`.
- Affected objects: `OBJ-009`, `OBJ-017`, `OBJ-021`, `OBJ-022`, `OBJ-025`, `OBJ-030`,
  `OBJ-031`, `OBJ-032`, `OBJ-033`, `OBJ-035`, `OBJ-036`.
- Affected outputs: `OUT-002`, `OUT-006`, `OUT-008`, `OUT-014`, `OUT-015`, `OUT-016`,
  `OUT-017`, `OUT-018`.
- Prerequisites/dependencies: `DEL-001A`; a concept-by-concept product contract and authorised
  read-only inventory before migration. Contract writing may overlap `DEL-003`, while semantic
  migration waits for live authority and the approved contract.
- Scope: declare authority and translation/retention rules, then harden owner/orphan validation
  without silently merging or migrating semantic objects.
- Must remain unchanged: original evidence, user corrections, internal-tool status absent a new
  intent decision, and the no-schema-before-contract boundary.
- Proof required: authority-matrix and owner/orphan tests, Inspector continuity, and reversible
  migration proof if later authorised.
- Delivery type/order: `ARCHITECTURE_CONTRACT` + `PRODUCT_CODE` +
  `DATA_MIGRATION_PLANNING`; Phase 1 foundation because model/pattern/import work needs canonical
  identity.

#### `DEL-006` — `PATTERN-INTELLIGENCE-REFEREE-AND-REVISION-001`

- Exact problem: `RISK-007`; pattern authority is deterministic, optional LLM labels are
  shadow-only, no pattern referee exists, and strength cannot weaken.
- Affected pathway: `PATH-005`.
- Affected objects: `OBJ-016`, `OBJ-018`, `OBJ-025`, `OBJ-026`, `OBJ-027`, `OBJ-030`.
- Affected outputs: `OUT-002`, `OUT-003`, `OUT-006`, `OUT-016`.
- Prerequisites/dependencies: `DEL-005`; declared Pattern/UMC/Profile/Reference evidence authority
  and a correction/disconfirmation contract.
- Scope: decide family-by-family semantic AI/referee authority, preserve deterministic
  abstention, and add governed invalidation/correction/weakening.
- Must remain unchanged: the five `PatternType` families, raw evidence/receipts, non-authority of
  shadow output, and the understanding-first product frame.
- Proof required: per-family adversarial/abstention, correction/strength-reduction transitions,
  applicable referee failures, and native/import parity.
- Delivery type/order: `PRODUCT_CODE` + `AI_LAYER`; sixth because pattern revision requires
  object/evidence authority and must precede pattern-driven model revision.

#### `DEL-007` — `MODEL-REVISION-SEMANTIC-EFFECT-AND-FUTURE-AI-001`

- Exact problem: `RISK-005`, `RISK-006`; ModelUpdate need not mutate its affected current object,
  and most canonical intelligence is absent from later assistant context.
- Affected pathways: `PATH-001`, `PATH-005`, `PATH-008`, `PATH-010`, `PATH-012`, `PATH-013`,
  `PATH-015`.
- Affected objects: `OBJ-009`, `OBJ-010`, `OBJ-025`, `OBJ-031`, `OBJ-032`, `OBJ-033`,
  `OBJ-035`, `OBJ-036`.
- Affected outputs: `OUT-001`, `OUT-002`, `OUT-004`, `OUT-005`, `OUT-006`, `OUT-008`,
  `OUT-014`, `OUT-015`, `OUT-018`.
- Prerequisites/dependencies: `DEL-001B`, `DEL-004`, `DEL-005`, `DEL-006`; truthful outcomes,
  canonical identity, safe Explore restoration, pattern revision semantics, and a
  prompt-provenance contract.
- Scope: make confirmed movement an evidence-gated, versioned affected-object transition and
  expose only reviewed current objects/corrections/movement to later AI.
- Must remain unchanged: immutable ModelUpdate audit history, raw evidence, human
  correction/supersession, and exclusion of unreviewed candidates from prompts.
- Proof required: atomic target-version+ledger round trip, rollback/supersession,
  prompt-provenance snapshot, and stale/contested/cross-user adversarial tests.
- Delivery type/order: `PRODUCT_CODE` + `AI_LAYER` + `PROVIDER_WIRING`; final Phase 2 boundary
  because semantic mutation is unsafe before movement, outcomes, identities, and patterns are
  governed.

#### `DEL-008` — `CANONICAL-IMPORT-INGRESS-DURABILITY-AND-PROVENANCE-001`

- Exact problem: `RISK-010`; upload ingress is masked, processing is in-process, and candidates
  lack exact upload-session lineage.
- Affected pathway: `PATH-003`.
- Affected objects: `OBJ-003`, `OBJ-004`, `OBJ-009`, `OBJ-010`, `OBJ-013`, `OBJ-014`,
  `OBJ-021`, `OBJ-025`, `OBJ-031`, `OBJ-032`, `OBJ-033`, `OBJ-035`.
- Affected outputs: `OUT-007`, `OUT-019`.
- Prerequisites/dependencies: `DEL-008A` requires `DEL-001A`, `DEL-003`, and `DEL-005`;
  `DEL-008B` additionally requires the completed shell-entry connection and durable job
  ownership.
- Scope: `DEL-008A` connects the approved shell to the existing import/review pathway.
  `DEL-008B` separately adds durable retry/ownership and exact batch→candidate provenance
  without changing intelligence truth rules.
- Must remain unchanged: binary upload safety, user confirmation before activation, original
  imported evidence, and no automatic historical backfill.
- Proof required: restart/retry/idempotency, exact lineage, owner isolation, large/chunk failure,
  and canonical review refresh.
- Delivery type/order: `DEL-008A` is Phase 3 `PRODUCT_CODE`; `DEL-008B` is Phase 4
  `PRODUCT_CODE` + `INFRASTRUCTURE` + `POSSIBLE_SCHEMA_AFTER_CONTRACT`.

#### `DEL-009` — `DEPLOYED-DATA-INVENTORY-AND-CONTROLLED-ACTIVATION-PROOF-001`

- Exact problem: `RISK-012`, `RISK-013`, `BLK-001`–`BLK-008`; deployed rows, orphans,
  configuration, provider availability, feature activation, and operator reach intent are unknown.
- Affected pathways: `PATH-003`, `PATH-006`, `PATH-007`, `PATH-008`, `PATH-014`.
- Affected objects: `OBJ-009`, `OBJ-010`, `OBJ-013`, `OBJ-016`, `OBJ-018`, `OBJ-021`,
  `OBJ-023`, `OBJ-025`, `OBJ-031`, `OBJ-032`, `OBJ-033`, `OBJ-035`, `OBJ-036`, `OBJ-037`,
  `OBJ-038`.
- Affected outputs: `OUT-001`, `OUT-002`, `OUT-005`, `OUT-006`, `OUT-007`, `OUT-009`,
  `OUT-013`, `OUT-015`.
- Prerequisites/dependencies: `DEL-001A`, `DEL-001B`, `DEL-002`, `DEL-003`, `DEL-005`,
  `DEL-006`, `DEL-007`, `DEL-008B`; explicit data authority, an independently proven immutable
  harness, staging account/provider budget, and completion of unsafe/authority repairs.
- Scope: measure rows/orphans/fixture presence, decide internal operator reachability, run bounded
  staging proofs, and record a separate activation decision.
- Must remain unchanged: production data, secret confidentiality, internal-tool status absent an
  explicit decision, and the separation between proof and activation.
- Proof required: read-only capability proof, sanitised inventory receipt, capped provider
  abstention/ownership/refresh round trip, and separate go/no-go record.
- Delivery type/order: Phase 4 `INFRASTRUCTURE` + `DATA_INVENTORY` + `RUNTIME_ACTIVATION`;
  deployed proof validates repaired architecture and cannot substitute for missing controls.

Immediate `DEL-001A` acceptance is deliberately narrower than full restoration: no fixed
user-facing movement proposal or meaningful false ModelUpdate, while safe Explore
chat/persistence/grounding, ownership, refresh, shell, and navigation remain unchanged.
`DEL-001B` later adds the no-write rules after referee `ROUTE`, `REQUEST_MORE_EVIDENCE`, or
`ABSTAIN`, exact evidence lineage, adversarial tests, and isolated round-trip proof.

The internal candidate workbench is deliberately not promoted to an early public delivery. Its
reachability belongs to `DEL-009` unless an explicit operator product requirement establishes a
different bounded need.

## Artifact verification

| Check | Result | Detail |
|---|---|---|
| JSON parse, counts, 416 stable-ID uniqueness checks, Markdown/JSON verdict/pathway/output/roadmap parity, all 26 required inventories, cross-reference integrity, and critical source assertions | PASS | 38 objects, 13 inputs, 26 writers, 18 pathways, 19 outputs, five patterns, 13 risks, nine top-level deliveries, four substeps, five execution campaigns; zero unresolved pathway/roadmap references |
| `git diff --check` with the two new artifacts included as intent-to-add | PASS | No whitespace errors |
| `bash scripts/check-trust-language.sh` | PASS | No banned V1-visible terms |
| `bash scripts/check-legacy-surfaces.sh` | PASS | Legacy/hidden surface audit clean |
| Source-only `desktop-old-route-shell-quarantine` Vitest suite | PASS | 13 tests passed |
| Eight selected dependency-backed isolated suites | BLOCKED | Module loading stopped because this worktree has no installed `@prisma/client`, `zod`, or `lucide-react`; no assertions ran |
| Full Vitest, TypeScript, and production build | NOT RUN | Dependencies are not installed. Full Vitest also includes a local-PostgreSQL Explore assault suite outside this audit's zero-database boundary. |

The module-load failure is an environment/dependency limitation, not a test assertion failure.
No dependency install, database connection, or provider call was used to bypass it.

## Final classifications

```text
AUDIT_EXECUTION: PASS
WHOLE_PRODUCT_PRODUCTION_READY: NO
ARCHITECTURE_MAP_COMPLETE: YES
LIVE_DATA_PATHWAY_MAP_COMPLETE: YES
AI_LAYER_COVERAGE_MAP_COMPLETE: YES
PATTERN_FAMILY_MAP_COMPLETE: YES
OUTPUT_AUTHORITY_MAP_COMPLETE: YES
DEPLOYED_DATA_INSPECTED: NO
LIVE_PROVIDER_CALLS: 0
DATABASE_CONNECTIONS: 0
APPLICATION_CODE_CHANGED: NO
FUTURE_DELIVERY_COUNT: 9
EXECUTION_CAMPAIGN_COUNT: 5
NEXT_IMPLEMENTATION_DELIVERY: EXPLORE-MOVEMENT-FIXED-SEMANTICS-CONTAINMENT-001
```
