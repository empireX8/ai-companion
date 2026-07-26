# FULL-ORVEK-WHOLE-PRODUCT-TRUTH-COHERENCE-AUDIT-001

## Audit decision

| Question | Verdict |
|---|---|
| Canonical model | `CANONICAL_MODEL_FRAGMENTED` |
| Whole product | `WHOLE_PRODUCT_INCOHERENT` |

The repository implements several useful intelligence object families, but it does not implement one authoritative, revisable current user model. The live product then projects those families independently across surfaces. That produces observable breaks in evidence counts, movement semantics, object identity, action intent, correction durability, route behavior, and future-AI consumption.

This is an architectural truth-coherence verdict, not a visual-restoration verdict. The accepted permanent desktop shell and Inspector geometry were treated as controlling presentation authority and were not re-litigated.

## Audit metadata

| Field | Value |
|---|---|
| Repository | `/Users/user/ai-companion` |
| Branch | `staging` |
| Audited base | `b9631e6e5e361c4a41275c6f52b5c2c750509df7` |
| Audit date | 2026-07-26 |
| Method | Read-only source inspection, read-only local PostgreSQL inspection, deterministic tests |
| Application writes | None |
| Schema or data changes | None |
| Live AI calls | None |
| Authenticated browser journey | Not executed: no local application server or supplied authenticated session |

The local database contains development and test fixtures. Runtime observations below prove behavior in this checkout and expose integrity failures in that data; they are not claims about a deployed production database or a real person's model. User identifiers and private semantic text are deliberately omitted.

## Controlling authority and configuration

The audit used:

- `AGENTS.md`
- `docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md`
- `docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.md`
- `docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.json`
- `lib/orvek-intelligence-object-authority.ts`
- the production API, adapter, workbench, Navigator, Inspector, Explore, correction, movement, and report paths named in this report

Archived redesign receipts were not treated as current acceptance authority.

### Runtime configuration observed

| Configuration | Observed state | Audit consequence |
|---|---|---|
| `DATABASE_URL` | Present; local PostgreSQL database `companion` | Read-only aggregate/integrity queries were possible |
| `OPENAI_API_KEY` | Present; value not inspected or printed | No live AI call was made |
| `ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED` | Absent/default off | No enabled semantic-movement experiment assumed |
| `RUN_PRODUCTION_CONTRADICTION_INGESTION` | Absent/default off | No production contradiction ingestion assumed |
| `ACTION_RANKING_LIVE_SIMULATION_ENABLED` | Absent/default off | No live ranking simulation assumed |
| `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE` | Absent/default off | Fixture fallback was not accepted as live evidence |
| Local app server, ports 3000–3003 | Not running | Browser/API journey not available |

No read was sent to `GET /api/actions`, because that nominal read path can write through `syncSurfacedActions`.

## Plain-language canonical-model finding

There is no single canonical user model in the implementation.

The declared authority names three separate current-truth families—`UserMapConclusion`, `ContradictionNode`, and `ReferenceItem`—while `PatternClaim` and `ProfileArtifact` can express overlapping conclusions about goals, identity, beliefs, habits, values, and behavioral patterns. There is no complete concept-key registry, translation boundary, or precedence rule that reduces those overlapping records to one authoritative current representation.

`ModelUpdate` records that movement was published, but publication does not revise or supersede the target `UserMapConclusion`. Snapshot materialization can copy the target's current text into a missing `afterSummary`; it is not a state transition. The authority contract explicitly defers target mutation to DEL-007.

Future AI generation does not consume the putative current user map or the movement ledger. The message route consumes transcript/vector memory, qualifying `ReferenceItem` rows, and eligible `ContradictionNode` rows. It does not load `UserMapConclusion`, `PatternClaim`, `ProfileArtifact`, `Investigation`, `FieldworkAssignment`, `ModelUpdate`, or their unified evidence lineage. Explore grounding and movement-proposal work occurs after an assistant response is generated and stored.

Therefore:

- raw evidence exists, but it is not uniformly resolved;
- interpretations exist in several competing families;
- proposals and history exist, but proposal publication is not an atomic revision of current truth;
- no single current representation governs all page projections and future AI;
- weakening, correction, supersession, and revision are inconsistent by family;
- movement can be displayed without a provable before/after change.

## Canonical object-family inventory

| Family | Actual role | Current vs proposed/history | Evidence and lineage | Revision/weakening behavior | Live consumers |
|---|---|---|---|---|---|
| `ReferenceItem` | Explicit/reference memory and interpretation | `active` records may act as current memory; most local rows are `candidate` | Source metadata and reference retrieval; not a universal claim-evidence graph | Supports supersession/status semantics, but local data has no supersession chain | Future AI, memory/context paths, action selection |
| `ProfileArtifact` | Legacy/dark-engine interpretation candidate | Candidate/translation input, not declared current authority | Artifact-level sources; not the shared projection contract | Status can represent supersession, but local rows are all candidate | Dark-engine/translation paths; not the canonical workbench model |
| `PatternClaim` | Pattern intelligence | Candidate/active pattern state; not the sole current model | `PatternClaimEvidence` and unified evidence links | Pause, dismiss, and reevaluation fields exist; none are exercised in inspected data | Today aggregates, Explore, actions, Inspector; not Map's “Patterns” rail and not future AI |
| `UserMapConclusion` | Intended current interpretive conclusion | Emerging/supported/disputed; internal rows can be proposed | `UnifiedEvidenceLink`; displayed `evidenceCount` can disagree with resolvable sources | Version, correction, and supersession fields exist, but movement publication does not mutate them | Map, Today movement context, Inspector, Explore grounding, report targeting; not future AI |
| `ContradictionNode` | Structured conflict/tension interpretation | Eligibility/status decides whether it is current enough to surface | `ContradictionEvidence` plus unified evidence links | Status/lifecycle controls eligibility; no single precedence rule against disputed map conclusions | Map/Today when eligible, future AI when open/eligible |
| `Investigation` | Open inquiry/process object, not user truth | Open/resolved process state | Links to source/target objects | Can progress, resolve, and reopen; progress updates do not revise target truth | Today, Explore, Inspector |
| `FieldworkAssignment` | Observation/task object, not user truth | Assigned/active/completed process state | Links to investigation or surfaced action; check-in content is process evidence | Durable check-ins/status changes; no automatic canonical conclusion revision | Today, Explore, Inspector |
| `Decision` | Not implemented as a first-class model | A `SurfacedAction` is projected as `type: "decision"` | Action linkage, not decision-option evidence | No decision version or lifecycle contract | Decisions page and Inspector projection only |
| `Outcome` | Not implemented as a first-class model | `SurfacedAction.status` and `note` stand in for outcome | A note is not an outcome-to-model lineage contract | Durable status/note write only; no canonical consequence | Decision outcome controls |
| `ModelUpdate` | Movement/history ledger | Internal candidate then published visible history | Unified evidence links, affected target, optional snapshots | Publication is effectively immutable, but does not mutate/supersede the target | Today, Map movement preview, Timeline, Inspector, reports; not future AI |

### Required classification matrix

None of the ten named model families is the immutable raw evidence record. Messages, imports, evidence spans, and other source records fill that role. “Current” below means current within that family's bounded role; it does not mean that the family is the one canonical model.

