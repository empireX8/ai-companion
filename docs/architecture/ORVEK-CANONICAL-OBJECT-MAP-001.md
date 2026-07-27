# ORVEK CANONICAL OBJECT MAP 001

**Status:** Planning authority for vocabulary and object classification  
**Scope:** Orvek intelligence, evidence, model, process, history, and presentation objects  
**Does not do:** Change the schema, migrate data, change runtime behaviour, or declare the product coherent  
**Controlling product frame:** Orvek is an evidence-backed private intelligence system. It is not a chatbot, journal, mood tracker, or generic productivity system.

---

## 1. Why this document exists

The word **object** currently means too many different things in Orvek.

It can mean:

- a real row saved in the database;
- a piece of evidence;
- an interpretation about the user;
- an accepted part of the user model;
- a proposal waiting for review;
- a record that something changed;
- a card shown on a page;
- or a shared TypeScript display shape.

Those are not the same thing.

This document gives each kind of thing one plain-English meaning and states whether it is allowed to represent Orvek's current understanding.

The core rule is:

> Do not use the word **object** by itself when a more precise word is available.

Use **evidence record**, **memory record**, **interpretation**, **concept**, **revision**, **process record**, **movement record**, **projection**, or **screen card**.

---

## 2. The seven layers

### Layer A — Source evidence

Something the user said, wrote, selected, imported, or experienced.

Evidence can support or contradict an interpretation. Evidence is not automatically true forever, and it is not automatically Orvek's current conclusion.

### Layer B — Explicit memory

Something the user has directly asked Orvek to remember or has explicitly accepted as stable context, such as a preference, goal, constraint, or rule.

Explicit memory is stronger than a machine guess, but it still needs correction and supersession rules.

### Layer C — Derived intelligence

An interpretation produced from evidence: a pattern, contradiction, profile hypothesis, forecast, or conclusion.

Derived intelligence may be useful without being accepted as current truth.

### Layer D — Canonical current model

Orvek's one governed current understanding of a particular semantic concept.

This layer does **not yet exist cleanly** in the current runtime. It is the missing authority layer identified by the whole-product audit.

The intended future shape is:

```text
Canonical concept
  -> exactly one current revision
  -> zero or more previous revisions
  -> evidence and source bindings
  -> movement history between revisions
```

### Layer E — Work in progress

Investigations, proposals, fieldwork, experiments, actions, and review states.

These records describe work being done. Their existence does not prove an interpretation is true.

### Layer F — History and audit

Immutable records of what changed, when, why, and from which revision to which revision.

History proves a transition occurred. History is not itself the current model.

### Layer G — Presentation

Cards, reports, Today composition, Timeline events, Inspector views, and other screen representations.

Presentation displays information from the other layers. It must never become a competing truth store.

---

## 3. Words we will use from now on

| Term | Plain-English meaning | Saved in the database? | May own current truth? |
|---|---|---:|---:|
| **Stored record** | Any real persisted database row | Yes | Depends on its role |
| **Evidence record** | A stored account of what happened or what the user said | Yes | No |
| **Memory record** | Explicit user-provided context intended to persist | Yes | Not independently after the canonical model exists |
| **Interpretation** | A derived claim about what evidence means | Usually | No, unless accepted as a canonical revision |
| **Semantic concept** | The stable topic being understood, such as “conflict avoidance at work” | Proposed, not implemented | Owns identity, not wording |
| **Concept key** | Stable identifier for one semantic concept | Proposed, not implemented | Identifies the concept |
| **Revision** | One immutable version of Orvek's understanding of a concept | Proposed, not implemented | Exactly one revision is current |
| **Proposal** | A possible change waiting for review | Yes | No |
| **Process record** | An investigation, fieldwork task, action, or experiment | Yes | No |
| **Movement record** | An immutable record that one revision changed into another | Yes, currently `ModelUpdate` | No |
| **Projection** | A derived representation for a page, report, forecast, or screen | Sometimes | No |
| **Screen card** | A visual container rendered in the workbench | No, not by itself | No |
| **Receipt** | User-facing evidence presentation | Sometimes a projection over real evidence | No |

---

## 4. The proposed canonical authority objects

These do not exist yet. Their exact Prisma names may change during implementation design, but their responsibilities must not be combined or lost.

### 4.1 Canonical concept

**Plain English:** The stable identity of one thing Orvek is trying to understand.

Example:

```text
work-conflict-avoidance
```

The concept stays the same even when Orvek's understanding changes.

**Must contain or resolve:**

