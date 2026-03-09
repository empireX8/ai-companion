# Cognitive Architecture — Pass 1: Core Ontology

**Date:** 2026-03-07
**Scope:** Core entity definitions, relations, lifecycle states, governance rules, and terminology.
**Purpose:** Establish a shared conceptual foundation before further feature development. This is a design document, not an implementation spec.

---

## 1. Core Entities

---

### Memory

#### What it is
A persistent, user-relevant cognitive artifact — a stable belief, goal, constraint, preference, or pattern that has been extracted or captured from the user's conversational history and is deemed worth retaining across sessions.

#### What it is for
Grounding the assistant's responses with what is actually known about the user. Memory makes the system less stateless. It is the primary input for tension detection and context enrichment.

#### What it is not
- Not the conversation transcript or chat history. Those are transient.
- Not raw evidence or a quoted text span. A memory is a synthesized, assertable claim.
- Not a source. A source is an external reference object; a memory is an internal cognitive claim.
- Not necessarily true. Memories are claims with a confidence level, not facts.

#### Minimal attributes
- `type` — the kind of claim (goal, constraint, preference, pattern, belief, …)
- `statement` — the assertable claim, in plain language
- `confidence` — low / medium / high
- `status` — lifecycle state (see §4)
- `sourceSessionId` / `sourceMessageId` — where it was extracted from
- `supersedesId` — if this memory replaced an earlier version

#### Implementation note
Currently implemented as `ReferenceItem` in the DB. The name "Reference" was a prior design choice; the intended conceptual role is **Memory** (structured, assertable cognitive claims about the user).

---

### Source

#### What it is
An external grounding object — a URL, document, article, or imported resource that the user has pointed at as relevant context. Sources live outside the system and are linked in for reference.

#### What it is for
Grounding memories, evidence, and forecasts in external material that the user considers authoritative or relevant. A source gives external backing to an assertion.

#### What it is not
- Not a memory. A source is external; a memory is an internal claim.
- Not evidence by itself. Evidence is derived from or located within a source; the source is the container.
- Not a message or session. Import archives produce sessions and messages; individual sources are discrete external objects.

#### Minimal attributes
- `url` — the canonical external location
- `title` — human-readable label
- `status` — candidate / active / inactive
- `addedAt` — when the user linked it

#### Implementation note
Sources are not yet a first-class DB model. Currently some references in `ReferenceItem` function as sources (via the `/api/reference/from-url` endpoint), but the conceptual separation between **Memory** (internal cognitive claim) and **Source** (external grounding object) is not yet enforced. This needs clarification in a future pass.

---

### Evidence

#### What it is
A located, citable piece of a conversation or source that supports a specific claim. Evidence is always traceable: it has a position in a message or source, not just a paraphrase.

#### What it is for
Grounding claims. Evidence supports memories, tensions, and forecasts. Without evidence, a claim is an assertion; with evidence, it has an anchor.

#### What it is not
- Not any arbitrary text snippet. Evidence must support a specific claim.
- Not a memory. Evidence is the raw support material; memory is the synthesized claim.
- Not a source. A source is where you look; evidence is what you find there.
- Not automatically the same as a quote captured in chat. A captured quote becomes evidence only when it is linked to a specific claim.

#### Minimal attributes
- `messageId` — the message this evidence comes from
- `charStart` / `charEnd` — exact character position in the message
- `contentHash` — for deduplication
- `linkedClaims` — what memory / tension / forecast this supports

#### Implementation note
Currently implemented as `EvidenceSpan` (linked to `DerivationArtifact` or `ProfileArtifact`) and as `ContradictionEvidence` (a simpler evidence record attached directly to a `ContradictionNode`). These two evidence mechanisms are not yet unified.

---

### Tension

#### What it is
A structured, tracked record of an unresolved inconsistency, conflict, or friction detected in the user's cognitive system. A tension exists between two positions (Side A and Side B) that cannot both be true or both be acted on without acknowledgment.

#### What it is for
Making cognitive inconsistencies visible and manageable. A tension is not just a disagreement — it is a persistent structural conflict that benefits from tracking, escalation, and eventual resolution.

#### What it is not
- Not a simple disagreement or momentary contradiction in a single message.
- Not automatically resolved by a generated response. Responding to a tension does not close it.
- Not a belief. A tension is a relationship between two claims, not a claim itself.
- Not evidence. Evidence supports one side of a tension; the tension is the conflict structure.

#### Minimal attributes
- `title` — short human-readable label
- `sideA` / `sideB` — the two conflicting positions
- `type` — the kind of conflict (goal_behavior_gap, value_conflict, constraint_conflict, belief_conflict, pattern_loop, narrative_conflict)
- `status` — lifecycle state (see §4)
- `confidence` — how confident the system is that this is a real tension
- `weight` — salience score used for surfacing priority
- `escalationLevel` — how much the tension has been pressed
- `evidence` — attached evidence records
- `linkedMemories` — memory items on either side