| Family | Raw evidence | Interpretation | Current model state | Proposed change | Audit/history | Supersede | Weaken/qualify | Contradict |
|---|---|---|---|---|---|---|---|---|
| `ReferenceItem` | No | Yes: governed memory | Only an `active` memory, not the whole model | A `candidate` can supersede an active item | No | Schema/path supports `supersedesId` | Status/replacement only | Conflicting memory creates a candidate; no universal conflict graph |
| `ProfileArtifact` | No | Yes | No; legacy/translation input | Candidate interpretation | No | Status supports it in principle | Status replacement only | No shared contradiction contract |
| `PatternClaim` | No | Yes | Current pattern intelligence when active, not canonical truth | Candidate before activation | No | No canonical version chain | Confidence/reevaluation/pause/dismiss fields | Can carry counterevidence semantics, but no precedence over map conclusions |
| `UserMapConclusion` | No | Yes | Intended current interpretive conclusion | Internal/proposed lifecycle exists | No | Version/supersession fields exist; publication path does not use them | Confidence/status/correction fields exist; no complete atomic revision | `disputed` exists; no cross-family conflict resolution |
| `ContradictionNode` | No | Yes: conflict interpretation | Current only when eligible/open enough to surface | Candidate lifecycle | No | Resolve/replace semantics, not a common version chain | Strength/status can change | The object represents contradiction |
| `Investigation` | No | A question/hypothesis process, not a settled interpretation | No | No direct model change; it proposes inquiry | Progress history only | No canonical supersession | Can resolve/reopen | Findings may conflict, but do not atomically revise truth |
| `FieldworkAssignment` | No | No: assignment/observation process | No | No direct model change | Check-in/process history only | No | Status/check-in only | Observation may challenge a claim, but no automatic revision |
| `Decision` | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented |
| `Outcome` | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented | Not implemented |
| `ModelUpdate` | No | No: it asserts a transition | No | Internal candidate before publication | Yes | Effectively immutable ledger; no target supersession | No | Can label correction/contradiction movement, but cannot itself resolve it |

## Concept ownership and overlap

| Concept | Competing representations | Authority result |
|---|---|---|
| Goals | Active `ReferenceItem`, `ProfileArtifact.GOAL`, goal-area `UserMapConclusion`, action-ranking inputs | Fragmented; no explicit translation/precedence contract |
| Values and meaning | `ProfileArtifact.VALUE`, map meaning-system conclusions, reference memory | Fragmented |
| Identity and beliefs | `ProfileArtifact.IDENTITY`/`BELIEF`, map operating-logic conclusions, reference memory | Fragmented |
| Behavioral and trigger patterns | `PatternClaim`, map conclusions shown under “Patterns”, `ProfileArtifact.HABIT`/`EMOTIONAL_PATTERN` | Fragmented; the same surface label refers to different object families |
| Contradictions | `ContradictionNode`, disputed map conclusions, contradiction-drift pattern semantics | Partially assigned, with no cross-family precedence |
| Conclusions/current interpretation | `UserMapConclusion` intended, but overlaps references, patterns, and profile artifacts | Not singularly authoritative |
| Decisions | `SurfacedAction` presentation alias | Canonical object not implemented |
| Outcomes | `SurfacedAction.status`/`note` presentation alias | Canonical object not implemented |
| Uncertainty | Conclusion status/confidence, contradiction state, investigation state | Distributed; no common uncertainty owner |
| Open questions | `Investigation`, active-question projections, Map questions | Process ownership exists, projection identity is not unified |
| Movement | `ModelUpdate` ledger | Ledger authority exists, but target-state transition does not |

### Declared versus effective authority

`lib/orvek-intelligence-object-authority.ts` is internally honest that `PatternClaim` is not canonical current truth, `ProfileArtifact` is legacy/translation input, and Decision/Outcome are future work. It nevertheless declares three independent current-truth families. That is a federation, not one canonical model.

`lib/orvek-v0/production/workbench-authority.ts` correctly prevents `CanonicalTodayComposition` from governing production and permits it only on the canonical development route. Stale Prisma comments still describe the composition as production-authoritative. The two local composition rows are fixture/reference records, not evidence of production composition authority.

## Lifecycle and revision proof

### Required end-to-end lifecycle

No real movement in the inspected local cohort completes the required lifecycle.

| Required stage | Representative runtime result |
|---|---|
| New user evidence | Source messages/import evidence exists |
| Evidence stored | Yes: messages, imports, evidence spans, and linked semantic rows exist |
| Interpretation proposed | Candidate producers exist, but no surviving proposal is linked to the representative movement; local `ExploreMovementProposal` count is 0 |
| Supporting and conflicting evidence identified | Failed for the movement: 0 update-specific evidence links and no reconstructible conflicting-evidence set |
| Semantic review/referee | No reconstructible review decision on the movement |
| User confirms, qualifies, or rejects | No reconstructible user decision on the movement |
| Exact target identified | Yes: `cmq6frqdx0000ql8h6nkavzue` resolves as a `UserMapConclusion` |
| Current target mutated or superseded | No |
| `ModelUpdate` records transition | A record exists, but its transition fields are absent |
| All downstream surfaces consume new state | No: Today/Map count the ledger, Timeline excludes it by window, the report rejects it, and future AI ignores it |

### What publication currently does

`lib/explore-movement-proposal.ts`:

1. locks and re-fetches the target `UserMapConclusion`;
2. verifies that the target summary still equals the proposal's `beforeSummary`;
3. creates/publishes a `ModelUpdate` and evidence links;
4. updates the proposal;
5. does **not** update or supersede the `UserMapConclusion`.

`lib/model-update-candidate-publish-helper.ts` changes `ModelUpdate` visibility/meaningfulness and materializes snapshots/evidence depth. `lib/model-movement-snapshot.ts` may fill absent snapshot fields from the current target. Neither path performs a canonical target revision.

Publishing candidate conclusions, investigations, or fieldwork changes their visibility/process state and can produce movement-ledger entries; it does not establish one atomic old-current → new-current transition.

### Required before-and-after fields

For representative movement `cmq6h8ewn0000qlbwlg485jx1`:

| Required proof | Result |
|---|---|
| Target object ID | Present: `cmq6frqdx0000ql8h6nkavzue` |
| Target object type | Resolves as `UserMapConclusion` |
| Previous version | Absent |
| New version | Absent; target remains version 1 |
| Supporting evidence IDs | No update-specific evidence links; affected target has 50 links |
| Conflicting evidence IDs | Absent |
| Reason for change | Not report-ready/reconstructible |
| Confidence before | Absent |
| Confidence after | Absent |
| Review decision | Absent |
| Timestamp | Present: `2026-06-09T10:08:13.944Z` |
| Resulting revision/supersession link | Absent |

The target can be read now, but the previous and resulting canonical states cannot be reconstructed from this update. User-facing movement prose is therefore not mutation proof.

### Revision capability

| Operation | Implemented as a canonical current-model transition? | Finding |
|---|---|---|
| Create | Partial | Families and candidate writers can create records |
| Strengthen | Partial | Confidence/status can rise in family-specific paths, but movement is not an atomic target revision |
| Qualify | Partial | Correction/status fields can record qualification metadata |
| Weaken | Not proved | Fields and dark-engine gates exist, but no complete current-target downgrade transition was observed |
| Contradict | Partial | Contradiction objects and disputed status exist without one precedence/revision transaction |
| Supersede | Not proved for current map | Fields exist; inspected map conclusions have no chain and movement publication does not create one |
| Retire | Family-specific only | Pattern/reference/contradiction lifecycle controls do not retire one shared canonical concept |
| Restore | Family-specific only | Reopen/activation semantics do not restore a versioned canonical interpretation |