- user ownership;
- stable concept key;
- concept type or domain;
- current revision pointer;
- lifecycle state;
- creation and update timestamps.

**May own current truth?** It owns the pointer to current truth. It does not contain the changeable wording itself.

### 4.2 Canonical concept revision

**Plain English:** One immutable version of Orvek's understanding of that concept.

Example:

```text
Revision 1: You tend to avoid conflict at work.
Revision 2: You avoid conflict mainly when authority and belonging feel at risk.
```

**Must contain or resolve:**

- concept identity;
- version number;
- meaning or summary;
- status;
- confidence;
- rationale;
- previous revision;
- exact supporting and contradicting evidence;
- review or user decision that allowed publication.

**May own current truth?** Yes. Exactly one revision per concept may be current.

### 4.3 Canonical source binding

**Plain English:** A durable statement that an existing record is about a particular concept.

Examples:

- a `PatternClaim` is evidence or interpretation related to the concept;
- a `ContradictionNode` describes a conflict related to the concept;
- a `ReferenceItem` contains explicit user memory related to the concept;
- a `UserMapConclusion` is a legacy/current interpretation related to the concept.

**May own current truth?** No. It connects existing records to the concept without allowing those records to compete for authority.

---

## 5. Current stored intelligence inventory

### 5.1 Evidence and source records

#### Session

**What it is:** A conversation container.  
**Layer:** Source evidence.  
**Current truth:** No.  
**Future role:** Provides context and lineage for messages.

#### Message

**What it is:** One user, assistant, or system message inside a session.  
**Layer:** Source evidence.  
**Current truth:** No.  
**Important rule:** A user message may support a claim. An assistant message may provide context but must not prove the assistant's own claim.

#### JournalEntry

**What it is:** User-authored journal text.  
**Layer:** Source evidence.  
**Current truth:** No.  
**Future role:** Evidence source that can support or contradict concepts.

#### QuickCheckIn

**What it is:** A short user state report, including tags and an optional note.  
**Layer:** Source evidence.  
**Current truth:** No.  
**Future role:** Time-specific evidence, not a lasting identity claim.

#### ImportUploadSession

**What it is:** A record of an imported data batch.  
**Layer:** Processing and source provenance.  
**Current truth:** No.

#### ImportUploadChunk

**What it is:** A temporary piece of an upload.  
**Layer:** Infrastructure.  
**Current truth:** No.  
**User-facing intelligence object:** No.

#### EvidenceSpan

**What it is:** An exact character range inside a message, with a content hash.  
**Layer:** Source evidence.  
**Current truth:** No.  
**Future role:** Precise quote-level provenance.

#### PatternClaimEvidence

**What it is:** Evidence attached to a `PatternClaim`.  
**Layer:** Source evidence.  
**Current truth:** No.  
**Important distinction:** The evidence supports the pattern; it is not the pattern itself.

#### ContradictionEvidence

**What it is:** Evidence attached to a `ContradictionNode`.  
**Layer:** Source evidence.  
**Current truth:** No.

#### UnderstandingEvidenceLink

**What it is:** A typed relationship saying one stored source supports, contradicts, contextualises, seeds, corrects, or otherwise relates to a target.  
**Layer:** Provenance connection.  
**Current truth:** No.  
**Important distinction:** It is an edge between records, not evidence content by itself.  
**Future repair:** It must be able to point to the exact canonical revision or movement it supports.

#### ArtifactEvidenceLink

**What it is:** A connection between a derivation artifact and an evidence span.  
**Layer:** Internal provenance.  
**Current truth:** No.

#### ProfileArtifactEvidenceLink

**What it is:** A connection between a profile artifact and an evidence span.  
**Layer:** Internal provenance.  
**Current truth:** No.

---

### 5.2 Explicit memory

#### ReferenceItem

**What it is:** Explicit or governed memory, currently covering constraints, patterns, goals, preferences, assumptions, hypotheses, rules, and sources.  
**Layer:** Explicit memory.  
**Current truth today:** Sometimes. This is part of the fragmentation problem.  
**Future role:** A source bound to a canonical concept. It may strongly influence a revision when explicitly user-provided or accepted, but it must not independently compete with the canonical revision.  
**Overlap:** `ProfileArtifact`, `PatternClaim`, `UserMapConclusion`, and `ContradictionNode` can describe similar meanings.

---

### 5.3 Derived intelligence

#### DerivationRun

**What it is:** A record that an internal processor analysed a set of messages.  
**Layer:** Internal processing.  
**Current truth:** No.