---

### Forecast

#### What it is
A structured, revisitable forward-looking expectation. A forecast asserts that, given a stated premise and identifiable drivers, certain outcomes are probable within the user's context.

#### What it is for
Making implicit expectations explicit and traceable. Forecasts are meant to be falsifiable — they should be revisited and either confirmed, revised, or marked failed based on what happens.

#### What it is not
- Not a plan. A plan prescribes actions; a forecast predicts outcomes.
- Not casual speculation. A forecast must have a stated premise and at least one identifiable driver.
- Not a memory. A memory is about what is; a forecast is about what is expected to be.
- Not permanently open. Forecasts have an intended lifecycle and should be marked confirmed, failed, or superseded over time.

#### Minimal attributes
- `premise` — the situation being projected from
- `drivers` — the forces expected to shape the outcome
- `outcomes` — the expected results
- `confidence` — probability estimate (0–1)
- `status` — lifecycle state (see §4)
- `sourceSessionId` / `sourceMessageId` — where it was captured from

#### Implementation note
Currently implemented as `Projection` in the DB. The name "Projection" is the internal term; "Forecast" is the user-facing label. The DB model currently has no lifecycle state field — this is a gap to address.

---

### Review

#### What it is
A periodic reflective snapshot of the user's cognitive system state at a given point in time. A review captures key metrics — active memories, open tensions, stability — and can be locked to make it immutable for historical reference.

#### What it is for
Giving the user and the system a time-stamped picture of cognitive health. Reviews support trend analysis, regression detection, and historical comparison.

#### What it is not
- Not a real-time view. A review is a snapshot, not a live dashboard.
- Not a resolution mechanism. A review describes state; it does not change underlying objects.
- Not a forecast. A review summarizes what is; a forecast projects what may be.
- Not a substitute for the underlying objects it summarizes. Tensions, memories, and forecasts exist independently.

#### Minimal attributes
- `weekStart` — the Monday that defines the period
- `status` — draft / locked
- `activeReferenceCount` — active memory count
- `openContradictionCount` — open tension count
- `stabilityProxy` — derived stability score
- `tensionDensity` — open tensions relative to total
- `top3Snapshot` — the highest-weight tensions at snapshot time
- `inputHash` — integrity hash for the locked state

#### Implementation note
Currently implemented as `WeeklyAudit` in the DB. "Audit" is the internal term; "Review" is the user-facing label.

---

### Chat Session

#### What it is
A bounded conversational context — a thread of messages between the user and the assistant, with a defined start and an optional end. Sessions are the primary unit of interaction.

#### What it is for
Organizing messages into coherent contexts. A session provides the window in which the assistant operates, the scope for in-session memory (via transcript), and the source from which memories, evidence, and tensions may be extracted.

#### What it is not
- Not itself durable memory. A session ends; memory persists beyond it.
- Not a review. A session is a working context; a review is a reflective summary.
- Not a knowledge base. The session transcript is transient context, not a permanent record of truth.

#### Minimal attributes
- `userId` — owner
- `label` — optional human-readable name
- `origin` — native (APP) or imported (IMPORTED_ARCHIVE)
- `startedAt` / `endedAt` — temporal bounds
- `messages` — ordered message list

---

### Message

#### What it is
An atomic, time-stamped conversational unit within a session — a single turn from either the user or the assistant.

#### What it is for
Recording the conversation and serving as the raw material from which memories, evidence, and forecasts may be extracted. Messages are the primary input to the extraction pipeline.

#### What it is not
- Not durable truth by itself. A message represents what was said at a moment, not what is structurally true.
- Not evidence by itself. A message becomes evidence only when a specific span is linked to a specific claim.
- Not a memory. The assistant's response is not automatically a memory update.
- Not directly context-injected in full. Only recent messages plus extracted artifacts are injected as context.

#### Minimal attributes
- `sessionId` — the session it belongs to
- `userId` — owner
- `role` — user / assistant / system
- `content` — the full text content
- `createdAt` — timestamp

---

## 2. Relations Between Entities