The implementation can accumulate and annotate records, but this audit could not prove that later evidence can lower and replace the one current interpretation consumed everywhere.

### AI consumption matrix

The live generation pathway is `app/api/message/route.ts:POST`.

| Question | Result |
|---|---|
| Current-model types included | Active/relevant `ReferenceItem`; eligible/token-relevant `ContradictionNode`; transcript/vector memory |
| Current-model types ignored | `UserMapConclusion`, `PatternClaim`, `ProfileArtifact`, `Investigation`, `FieldworkAssignment`, `ModelUpdate`, Decision, Outcome |
| Superseded objects excluded | Active-status filtering protects reference retrieval; ignored map/version families have no applicable prompt exclusion proof |
| Rejected interpretations excluded | Candidate map proposals are not direct prompt inputs, but the prompt has no canonical revision/version filter |
| Contradictions included | Yes, when the contradiction surface returns eligible items and token overlap passes |
| Confidence/uncertainty included | Contradiction status and recommended rung are included; canonical conclusion confidence/uncertainty is absent |
| Evidence lineage available | No IDs or source lineage are supplied in the generation prompt |
| Evidence distinguishable from interpretation | Transcript roles are labeled, but injected memories/tensions are semantic prose without full evidence-vs-interpretation lineage |
| Changed state affects the next response | No: `UserMapConclusion` and `ModelUpdate` are not prompt inputs |

### Local runtime integrity sample

At `2026-07-26T21:31:22.237Z`, the local database contained:

| Object | Count and state |
|---|---|
| Sessions | 784 (`APP` 144, imported 640) |
| Messages | 18,656 |
| Evidence spans | 5,965 |
| Reference items | 29: 1 active, 28 candidate |
| Profile artifacts | 203: all candidate |
| Pattern claims | 30: all active |
| Contradiction nodes | 25: all candidate |
| User-map conclusions | 59: 27 supported, 16 emerging, 16 disputed |
| Investigations | 35: 22 open, 13 resolved |
| Fieldwork assignments | 9 |
| Surfaced actions | 1,208 |
| Model updates | 25 |
| Explore movement proposals | 0 |
| Unified evidence links | 171 |
| Surfaced evidence pointers | 12 |

Integrity observations:

- 14 unified evidence links have dangling source rows.
- 6 unified evidence links cross local fixture owners.
- all 12 surfaced evidence pointers are `PatternClaim`-backed fixture projections, not first-class receipt objects;
- no inspected reference, profile artifact, or map conclusion exercises a genuine supersession chain;
- no pattern claim exercises pause, dismissal, or reevaluation;
- all 25 model-update targets resolve, but only 19 share the same local owner;
- 24 model updates have a before snapshot and 21 have an after snapshot;
- no model update has a confidence delta;
- only 3 after summaries match the target's current semantic summary;
- one primary-cohort update has no update-specific evidence links and no before/after/confidence change.

This data is fixture-contaminated, but the failures are still valid local integrity findings.

### Canonical integrity-rule disposition

| Automatic rule | Disposition |
|---|---|
| Two current objects independently own one concept | Failed: goals, identity/beliefs, patterns, and contradictions overlap |
| Model update has no exact target | Passed for the representative update; its target resolves |
| `ModelUpdate` created without changing current state | Failed |
| Before or after cannot be reconstructed | Failed for the representative update |
| Evidence belongs to another user | Failed in contaminated local fixture data: 6 cross-owner unified links |
| Assistant prose treated as user evidence | No such failure found in the inspected movement path; assistant messages are linked as `context`, while user messages may be `supports` |
| Rejected/superseded objects influence current output | Not fully testable because inspected current families have no real supersession chain; active reference filtering does exclude inactive candidates from reference prompt retrieval |
| Today/Map/Timeline presents obsolete version | Failed semantically: Today/Map show a 47-day-old ledger item without a resulting version; Timeline excludes it |
| Future AI receives updated model | Failed |
| Confidence can rise but never fall | No complete downward canonical revision was proved |
| Aggregate sentence presented as canonical object | Failed: receipt and decision aliases are independently constructed projections |
| Each page reconstructs model meaning independently | Failed: independent adapters and time windows |

## Exact representative trace

### Mandatory Trace 1 — Today headline and lead

| Today field | Exact lineage and result |
|---|---|
| Headline count | `buildTodayBriefingTitle` counts `snapshot.intelligenceUpdates.length`. The one counted row is `ModelUpdate cmq6h8ewn0000qlbwlg485jx1`, and it resolves. The query is all-time rather than a Today window. |
| Lead identity | `pickTodayHeroItem` selects that update; `heroFromMovement` creates transient `hero-movement-<ID>`, while `mapHero.inspectSelectId` and `buildCanonicalLiveRuntimeData.today.leadId` resolve back to the raw ModelUpdate ID. |
| Lead title | `resolveModelUpdateDisplayTitle` derives it from the ModelUpdate's stored `userFacingSummary`, update-type label, and affected-object type label. Private text omitted. |
| Lead narrative | `heroFromMovement.summary` uses the stored ModelUpdate `userFacingSummary`; the live provider takes `todayProps.hero.summary`. It is not the target conclusion's current summary. |
| “What changed” | Uses the formatted `conclusion_added` update-type label. |
| Evidence count | The selected ModelUpdate object has 0 update-specific evidence links. Its affected conclusion has 50 links, only 45 resolving. The UI cannot prove a movement-specific receipt count. |
| Date | Uses ModelUpdate `createdAt`, `2026-06-09T10:08:13.944Z`, formatted relatively; the entry is 47 days old at audit time. |
| Click-to-Inspector | Source and focused tests show lead selection uses the raw ModelUpdate ID and opens the Movement tab/common Inspector shell. The authenticated click was not executed. The destination is not empty geometry, but it lacks before/after, rationale, confidence change, and update-specific evidence. |
| First-Decisions fallback | Not active in this representative state because the hero resolves. `buildCanonicalLiveRuntimeData` still substitutes `decisionListGroups[0].ids[0]` whenever no hero selection exists, while retaining separately derived hero narrative. This deterministic fallback remains defect WP-007. |

### Current conclusion and movement

The local primary cohort has one visible `UserMapConclusion`:

- canonical ID: `cmq6frqdx0000ql8h6nkavzue`
- status/confidence: emerging/medium
- stored and displayed evidence count: 50
- unified evidence links: 50
- resolvable source objects: 45
- dangling source links: 5
- version: 1
- supersession chain: none
- corrections: none

Its representative visible movement is:

- canonical `ModelUpdate` ID: `cmq6h8ewn0000qlbwlg485jx1`
- target: the conclusion above
- type: `conclusion_added`
- created: `2026-06-09T10:08:13.944Z`
- before snapshot: absent
- after snapshot: absent
- confidence delta: absent
- update-specific unified evidence links: 0
- affected-target links: 50

The Today endpoint selects meaningful visible model updates without a current-day/time-window constraint. On 2026-07-26 it can therefore say “Your model moved in 1 place” for this 47-day-old entry. The Timeline default 30-day window excludes the same entry, while Map's movement preview reuses the Today endpoint and includes it.