#### DerivationArtifact

**What it is:** A candidate output produced by a derivation run.  
**Layer:** Internal candidate or translation input.  
**Current truth:** No.  
**Future role:** May supply a proposal or evidence-linked interpretation, but cannot silently become accepted truth.

#### ArtifactPromotionLink

**What it is:** A record that a derivation artifact was promoted into another entity.  
**Layer:** Internal provenance and process history.  
**Current truth:** No.

#### ProfileArtifact

**What it is:** A derived profile claim in one of several broad categories such as belief, value, goal, fear, identity, trait, habit, topic, or pattern.  
**Layer:** Derived candidate or legacy translation input.  
**Current truth today:** It can look like truth in some code paths, but it must not outrank governed model authority.  
**Future role:** Candidate interpretation or evidence source bound to a concept.  
**Overlap:** Heavy overlap with `ReferenceItem`, `PatternClaim`, and `UserMapConclusion`.

#### PatternClaim

**What it is:** A derived claim that a recurring pattern exists.  
**Layer:** Derived pattern intelligence.  
**Current truth today:** Not supposed to be the whole model, but it can be presented as if it is authoritative.  
**Future role:** Specialised interpretation bound to one or more canonical concepts.  
**Important distinction:** The five pattern families are categories of `PatternClaim`; they are not five different object types.

#### ContradictionNode

**What it is:** A stored tension or conflict between two sides, backed by evidence.  
**Layer:** Specialised conflict intelligence.  
**Current truth today:** Sometimes treated as independent current truth. That is part of the authority overlap.  
**Future role:** A specialised conflict record bound to the relevant canonical concepts. It may influence revisions but must not independently own a competing version of the user's model.

#### UserMapConclusion

**What it is:** A stored conclusion about the user, with area, status, confidence, evidence counts, version fields, and supersession fields.  
**Layer:** Current interpretation under the existing architecture.  
**Current truth today:** Yes, in some routes and surfaces.  
**Problem:** It is not the sole authority, its revisions are not consistently created, and some routes update it in place.  
**Future role:** It must either become part of the canonical revision implementation or be bound and translated into it. The implementation design must choose one path; it may not remain a parallel authority.

#### Projection

**What it is:** A stored forecast containing a premise, drivers, possible outcomes, confidence, and later resolution.  
**Layer:** Predictive interpretation.  
**Current truth:** No.  
**Future role:** A forecast related to canonical concepts, with outcome evidence recorded separately.  
**Important distinction:** This database `Projection` is not the same as a generic UI projection.

---

### 5.4 Work in progress and action records

#### Investigation

**What it is:** An open organising question with competing theories and evidence still needed.  
**Layer:** Work in progress.  
**Current truth:** No.  
**Important rule:** An investigation records uncertainty; its existence cannot be presented as a conclusion.

#### FieldworkAssignment

**What it is:** A request to observe or test something in real life.  
**Layer:** Work in progress.  
**Current truth:** No.  
**Future role:** Generates observations that may become evidence.

#### ExploreMovementProposal

**What it is:** A proposed change to the model waiting for explicit publication or rejection.  
**Layer:** Proposal.  
**Current truth:** No.  
**Important rule:** A proposal must not appear as completed model movement.

#### PatternClaimAction

**What it is:** A small experiment attached to a pattern claim, with an optional outcome signal and reflection.  
**Layer:** Action and observation process.  
**Current truth:** No.  
**Overlap:** Can be confused with `SurfacedAction`, future `Decision`, future `Outcome`, and `FieldworkAssignment`.

#### SurfacedAction

**What it is:** A persisted action shown to the user, currently using stabilise/build buckets and simple outcome states.  
**Layer:** Action projection.  
**Current truth:** No.  
**Important rule:** It is not a first-class Decision and its note/status is not a first-class Outcome.

#### Decision

**What it is:** Reserved future object.  
**Exists today:** No first-class persisted Decision object.  
**Current truth:** No.  
**Important rule:** A `SurfacedAction` must not be relabelled as a Decision.

#### Outcome

**What it is:** Reserved future durable record of what actually happened after a decision, action, fieldwork task, or forecast.  
**Exists today:** No general first-class persisted Outcome object.  
**Current truth:** No.  
**Important rule:** An action status or note must not be relabelled as a complete Outcome object.

---

### 5.5 Movement, reports, and audit history

#### ModelUpdate