```
Message        --> EvidenceSpan   : a message span may be extracted as evidence (via derivation or explicit capture)
Message        --> Memory         : a message may produce a memory (governed extraction or explicit capture)
Message        --> Forecast       : a message may produce a forecast (explicit capture from assistant message)
Message        --> Tension        : a message may trigger tension detection (automated, via detection pipeline)

EvidenceSpan   --> Memory         : evidence grounds a memory claim (via ArtifactEvidenceLink / DerivationArtifact)
EvidenceSpan   --> Tension        : evidence grounds a tension (via ContradictionEvidence + span reference)
EvidenceSpan   --> Forecast       : evidence may ground a forecast premise (not yet implemented)

Memory        <-> Tension         : two conflicting memories may surface a tension (ContradictionReferenceLink)
Memory         --> Tension        : a memory may be linked as context for a tension (ContradictionReferenceLink)

Tension        <-- Evidence       : a tension is grounded by one or more evidence records
Tension        <-- Memory         : a tension may reference one or more memories that conflict

Forecast       <-- Message        : a forecast is captured from an assistant message
Forecast       <-- Evidence       : evidence may support or falsify a forecast (future)

Review         --> Tension        : a review snapshots the top-weighted open tensions
Review         --> Memory         : a review counts active memories
Review         --> Forecast       : a review may include open forecasts (future)

Session        --> Message        : a session owns an ordered sequence of messages
Session        --> Memory         : a session may be the source of extracted memories
Session        --> Tension        : a session may be the source of detected tensions

Source         --> Evidence       : a source may contain evidence spans (future; currently URLs only)
Source         --> Memory         : a source may ground a memory (via from-url reference creation)
```

### Primary vs derived links

**Primary links** — created explicitly by the user or a governed process:
- User capture: Message → Memory, Message → Forecast
- Explicit link: Memory ↔ Tension (ContradictionReferenceLink)
- Automated detection: Message → Tension (contradiction detection pipeline)

**Derived / inferred links** — produced by derivation runs or heuristics:
- EvidenceSpan → Memory (via DerivationArtifact promotion)
- EvidenceSpan → Tension (via ContradictionEvidence attached to a node)
- Review → Tension / Memory (read-only aggregation at snapshot time)

---

## 3. Lifecycle States

### Memory (`ReferenceItem`)

```
candidate --> active --> superseded
                    \--> inactive
```

- **candidate** — extracted but not yet confirmed as reliable
- **active** — confirmed; used in context injection and tension detection
- **superseded** — replaced by a newer version of the same claim
- **inactive** — manually deactivated; no longer used but retained

### Source

Not yet a first-class lifecycle. Currently follows `ReferenceItem` status (candidate / active / inactive). Needs a separate model in a future pass.

### Evidence (`EvidenceSpan`)

```
captured --> linked
```

- **captured** — span exists in the DB, content-hashed
- **linked** — connected to one or more artifacts, tensions, or memories

No disputed or archived states yet. These are a future addition.

### Tension (`ContradictionNode`)

```
open --> explored --> snoozed --> open (unsnooze)
                 \--> resolved
                 \--> accepted_tradeoff
                 \--> archived_tension
```

- **open** — active, unresolved, surfaced in context
- **explored** — acknowledged and examined but not yet closed
- **snoozed** — temporarily suppressed (with expiry date or indefinite)
- **resolved** — the conflict is no longer present
- **accepted_tradeoff** — the conflict is acknowledged as permanent; user has accepted the trade-off
- **archived_tension** — removed from active surfacing without resolution

### Forecast (`Projection`)

Current DB model has no status field. Intended lifecycle:

```
open --> monitored --> confirmed
                  \--> failed
                  \--> superseded
```

- **open** — active, no verdict yet
- **monitored** — being tracked for evidence
- **confirmed** — outcomes materialized as expected
- **failed** — outcomes did not materialize
- **superseded** — replaced by a revised forecast

**This lifecycle is not yet implemented.** The `Projection` model needs a `status` field.

### Review (`WeeklyAudit`)

```
draft --> locked
```

- **draft** — current week's in-progress snapshot; metrics may change
- **locked** — immutable; hash-sealed for historical integrity

### Chat Session (`Session`)

```
active --> ended
origin=APP              (native path)
origin=IMPORTED_ARCHIVE (born as ended)
```

- **active** — no `endedAt`; current or recent session
- **ended** — `endedAt` is set; session is complete
- **imported** — `origin = IMPORTED_ARCHIVE`; session was reconstructed from an external archive

### Message

No complex lifecycle. All messages are stored on creation. Role (user / assistant / system) is the primary distinction. No further states currently needed.

---

## 4. Governance / Access Rules

These are system-level invariants, not user-facing access control rules.

1. **Chat history is not automatically durable memory.** Transcripts are buffered (Redis, capped at 20k chars). Only explicitly captured or governed-extraction-promoted items become memories.

2. **Extraction from message → entity requires explicit action or a governed process.** Raw messages do not become memories or evidence on their own. Capture requires either user action (chat capture buttons) or a derivation run.

3. **Tensions are not auto-resolved by responses.** Generating a response that addresses a tension does not close it. Resolution requires an explicit user action (Resolve, Accept Trade-off, Archive).

4. **Memories carry confidence, not certainty.** No memory should be treated as ground truth. All memories have a confidence level and may be superseded.