The report path disables the movement report because before, after, rationale, and update-specific evidence are not ready. The Today briefing nevertheless counts the update and the movement card falls back to its display title as an evidence line. That is a claimed movement without an inspectable before/after proof.

### Representative pattern and action

Pattern claim `cmp2fyl6v00dkqlsycx1pq53l` is an active developing trigger-condition pattern with three relation-evidence records and one linked surfaced action.

Surfaced action `cmr3jumbz0001qled5acd1kmc` is a current stabilize action linked to that pattern, with `not_started` status and no outcome note. It becomes a Decisions-page row and an Inspector object presented as a decision. It has no Decision record, option set, selected choice, expected outcome, or first-class Outcome record.

### Mandatory Trace 3 — resurfaced receipts

The local primary cohort has zero qualifying `SurfacedEvidencePointer` rows, so there is no genuine current receipt for which source text, origin, timestamp, ownership, linked objects, and click-to-Inspector behavior can all be proved. The honest result is **no qualifying object**, not a substituted sample.

The 12 global local rows cannot repair that absence:

- all are development/test fixture pointers;
- all use `sourceObjectType: pattern_claim`;
- `projectSurfacedEvidencePointerToOrvekObject` presents them as `type: "receipt"`;
- fallback `buildTodaySurfacingCards` also gives pattern/contradiction aggregates a receipt href;
- `buildCanonicalLiveRuntimeData` accepts a resurfaced object with either `sourceText` **or merely a title**;
- Map creates synthetic `map-receipt-*` objects from evidence summaries;
- the Decisions adapter presents a linked pattern claim as `type: "receipt"`.

A pointer with genuine source text can produce a non-empty Inspector object by source construction, but no qualifying primary object was available and no browser click was executed. Therefore the mandatory genuine receipt trace remains unavailable and the receipt slot is incoherent by object meaning.

## Source-to-surface architecture

```text
messages/imports/evidence spans
        │
        ├─ ReferenceItem ─────────────── future AI memory
        ├─ ProfileArtifact ───────────── legacy/dark-engine candidate
        ├─ PatternClaim ──────────────── Today/actions/Explore/Inspector
        ├─ ContradictionNode ─────────── Map/Today/future AI when eligible
        └─ UnifiedEvidenceLink
                  │
          UserMapConclusion ──────────── Map/Inspector/Explore
                  │
          ModelUpdate ledger ─────────── Today/Map preview/Timeline/reports

SurfacedAction ──presented as─────────── Decision + outcome note/status
Evidence pointer/pattern aggregate ───── presented as Receipt
```

The workbench hook, `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`, fetches Today, Map inputs, actions, fieldwork, investigations, Timeline, and Explore independently, then merges their adapters. It is a shared shell aggregator, not a shared semantic projection with a canonical object identity/version/evidence envelope.

## Cross-surface semantic matrix

| Representative object | Today | Map | Decisions | Timeline | Explore | Navigator/Inspector/Reports | Future AI |
|---|---|---|---|---|---|---|---|
| Conclusion `cmq6fr…vzue` | Indirect through movement/hero selection | Current map conclusion; raw and prefixed aliases | Not directly | Indirect through movement | Available to post-response grounding | Inspector can show it; correction writes metadata, not revised truth | Ignored |
| Pattern `cmp2fy…q53l` | Pattern aggregate/card | Map's “Patterns” rail does **not** use `PatternClaim` | Linked surfaced action becomes decision alias | Not canonical history | Pattern context available | Inspector can show actual pattern | Ignored |
| Contradiction | Primary cohort has 25 candidate rows and zero eligible open rows, so none surface | None eligible | None | None | None eligible | Family supported if eligible/selected | Only eligible open contradictions are consumed |
| Movement `cmq6h8…jx1` | Counted and can lead despite no proof | Included through Today preview | No | Excluded by 30-day default | Not an AI input | Raw ID resolves in Inspector; report disabled | Ignored |
| Action `cmr3ju…kmc` | Open-loop/action material | No canonical decision state | Projected as a decision | No first-class decision history | Navigation possible, object handoff absent | Outcome controls disabled honestly until existing capability exists | Not consumed as a decision/outcome |
| Receipt | No genuine qualifying primary-cohort pointer | Synthetic `map-receipt-*` satellites from summaries | No | No | No shared receipt identity | Inspector “receipt” may be a pointer/pattern projection | No first-class receipt consumption |

Identity changes by surface for one movement:

- Today hero: `hero-movement-<ModelUpdate ID>`
- Map rail: `movement-<ModelUpdate ID>`
- Timeline row: `model-<ModelUpdate ID>`
- Inspector/report canonical target: raw `<ModelUpdate ID>`

Bridge code can recover the raw Inspector ID, but independent visible identities and independently built labels remain a semantic-drift risk.

### Required field-by-field representative ledger

Private titles and summaries are not reproduced in this audit. The ledger instead records their exact persisted field/projection source and whether the same field is preserved or independently reconstructed.