**What it is:** A record claiming that some model-related change occurred, including before/after summaries.  
**Layer:** Movement history.  
**Current truth:** No.  
**Current defect:** Publication can create and expose `ModelUpdate` without creating a real new current model revision.  
**Future role:** It must point to an exact previous revision and resulting revision created in the same transaction.

#### WeeklyAudit

**What it is:** A weekly snapshot of counts and derived metrics.  
**Layer:** Analytics and audit summary.  
**Current truth:** No.  
**Future role:** May report on the model, but cannot define it.

#### CanonicalModelMovementReport

**What it is:** A stored report composition that references movement and receipt IDs.  
**Layer:** Presentation/report.  
**Current truth:** No.  
**Important rule:** A report explains movement; it does not create movement.

---

### 5.6 Presentation and surfacing records

#### SurfacedEvidencePointer

**What it is:** A persisted instruction to show a specific evidence source in Today.  
**Layer:** Presentation.  
**Current truth:** No.  
**Important distinction:** It points to evidence; it is not the evidence itself.

#### EvidencePointerSurfacingRationale

**What it is:** Stored copy explaining why an evidence pointer should be shown.  
**Layer:** Presentation rationale.  
**Current truth:** No.

#### CanonicalTodayComposition

**What it is:** A stored ordered Today layout payload.  
**Layer:** Presentation composition.  
**Current truth:** No.  
**Important rule:** It may control placement, but it may not invent or override semantic truth.

#### OrvekObject

**What it is:** A shared TypeScript shape used to render many different things in the workbench.  
**Saved in the database:** No, not by itself.  
**Layer:** Presentation envelope.  
**Current truth:** Never.  
**Problem:** Its broad `type` values can make unrelated stored records look like the same kind of thing.

The current UI types are:

- `receipt`
- `decision`
- `report`
- `fieldwork`
- `map-object`
- `timeline-event`
- `investigation`
- `context`
- `model-goal`
- `model-update`
- `active-question`

These are **screen types**, not a canonical domain ontology.

A `map-object`, for example, may represent a `PatternClaim`, `UserMapConclusion`, `ContradictionNode`, goal-like `ReferenceItem`, or another projection. Therefore `map-object` does not tell us what the underlying thing actually is.

---

### 5.7 Operational infrastructure

#### InternalMetricEvent

**What it is:** Telemetry about system behaviour.  
**Layer:** Operations.  
**Current truth:** No.  
**User-facing intelligence object:** No.

#### Category, Companion, UserSubscription, StripeEvent

**What they are:** Product configuration, legacy companion data, billing, and payment infrastructure.  
**Layer:** Application infrastructure.  
**Current truth:** No.  
**Scope of this object map:** Excluded from the intelligence model.

---

## 6. The five pattern families

The five families are categories inside `PatternClaim`.

### trigger_condition

**Meaning:** When a particular condition occurs, a recurring response tends to follow.

Example:

```text
When feedback is vague, you tend to assume the worst.
```

### inner_critic

**Meaning:** A recurring self-critical rule, judgement, or internal voice.

Example:

```text
You treat needing help as evidence that you are failing.
```

### repetitive_loop

**Meaning:** A sequence of reactions, choices, and outcomes that repeats.

Example:

```text
You overcommit, become overloaded, withdraw, recover, and then overcommit again.
```

### contradiction_drift

**Meaning:** A recurring gap or tension between two beliefs, intentions, needs, or behaviours.

Example:

```text
You say autonomy matters, but repeatedly accept arrangements that remove it.
```

### recovery_stabilizer

**Meaning:** A recurring condition or action that helps the user regain stability or clarity.

Example:

```text
Writing the decision down before discussing it helps you hold your position.
```

**Important:** `contradiction_drift` and `ContradictionNode` are not the same thing.

- `contradiction_drift` is a category of recurring pattern.
- `ContradictionNode` is a specific stored conflict with two sides and evidence.

They may refer to the same semantic concept, which is why both need concept bindings instead of competing authority.

---

## 7. User-map areas are categories, not object types

A `UserMapConclusion` may currently be assigned to one of these areas:

- `operating_logic` — recurring rules used to make choices or interpret situations;
- `state_ecology` — conditions affecting emotional, cognitive, or physical state;
- `tension_architecture` — important conflicts and competing needs;
- `recovery_architecture` — how stability and capacity are restored;
- `meaning_system` — values, significance, and personal interpretation;
- `relational_field` — recurring patterns involving other people;
- `developmental_vector` — direction of longer-term change or growth;
- `current_frontier` — the most active unresolved edge of understanding.

These labels organise conclusions. They do not create eight separate domain object types.

---