5. **Forecasts must remain falsifiable.** A forecast that cannot in principle be confirmed or failed is not a forecast — it is speculation. Forecasts should be revisitable.

6. **Reviews summarize state; they do not replace underlying objects.** Locking a review does not lock the tensions or memories it references. Those continue to evolve independently.

7. **Linked evidence grounds a claim; unlinked quotes are not evidence.** A captured quote is not evidence until it is linked to a specific memory, tension, or forecast.

8. **Superseding a memory does not delete it.** The supersession chain is retained for history. `supersededBy` links allow tracing how beliefs evolved.

---

## 5. Non-Goals (This Pass)

- **Not a full autonomous reasoning engine.** The system surfaces and tracks cognitive structure; it does not resolve tensions or adjudicate truth automatically.
- **Not automatic truth adjudication.** The system flags inconsistencies; it does not determine which side of a tension is correct.
- **Not a complete causal forecasting engine.** Forecasts are structured expectations, not probabilistic causal models.
- **Not yet a forecast validation / scoring framework.** Confirming or failing forecasts requires a future pass with supporting infrastructure.
- **Not yet a full tension resolution engine.** Resolution actions are available but the system does not propose resolution paths.
- **Not a real-time graph database.** Relations between entities are tracked in a relational DB with explicit link tables, not a property graph.
- **Not yet separating Source from Memory at the DB level.** This distinction exists conceptually but is not yet enforced in the schema.

---

## 6. Naming and Terminology

The UI pass changed user-facing labels. This section clarifies what those changes mean at the conceptual level.

| User-facing label | Conceptual term | Internal DB / code term | Notes |
|---|---|---|---|
| Tension | Tension | `ContradictionNode` / Contradiction | "Tension" is softer but accurate. "Contradiction" is the precise internal term. Both refer to the same concept and DB model. No ambiguity in the ontology. |
| Forecast | Forecast | `Projection` | User-facing label vs internal/DB term. These are exact equivalents — one concept, two names. |
| Review | Review | `WeeklyAudit` | User-facing label vs internal/DB term. These are exact equivalents — one concept, two names. |
| Memory | Memory | `ReferenceItem` | "Reference" was the original internal term. "Memory" is the intended conceptual role. Not exact equivalents — `ReferenceItem` also covers Source-like objects. This gap needs resolution. |
| Level | Escalation level / Probe rung | `escalationLevel` / `recommendedRung` / `ProbeRung` | "Level" is the user-facing simplification. Internally, `rung` refers to probe rung (gentleness of surfacing); `escalationLevel` is a separate integer counter. The internal distinction matters and should be preserved in code. |

### Unresolved terminology tensions

1. **Memory vs Source vs ReferenceItem.** `ReferenceItem` currently covers both structured internal memories (goals, patterns, preferences) and externally-grounded references (URLs via `/api/reference/from-url`). These are conceptually distinct entities. A future schema pass should split them.

2. **Evidence (two kinds).** `EvidenceSpan` (precise, character-level, linked to derivation artifacts) and `ContradictionEvidence` (lighter, session/message tagged, attached directly to tensions) are both called "evidence" but are structurally different. A unified evidence model is needed.

3. **Rung vs Level.** Internally, "rung" is used in two senses: `ProbeRung` (how forcefully to surface a tension) and `recommendedRung` (the system's recommended probe level). The UI shows a single "Level N" label. This simplification is acceptable for users but the internal distinction should be preserved in code.

---

## 7. Deliverable Summary

**File created:** `docs/cognitive-architecture-pass-1.md`

**Final entity list:**
1. Memory (DB: `ReferenceItem`)
2. Source (conceptual only; no separate DB model yet)
3. Evidence (DB: `EvidenceSpan` + `ContradictionEvidence`, not yet unified)
4. Tension (DB: `ContradictionNode`)
5. Forecast (DB: `Projection`)
6. Review (DB: `WeeklyAudit`)
7. Chat Session (DB: `Session`)
8. Message (DB: `Message`)

**Most important relation rules:**
- Messages are raw material; they do not automatically become memories, evidence, or forecasts.
- Evidence grounds claims; unlinked quotes are not evidence.
- Tensions are not resolved by responses — only by explicit user actions.
- Reviews summarize state but do not replace the underlying objects they describe.
- Memory ↔ Tension is the central feedback loop: active memories surface tensions; resolved tensions may supersede memories.

**Terminology tensions left unresolved:**
1. Memory vs Source vs ReferenceItem — schema gap; needs a future pass.
2. Evidence (two kinds: EvidenceSpan vs ContradictionEvidence) — needs unification.
3. Rung vs Level — internal distinction preserved; user-facing label simplified.

**Code changes made:** None. This is a documentation-only pass.