| Family | ID and declared/presented type | Title and summary comparison | Status, confidence, update | Evidence comparison | Surfaces, actions, and Inspector result |
|---|---|---|---|---|---|
| Receipt | **No qualifying primary-cohort ID.** No `Receipt` model exists. Global fixture pointers are declared `SurfacedEvidencePointer` and presented as `receipt`. | Pointer title is derived by `buildSurfacedEvidencePointerTitle`; fallback title/summary can instead come from a pattern/contradiction aggregate. There is no one receipt title/summary to compare. | No qualifying runtime status/confidence/update. Global pointers are active/public fixture rows. | Primary cohort: 0 qualifying pointers. Global: 12 pointers, all backed by `PatternClaim`, not raw receipt objects. Supporting/conflicting receipt evidence is therefore unavailable. | Today has no genuine representative to click. Map creates synthetic `map-receipt-*` satellites. A source-level pointer object can open Inspector identity/content, but the required authenticated click was not executed. Mandatory genuine-receipt trace: **unavailable/fail closed**, not replaced with a fixture. |
| `UserMapConclusion` | Raw canonical ID `cmq6frqdx0000ql8h6nkavzue`; declared `usermap_conclusion`; Map rail ID `conclusion-<ID>` and presented type `map-object`; Inspector bridge returns raw ID/type. | Map list/detail use persisted `title` and `summary`. Today does not show the conclusion as the same object; it shows a separate movement's `userFacingSummary`. Timeline likewise operates on movement rows. Private text omitted. | Emerging; medium; version 1; updated `2026-06-09T10:08:13.831Z`; last evidence `2026-06-09T09:27:15.117Z`. | Stored/displayed 50; links are 33 `supports` and 17 `context`; only 45 source rows resolve; no `contradicts` links. | Map selection and Inspector detail are source-wired to the raw conclusion. Correction metadata is writable in Inspector but does not change title/summary/version. Today/Timeline do not preserve it as the same row. Browser click not executed; source/tests show a non-empty Inspector shell. |
| `PatternClaim` | Raw ID `cmp2fyl6v00dkqlsycx1pq53l`; declared `pattern_claim`. Today selection presents it as `map-object`; Decisions linked-claim alias presents the same raw ID as `receipt`; Map “Patterns” rail does not use it. | Persisted `summary` supplies Today selection and the Decisions alias title/sourceText. The Decisions normalization may alter presentation. Map shows a different family's title/summary under “Patterns”. | Active; developing; updated `2026-07-12T19:13:40.357Z`. | 3 `PatternClaimEvidence` rows/source containers; no unified links on this target and no recorded conflicting set. Decisions exposes one linked-claim alias, not three evidence rows. | Today/Decisions aliases bridge Inspector back to `pattern_claim`; the Inspector can load the genuine claim. The same object changes presented type, and no authenticated click was executed. |
| `ContradictionNode` | **No qualifying visible primary-cohort ID.** There are 25 genuine candidate rows, but 0 eligible open contradictions. | No honest visible title/summary exists to compare in the current primary-cohort surfaces. | Candidate rows only; 22 medium and 3 low globally in the local fixture data. No applicable visible last-update comparison was selected. | 28 contradiction-evidence rows globally; no qualifying primary visible object/evidence set. | Today, Map, Explore, and future-AI contradiction injection correctly have no eligible primary representative. Inspector click/actions are not applicable. The audit does not substitute a candidate or fixture for an eligible object. |
| `ModelUpdate` | Raw ID `cmq6h8ewn0000qlbwlg485jx1`; declared `model_update`; Today `hero-movement-<ID>`; Map `movement-<ID>`; Timeline `model-<ID>`; Inspector/report raw ID. | Stored `userFacingSummary` and surface-specific display-title helpers construct title/narrative. Today can use the movement as lead; Map transforms its row title; Timeline maps its event; the strings are not one shared projection. Private text omitted. | User-visible/meaningful; `conclusion_added`; created `2026-06-09T10:08:13.944Z`; confidence is not a movement field and before/after confidence is absent. | 0 update-specific links; affected target has 33 support + 17 context links, 5 of whose source rows are dangling; no conflicting set; no before/after. | Today and Map expose selection/“See why”; Timeline's 30-day query excludes it. Inspector resolves identity but has no transition proof. Report open is disabled honestly. Browser click not executed; source/tests show the common Inspector rather than an empty scaffold, but the movement section is substantively unproved. |
| `SurfacedAction` presented as Decision | Raw ID `cmr3jumbz0001qled5acd1kmc`; declared `SurfacedAction`; Decisions/Inspector presented type `decision` with `inspectorObjectType: reference_decision`. | Action template supplies title; `whySuggested` supplies summary/recommendation. These are deterministic action-presentation fields, not stored Decision options/choice. | `not_started`; confidence unavailable; updated `2026-07-02T13:37:53.039Z`; no outcome note. | `receiptIds` contains linked pattern `cmp2fyl6v00dkqlsycx1pq53l`; the claim has 3 evidence rows. No decision-specific supporting/conflicting evidence set or count exists. | Today may show an action row; Decisions opens the projected decision; Inspector retains full shell and disabled neutral outcome controls for this non-capable state. Talk-through navigates without object handoff. Browser click not executed; source/tests prove no writable outcome control mounts for the partial state. |

The receipt and contradiction rows are deliberately absence records. The brief requires genuine eligible representatives; substituting the 12 pointer fixtures or a candidate contradiction would falsify the trace.

## Receipt and evidence-count reconciliation

There is no first-class `Receipt` model. `EvidenceSpan` and original source records are raw evidence substrate. `SurfacedEvidencePointer` is projected as `type: "receipt"` by `lib/live-evidence-depth-linkage.ts`; Today fallback cards can also present pattern or contradiction aggregates as receipt rows.

| Claim/object | Displayed count or proof | Resolvable proof | Result |
|---|---:|---:|---|
| Primary conclusion `cmq6fr…vzue` | 50 evidence links/count | 45 source objects | Mismatch: overstates resolvable evidence by 5 |
| Primary movement `cmq6h8…jx1` | “moved in 1 place”; fallback evidence line | 0 update-specific evidence links; no before/after | Unbacked movement claim |
| Global surfaced receipts | 12 active/public pointers | 12 point to pattern claims; all local fixture projections | Not proof of a genuine receipt path |
| Map evidence satellites | Synthetic `map-receipt-*` identities | Derived evidence summaries | Projection identity, not a canonical receipt |

These findings independently trigger `WHOLE_PRODUCT_INCOHERENT` under the audit's automatic criteria.

## Claim traceability register

| User-facing claim | Source → canonical/projection trace | Trace result |
|---|---|---|
| “Your model moved in 1 place” | `ModelUpdate` query → Today briefing title | Fails: entry has no before/after, delta, rationale, or update-specific evidence |
| Conclusion has 50 pieces of evidence | `UserMapConclusion.evidenceCount` / 50 unified links → Map/Inspector | Fails exact reconciliation: only 45 source objects resolve |
| Map “Patterns” represent patterns | Map rail classification → `UserMapConclusion` | Fails: the label changes object-family meaning because it does not use `PatternClaim` |
| A Decisions row is a decision | `SurfacedAction` → Decisions adapter `type: "decision"` | Fails canonical-object test: no Decision model/options/selection |
| A recorded action result is an outcome | `SurfacedAction.status` + `note` → outcome control | Durable as action feedback, but not a first-class Outcome or model revision |
| A receipt is inspectable evidence | evidence pointer/pattern fallback → `type: "receipt"` | Fails genuine-receipt trace for the primary cohort |
| Correct the model changes the model | Map React state or Inspector correction metadata | Fails: Map correction is volatile; Inspector does not revise conclusion summary/version |
| Ask in Explore carries the selected object | Inspector button → `setPage("explore")` | Fails object-handoff trace; navigation alone works |
| Capture opens capture | TopBar → `/journal-chat` → shell fallback | Fails: route is swallowed and canonical Today remains visible |

## Action and control register

`WORKING_AND_DURABLE` below is an implementation classification, not a claim that this read-only audit performed the write. The separate proof column makes that boundary explicit.