## 8. The most important collisions

| Ambiguous word or pair | What is actually happening | Required rule |
|---|---|---|
| **Object** | Used for rows, concepts, and screen cards | Always use a more precise term |
| **Receipt vs evidence** | A receipt may be a screen projection over evidence | Preserve the real evidence identity underneath |
| **PatternClaim vs ProfileArtifact** | Both may describe repeated behaviour | Bind both to concepts; neither independently owns current truth |
| **PatternClaim vs UserMapConclusion** | A pattern can be shown as a conclusion | A canonical revision decides accepted meaning |
| **contradiction_drift vs ContradictionNode** | Similar wording, different level and structure | Category and stored conflict remain distinct but concept-bound |
| **ReferenceItem vs UserMapConclusion** | Explicit memory and inferred conclusion may overlap | Preserve source distinction; canonical revision resolves authority |
| **ModelUpdate vs model change** | A ledger row may exist without a real new state | Movement must be created with the new revision atomically |
| **SurfacedAction vs Decision** | Action projection is labelled like a decision | Do not call it Decision until a first-class Decision exists |
| **Action note vs Outcome** | A note/status is treated as a full outcome | Do not call it Outcome until a durable Outcome contract exists |
| **Projection database row vs UI projection** | Same word refers to forecast and generic display | Use **forecast projection** and **screen projection** |
| **Report vs truth** | Reports summarise data and may appear authoritative | Reports consume canonical data; they never define it |
| **Map object** | One card shape represents several real types | Always retain underlying source type and ID |

---

## 9. What may represent current understanding after the repair

After the concept authority system is implemented:

| Record | May independently own current understanding? |
|---|---:|
| Canonical concept revision | **Yes — exactly one per concept** |
| Canonical concept | Owns the current-revision pointer only |
| ReferenceItem | No |
| ProfileArtifact | No |
| PatternClaim | No |
| ContradictionNode | No |
| UserMapConclusion | No parallel authority; must become or bind into canonical revision architecture |
| Investigation | No |
| FieldworkAssignment | No |
| ExploreMovementProposal | No |
| SurfacedAction | No |
| ModelUpdate | No |
| Report or Today composition | No |
| OrvekObject or screen card | No |

---

## 10. Required end-to-end identity rule

The same real semantic concept must retain the same concept identity everywhere.

```text
Evidence
  -> interpretation or proposal
  -> canonical concept revision
  -> Today
  -> Map
  -> Timeline
  -> Inspector
  -> Report
  -> future AI context
```

Each surface may display different fields, but it must resolve to:

- the same concept key;
- the same current revision ID;
- the same version;
- the same meaning;
- the same status and confidence;
- the same resolved evidence set;
- the same movement history.

A card disappearing, changing identity, changing evidence count without reason, or reconstructing a different meaning is a defect.

---

## 11. Implementation consequences

This object map creates the following non-negotiable requirements for the implementation design:

1. Establish stable semantic concept identity.
2. Establish exactly one current revision for each concept.
3. Preserve all previous revisions.
4. Bind existing specialised records to concepts without merging their distinct meanings.
5. Create revisions, evidence links, current-pointer movement, and `ModelUpdate` atomically.
6. Make `ModelUpdate` identify exact before and after revisions.
7. Make all production surfaces consume one canonical revision envelope.
8. Preserve underlying source type and ID through every screen projection.
9. Prevent screen types such as `map-object`, `receipt`, or `decision` from being treated as domain authority.
10. Add explicit first-class Decision and Outcome objects only in a later authorised slice.

---

## 12. What this document does not decide

This map intentionally does not yet decide:

- the final Prisma model names;
- whether `UserMapConclusion` is migrated into revisions or retained as a bound legacy/specialised record;
- the final concept taxonomy;
- automatic concept matching or merging;
- bulk backfill rules;
- AI prompt integration details;
- page-by-page adapter changes;
- Decision and Outcome schemas;
- production activation.

Those decisions belong in the bounded implementation design and must be tested against real existing data.

---

## 13. First implementation slice enabled by this map

The smallest safe first slice remains:

```text
One accepted Explore movement proposal
  -> one existing UserMapConclusion
  -> one stable semantic concept
  -> revision 1 representing the existing state
  -> revision 2 representing the accepted change
  -> exact evidence links
  -> one ModelUpdate proving revision 1 -> revision 2
  -> one current-revision pointer
```

No page rewiring and no broad migration should occur until that transaction is proven to be atomic, idempotent, ownership-safe, evidence-backed, and refresh-stable.