| Surface and visible action family | Classification | Writer/navigation evidence | Runtime record + refresh proof |
|---|---|---|---|
| Navigator: Today / Your Map / Decisions / Timeline / Explore | `WORKING_NAVIGATION_ONLY` | `updateWorkbenchHistory` plus canonical `RoutePageSync` | Not a write |
| TopBar: Search | `WORKING_NAVIGATION_ONLY` | Opens command palette | Not a write; result navigation not browser-tested |
| TopBar: Capture (`/journal-chat`) | `DEAD` | `OrvekWorkbenchShell` swallows route into canonical fallback/Today | Source/test-proved failure |
| TopBar: Import (`/import`) | `DEAD` | Same non-allowlisted root fallback | Source-proved failure |
| Today: lead title / Now rows / movement rows | `WORKING_NAVIGATION_ONLY` | `select`/`seeWhy` open Inspector selection | Browser click not executed; source/tests only |
| Today: “See why it moved” | `WORKING_NAVIGATION_ONLY` | Selects movement target and movement tab | Browser click not executed; source/tests only |
| Today: current “Open movement report” | `VISIBLE_BUT_DISABLED_HONESTLY` | Report-readiness gate rejects representative movement | No write; disabled state source/runtime-data proved |
| Today: receipt rows | `VISIBLE_BUT_DISABLED_HONESTLY` | Empty slots disable when no qualifying object | No genuine primary receipt existed to click |
| Today: “Add outcome” | `VISIBLE_BUT_MISLEADING` | Selects current lead, which is a `ModelUpdate`; no outcome writer | Source-proved failure |
| Today: “Continue from what changed” / “Add what happened” / “Review outcome” / “Check in on fieldwork” / “Capture new signal” | `VISIBLE_BUT_MISLEADING` | Distinct adapter intent is discarded; every enabled button calls `select(lead.id)` | Source-proved failure |
| Map: rail rows / related rows / “Full receipts & movement in inspector” | `WORKING_NAVIGATION_ONLY` | Local selection plus Inspector `select` | Browser click not executed; source/tests only |
| Map: six “Correct the model” choices | `VISIBLE_BUT_MISLEADING` | `WorkbenchProvider.applyCorrection` changes only React `corrections` state | Source proves no resulting record and refresh loss |
| Decisions: “Talk it through” / “Talk through in Explore” | `WORKING_NAVIGATION_ONLY` | Calls `setPage("explore")` | No decision/draft object handoff; browser not executed |
| Decisions: “Compare options” / entry “Add outcome” | `VISIBLE_BUT_DISABLED_HONESTLY` | Permanently disabled in current production presentation | No write/object identity attached |
| Decisions: “Review due decision” | `WORKING_NAVIGATION_ONLY` when a due action exists; otherwise `VISIBLE_BUT_DISABLED_HONESTLY` | Opens selected surfaced-action projection | No current primary due row; runtime action not executed |
| Decisions: decision rows / context / related receipts / “What this reveals” | `WORKING_NAVIGATION_ONLY` | Selects object/Inspector tab | Browser click not executed; aliases documented above |
| Decisions: detail “Add outcome” | `VISIBLE_BUT_DISABLED_HONESTLY` in current state | Representative action is non-capable and has no live ID on disabled control | No current write capability |
| Decisions: “Generate Decision Review” | `VISIBLE_BUT_DISABLED_HONESTLY` in current state | No canonical report object passes availability | No write |
| Explore: Free / Investigations / Active Questions / Fieldwork Bridge tabs | `WORKING_NAVIGATION_ONLY` | Local tab state | Not a write |
| Explore: grounding chips / movement note / question, investigation, and fieldwork rows / related chips | `WORKING_NAVIGATION_ONLY` | Selects real object or Inspector tab when present | Browser click not executed; source/tests only |
| Explore: composer “Ask” | `WORKING_AND_DURABLE` | `useOrvekExploreChat` sends through `POST /api/message`, which persists messages; live AI path exists | **Not executed**: live-AI and data-write boundaries |
| Explore: quick prompts | `WORKING_NAVIGATION_ONLY` | Prefill/focus the live composer through `onQuickPrompt` | Client interaction not browser-tested |
| Explore Active Questions: “See evidence” | `WORKING_NAVIGATION_ONLY` | Selects question and Evidence tab | Browser click not executed |
| Explore Active Questions: “Explore this” / “Propose fieldwork” / “Mark resolved” | `VISIBLE_BUT_DISABLED_HONESTLY` | Explicit disabled controls | No live object identity/write |
| Explore Investigations: “Add hypothesis” / “Suggest fieldwork” / “Possible report” / “Ask in Explore” | `VISIBLE_BUT_DISABLED_HONESTLY` | Explicit disabled controls | No live object identity/write |
| Explore Fieldwork: “Open fieldwork” / linked-object button | `WORKING_NAVIGATION_ONLY` when objects exist; otherwise `VISIBLE_BUT_DISABLED_HONESTLY` | Selects assignment/related object | Browser click not executed |
| Timeline: filter/search | `WORKING_NAVIGATION_ONLY` | Local presentation filtering | Not a write |
| Timeline: event rows | `WORKING_NAVIGATION_ONLY` | Selects event; opens Movement tab only when before/after exists | Representative movement is absent from 30-day result; no browser click |
| Inspector: Evidence / Model Movement tabs, return, linked/supporting/conflicting/context/related/recent-movement rows | `WORKING_NAVIGATION_ONLY` | `select`, `pushSelection`, `goBack`, and tab state | Browser click not executed; structural tests only |
| Inspector: “Ask in Explore” | `WORKING_NAVIGATION_ONLY` | Calls `setPage("explore")` | Selected object is not handed off |
| Inspector: six “Correct the model” choices for eligible object | `VISIBLE_BUT_MISLEADING` | `DurableCorrectionControls.handleApply` → `applyUserMapCorrection` → conclusion `PATCH` | **Not executed**; source/tests prove durable metadata, not canonical content/version revision |
| Inspector: disabled correction card for non-correctable types | `VISIBLE_BUT_DISABLED_HONESTLY` | Full choices remain disabled and identity-free | No write possible; structural tests passed |
| Inspector: partial/non-capable decision outcome | `VISIBLE_BUT_DISABLED_HONESTLY` | Full geometry remains; `DurableDecisionOutcomeControls` is not mounted | No write possible; structural tests passed |
| Inspector: existing-capability decision outcome | `WORKING_AND_DURABLE` | `DurableDecisionOutcomeControls.handleSubmit` → `submitDecisionOutcome` → action state route | **Not executed**; source/tests only. Result would be `SurfacedAction.status`/`note`, not Outcome/model revision |
| Inspector: fieldwork “Save check-in” | `WORKING_AND_DURABLE` | `DurableFieldworkCheckInControls.handleSubmit` → `submitFieldworkCheckIn` | **Not executed**; source/tests only |
| Inspector/Today/Decisions: report-open controls | `WORKING_NAVIGATION_ONLY` when report-ready; otherwise `VISIBLE_BUT_DISABLED_HONESTLY` | `openReport` only when a canonical report object resolves | Representative movement is disabled; browser not executed |
| Report overlay: “Open in Inspector”, related-object rows, “Close report” | `WORKING_NAVIGATION_ONLY` | Selects raw Inspector object/related object or closes overlay | No ready representative report; browser not executed |

### Today action-intent loss

`lib/orvek-adapters/today.ts` creates distinct intents and destinations. `components/orvek-v0-canonical/live-provider.ts` collapses them to label/icon. `components/orvek-v0-canonical/pages/today.tsx` then makes all five primary buttons select the same lead. “Continue from what changed”, “Add what happened”, “Review outcome”, “Check in on fieldwork”, and “Capture new signal” therefore cease to mean what their labels say.

### Route fallback

`components/orvek-workbench/OrvekWorkbenchShell.tsx` renders the canonical workbench for the known canonical routes **or for any path not approved as a child route**. The only approved child route is `/contradictions/candidates`. `RoutePageSync` maps only `/`, `/your-map`, `/actions`, `/timeline`, and `/explore`; unknown routes retain the initial Today page.

As a result, `/journal-chat` and other non-allowlisted routes are silently swallowed. The repository test for shell routing currently proves this fallback behavior; it does not make the behavior product-correct.

### Hidden write on read

`app/api/actions/route.ts` invokes `syncSurfacedActions` during `GET`. `lib/actions-v1.ts` may create or update `SurfacedAction` records. This violates read semantics and made that endpoint unsuitable for a read-only audit journey.

## Refresh and durability

Durable Inspector outcome, correction-metadata, and fieldwork actions call the shared durable refresh hook. `durableActionsRevision` causes the hybrid workbench data effects to reload Today, actions, fieldwork, conclusions, and related inputs. Source and focused tests support this wiring.

That does not repair semantic durability:

- Map-page correction is React state only and is lost on refresh.
- Inspector correction persists feedback metadata, not a new canonical model version.
- action outcome persists only to `SurfacedAction`, not to Decision/Outcome and not to a canonical conclusion transition.
- Inspector selection itself is not a persistent deep link.

No actual write/refresh cycle was executed during this audit because the brief prohibited database writes. Durable outcomes above are therefore source- and test-backed; they are not a claim that this audit mutated and reloaded local data.

## Defect register

| ID | Severity | Finding | Exact ownership | Automatic incoherence trigger |
|---|---|---|---|---|
| CM-001 | Critical | Multiple overlapping current-truth families have no complete precedence/translation boundary | `lib/orvek-intelligence-object-authority.ts:CANONICAL_CURRENT_TRUTH_OBJECTS`, `canServeAsCanonicalCurrentTruth`; `docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.md` current-truth table | Canonical model fragmented |
| CM-002 | Critical | Movement publication does not mutate or supersede its target | `lib/explore-movement-proposal.ts:publishExploreMovementProposal`; `lib/model-update-candidate-publish-helper.ts:publishModelUpdateCandidate`; `lib/model-movement-snapshot.ts:materializePublishedModelUpdateSnapshots` | Claimed change is not current-state revision |
| CM-003 | Critical | Future AI ignores map conclusions, patterns, movement, investigations, and their unified evidence | `app/api/message/route.ts:POST`, `buildTopContradictionsBlock`; `lib/reference-memory.ts:getRelevantReferenceMemory`; `lib/contradiction-surface.ts:getTop3WithOptionalSurfacing` | Cross-product current truth is not consumed |
| CM-004 | High | Weakening/correction/supersession semantics are inconsistent and largely unexercised | `prisma/schema.prisma:UserMapConclusion`, `PatternClaim`, `ReferenceItem`; `app/api/user-map/conclusions/[id]/route.ts:PATCH`; `lib/durable-user-actions-contract.ts:applyUserMapCorrection` | No reliable revision lifecycle |
| CM-005 | High | Goals, identity, beliefs, patterns, and contradictions have overlapping owners | `lib/reference-memory.ts:getRelevantReferenceMemory`; `lib/profile-derivation.ts:processMessageForProfile`; `lib/today-surface.ts:buildTodaySurfacingCards`; `lib/orvek-adapters/map.ts:buildOntologyRailGroups`; `app/api/message/route.ts:POST` | Cross-surface meaning can change |
| WP-001 | Critical | Today counts and leads with an old model update that has no inspectable movement proof | `lib/today-reentry.ts:pickTodayHeroItem`, `buildTodayBriefingTitle`; `lib/orvek-adapters/today.ts:mapTodayDataToV0Props`; `lib/orvek-v0/production/today-api.ts:buildTodayProductionDataApi` | Unbacked user-facing claim |
| WP-002 | Critical | A visible conclusion says 50 evidence items while only 45 sources resolve | `app/api/user-map/conclusions/route.ts:GET`; `lib/public-intelligence-safe-slice.ts:toUserMapConclusionPublicApiListItem`, `toUserMapConclusionPublicApiDetailItem`; `lib/orvek-v0/production/map-api.ts:railItemToOrvekObject` | Evidence-count mismatch |
| WP-003 | Critical | Today action labels lose their distinct handlers/destinations and all select one lead | `lib/orvek-adapters/today.ts:applyPrimaryActionRouting`, `mapTodayDataToV0Props`; `components/orvek-v0-canonical/live-provider.ts:buildCanonicalLiveRuntimeData`; `components/orvek-v0-canonical/pages/today.tsx:TodayPage` | Dead/misleading actions |
| WP-004 | Critical | Map “Correct the model” confirms an in-memory-only change | `components/orvek-v0-canonical/pages/map.tsx:MapPage`; `components/orvek-v0/store.tsx:WorkbenchProvider` (`applyCorrection` callback) | Correction lost on refresh |
| WP-005 | High | Pattern pointers and aggregate cards are presented as receipts without a first-class receipt object | `lib/live-evidence-depth-linkage.ts:projectSurfacedEvidencePointerToOrvekObject`; `lib/today-surface.ts:buildTodaySurfacingCards`; `lib/orvek-v0/production/map-api.ts:buildMapReceiptSatellites`; `lib/orvek-v0/production/decisions-presentation.ts:buildLinkedClaimAliasObject` | Reference/fixture fallback |
| WP-006 | High | Surfaced actions are presented as Decisions/Outcomes without those canonical objects | `lib/orvek-v0/production/decisions-api.ts:actionToObject`, `buildDecisionsProductionDataApi`; `lib/durable-user-actions-contract.ts:submitDecisionOutcome`; `app/api/actions/[id]/route.ts:PATCH` | Cross-surface meaning change |
| WP-007 | High | When Today has narrative but no hero ID, the provider can silently substitute the first decision as lead | `components/orvek-v0-canonical/live-provider.ts:buildCanonicalLiveRuntimeData` (`leadId`) | Undisclosed fallback |
| WP-008 | Critical | Non-allowlisted root routes, including Capture, silently render the canonical Today fallback | `components/orvek-workbench/OrvekWorkbenchShell.tsx:isApprovedRouteChildPath`, `OrvekWorkbenchShell`; `components/orvek-v0-canonical/workbench.tsx:resolveWorkbenchPageFromPathname`, `RoutePageSync` | Page fallback/dead action |
| WP-009 | High | `GET /api/actions` can mutate surfaced actions | `app/api/actions/route.ts:GET`; `lib/actions-v1.ts:syncSurfacedActions` | Read path changes state |
| WP-010 | High | Independent adapters create surface-specific IDs, labels, counts, and time windows | `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts:useOrvekHybridWorkbenchDataApi`; `lib/orvek-adapters/today.ts:mapTodayDataToV0Props`; `lib/orvek-adapters/map.ts:mapMapDataToV0Props`; `lib/orvek-adapters/timeline.ts:mapTimelineDataToV0Props`; `lib/orvek-v0/production/hybrid-workbench-api.ts:buildHybridWorkbenchDataApi` | Semantic drift |
| WP-011 | Medium | Schema comments and local fixture composition conflict with production authority | `prisma/schema.prisma:CanonicalTodayComposition`; `lib/orvek-v0/production/workbench-authority.ts:allowsCompositionWorkbenchAuthority`, `isCompositionWorkbenchApi` | Authority/configuration drift |
| WP-012 | Medium | Explore navigation discards the selected object's identity/context | `components/orvek-v0-authority/evidence-panel.tsx:ObjectDetail`; `components/orvek-v0-canonical/pages/decisions.tsx:DecisionsPage` | Action does not fulfill label's implied context |

## Root causes

1. **Authority was declared by family, not by semantic concept and version.** Several stores can be “current” without one reconciliation boundary.
2. **Movement was implemented as a publication ledger before atomic model revision.** A history entry can exist independently of an old/current/new state transition.
3. **Each surface adapts backend families independently.** Shared chrome does not guarantee shared object identity, evidence set, copy, time window, or capability.
4. **Presentation aliases filled missing domain objects.** Pattern aggregates became receipts; surfaced actions became decisions and outcomes.
5. **Visible actions were wired after their intent metadata was discarded.** Labels survived while destinations and commands did not.
6. **Fixture/reference fallbacks and route quarantine became runtime behavior.** They hide absent production capability instead of failing truthfully.
7. **Future AI has a separate memory authority.** What the workbench calls the current model is not what generates the next assistant response.

## Salvageability

The product is salvageable without discarding the permanent shell, Navigator, Inspector structure, adapters, evidence-link tables, or movement/report presentation components.

Useful foundations include:

- real stored evidence and explicit link tables;
- bounded object-family lifecycle fields;
- durable action-feedback and fieldwork writers;
- safe capability gating in the Inspector;
- report-readiness gates that correctly reject the current unproved movement;
- a central desktop shell with stable page geometry;
- a declared authority module that already distinguishes current truth, pattern intelligence, legacy input, history, and future objects.

The missing work is an integration and authority correction, not a visual rewrite.

| Disposition | Existing parts |
|---|---|
| Reuse unchanged | Permanent shell/Navigator/Inspector geometry; evidence-link substrate; safe disabled-control geometry; report-readiness gate; durable action-feedback and fieldwork writers |
| Reconnect | One canonical revision command to evidence/review/current state/history; shared projection to Today/Map/Decisions/Timeline/Explore/Inspector/Reports/future AI; existing durable controls to canonical consequences; intended Today and Explore action context |
| Replace/remove | Receipt and Decision/Outcome presentation aliases; first-Decision lead fallback; route swallowing for intended child routes; in-memory Map correction confirmation; movement publication that does not change its target; writes hidden inside action `GET` |
| First repair | Implement `CONCEPT_KEY_AUTHORITY_REGISTRY` and its atomic revision transaction before changing any page-specific presentation |

## Smallest correct integration sequence

**Controlling architecture decision: `CONCEPT_KEY_AUTHORITY_REGISTRY`.**

Current model authority belongs to a semantic concept key and version, not directly to an object family. Every concept must have exactly one current revision. `UserMapConclusion`, `PatternClaim`, `ContradictionNode`, `ReferenceItem`, and `ProfileArtifact` remain specialised evidence, interpretation, proposal, or process objects; none may independently own competing current truth.

1. **Establish the concept-key authority registry.** Define one stable semantic concept key, one current revision pointer, explicit version history, and specialised family roles for every governed concept. Remove every path that lets `UserMapConclusion`, `PatternClaim`, `ContradictionNode`, `ReferenceItem`, or `ProfileArtifact` independently claim current authority.
2. **Implement one atomic revision command.** Lock the current concept revision; validate the reviewer/user decision; preserve the old revision; create the new current revision; attach only resolved user-owned evidence; record before/after/confidence/rationale; and create `ModelUpdate` in the same transaction. Reject the transaction when ownership, evidence resolution, or transition proof fails.
3. **Publish one canonical revision envelope.** Today, Map, Timeline, Inspector, Reports, Explore, and future AI must consume the same concept key, canonical revision ID, version, status, confidence, resolved evidence set, rationale, and capabilities. Count only resolvable evidence and inspectable movement.
4. **Reconnect real capabilities and remove domain aliases.** Preserve Today destinations/commands; route Map correction through the atomic revision command; carry selected-object context into Explore; allow intended Capture/child routes; and make action reads read-only. Decision and Outcome remain unimplemented first-class objects and must not be aliased from `SurfacedAction`; present those records truthfully as surfaced actions until the domain objects exist.
5. **Repair integrity and execute the acceptance journey.** Remove or quarantine dangling/cross-owner fixture links, rebuild counts from resolved evidence, backfill only provable before/after movement, and then run the exact authenticated browser trace below.

Do not start with page-specific copy or another presentation-only fallback. The first correction must be the model transition and shared authority boundary.

## Required browser acceptance journey

This journey was specified but not executed because no server/authenticated session was available and the audit prohibited state changes.

1. Start with a test account containing one resolvable raw evidence item and no competing fixture records.
2. Capture/import the evidence and record its immutable source identity.
3. Generate a proposed interpretation; verify it is visibly proposed and absent from current-model/future-AI projections.
4. Accept/publish through the atomic revision command.
5. Verify one old/current/new version chain, one `ModelUpdate`, exact before/after/confidence/rationale, and only resolved evidence links.
6. Open Today, Map, Decisions, Timeline, Explore, Navigator, Inspector, and Reports.
7. Verify the same canonical ID/version, semantic title, evidence count, status, confidence, and movement meaning on every surface.
8. Verify Today and Timeline use an explicit consistent time-window policy and that an unproved update is not counted.
9. Follow every visible action: Continue, Add what happened, Review outcome, Fieldwork check-in, Capture, Ask in Explore, Correct the model, and Open report. Confirm each reaches its named capability with the selected object context.
10. Refresh after every durable write and re-open through a canonical URL. Confirm the state and evidence remain identical.
11. Generate a new AI response and inspect the grounding receipt. Confirm it consumed the accepted canonical version and did not consume the rejected proposal or superseded version.
12. Weaken/correct the conclusion. Confirm a new atomic revision, preserved history, updated future-AI input, and consistent cross-surface projection.
13. Attempt a partial/non-capable Decision object. Confirm full Inspector geometry remains disabled and no write is possible.
14. Attempt unresolved, cross-owner, or missing evidence. Confirm publication/counting/reporting fails closed.

## Validation performed

Focused deterministic tests:

```text
npx vitest run \
  lib/__tests__/inspector-permanent-shell-regression.test.tsx \
  lib/__tests__/durable-user-actions-contract.test.ts \
  lib/__tests__/today-production-api.test.ts \
  lib/__tests__/orvek-workbench-shell-route-allowlist.test.tsx \
  lib/__tests__/explore-movement-semantic-restoration.test.ts

5 test files passed
51 tests passed
Duration: 3.56s
```

These tests support the documented implementation behavior. In particular, they validate the permanent Inspector shell and current route fallback; they do not establish whole-product truth coherence.

The paired JSON audit was validated with `jq`, and both artifacts were checked with `git diff --check`.

## Final answers

1. **What exactly is Orvek's current model?** There is no singular current model. The declared runtime authority is a federation of current `UserMapConclusion`, eligible `ContradictionNode`, and active `ReferenceItem`, with overlapping `PatternClaim` and `ProfileArtifact` interpretations.
2. **Where is it stored?** Across the corresponding PostgreSQL tables plus `UnderstandingEvidenceLink`; `ModelUpdate` is a separate history table, not the current state.
3. **Which object owns each kind of understanding?** No complete ownership map is implemented. Goals, values, identity/beliefs, patterns, contradictions, uncertainty, and open questions overlap as recorded above; Decision and Outcome do not exist as first-class objects.
4. **How does evidence change it?** Family-specific candidate/link/publish paths create and annotate records. There is no one evidence → review → atomic old/current/new revision transaction.
5. **Does `ModelUpdate` actually mutate it?** No.
6. **Do all pages consume the same state?** No; they use independent adapters, aliases, counts, and time windows.
7. **Does future AI consume the changed state?** No; it does not receive `UserMapConclusion` or `ModelUpdate`.
8. **Can the model weaken and correct itself?** Family fields and partial controls exist, but a complete downward/superseding canonical revision was not proved.
9. **Are the permanent shell and Inspector restoration themselves rejected?** No; their presentation structure remains accepted.
10. **Canonical-model verdict:** `CANONICAL_MODEL_FRAGMENTED`.
11. **Whole-product verdict:** `WHOLE_PRODUCT_INCOHERENT`.
