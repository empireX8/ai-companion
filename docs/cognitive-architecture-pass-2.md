# Cognitive Architecture — Pass 2: Relation Rules, Invariants, and Promotion Logic

**Date:** 2026-03-07
**Depends on:** `docs/cognitive-architecture-pass-1.md`
**Scope:** Relation types, allowed link matrix, promotion boundaries, automatic vs explicit action, invariants, disallowed relations, and ontology debt.
**Purpose:** Define how the entities from Pass 1 are allowed to connect and change without the system losing coherence.

---

## 1. Relation Types

Six types of relation are used in the system. Every link between entities should be classifiable as one of these.

### A) Origin / source-of

Something produced or extracted from something else. The origin is the causal upstream.

Examples:
- Message → Memory (a message was the source of the captured belief)
- Message → Forecast (a message was the source of the forward projection)
- Message → EvidenceSpan (a message text position was extracted as evidence)
- Session → Tension (a session produced the context in which the tension was detected)
- Source → Evidence (a source document contains an evidentiary claim)

### B) Support / grounding

Something that justifies or backs up a claim. The supporting object is cited as reason to believe the claim.

Examples:
- Evidence → Memory (evidence grounds why a memory is held)
- Evidence → Tension (evidence grounds one or both sides of a conflict)
- Evidence → Forecast (evidence grounds the premise or expected drivers)
- Source → Memory (an external document backs up a stated belief)
- Source → Evidence (a source provides the material from which evidence is extracted)

### C) Conflict / tension

Two objects are inconsistent with each other. The conflict is the relation itself — not a third object standing between them.

Examples:
- Memory conflicts with Memory (two goals, beliefs, or constraints cannot both be acted on)
- Forecast conflicts with Memory (an expectation contradicts a stable belief)
- Source conflicts with Source (two external documents make opposing claims about the same domain)
- Memory conflicts with Forecast (a belief makes the expected outcome implausible)

This relation type is what the Tension entity is used to track. A Tension is the explicit, named record of a conflict relation.

### D) Summary / aggregation

One object describes or aggregates the state of one or more other objects at a point in time. The summary does not control the underlying objects.

Examples:
- Review → Tension (a review records which tensions were open at snapshot time)
- Review → Memory (a review counts active memories at snapshot time)
- Review → Forecast (future: a review may record which forecasts were open)
- Top-3 Snapshot within Review → specific Tensions (a named subset)

### E) Supersession / revision

A newer version of an object replaces an older version. The old version is retained for history.

Examples:
- Memory supersedes Memory (a refined belief replaces a prior one)
- Forecast supersedes Forecast (an updated projection replaces an earlier one)
- Source supersedes Source (a newer document replaces a deprecated external reference)

Supersession is not deletion. The prior object remains accessible in the revision chain.

### F) Governance / promotion

An object moves from one epistemic status to another through a defined process. This is the boundary between observed/inferred and durable/explicit.

Examples:
- Candidate Memory → Active Memory (promoted by user or governed process)
- Candidate Tension → Tracked Tension (promoted by detection pipeline + acceptance)
- EvidenceSpan → linked to Memory/Tension/Forecast (explicitly linked by user or derivation run)
- Forecast open → Forecast confirmed / failed (resolved by explicit user action or future scoring)

---

## 2. Allowed Relation Matrix

### Message

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Message | Memory | Yes | Origin | Via explicit capture (user action) or derivation run |
| Message | EvidenceSpan | Yes | Origin | Via explicit capture or derivation run |
| Message | Forecast | Yes | Origin | Via explicit capture from assistant message only |
| Message | Tension | Yes | Origin (indirect) | Via automated detection pipeline; message is the trigger |
| Message | Source | No | — | Messages do not create Sources |
| Message | Review | No | — | Reviews aggregate at week level, not message level |

### Memory

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Memory | Evidence | Yes (read) | Support (reverse) | Evidence grounds a memory; Memory points to its grounding evidence |
| Memory | Source | Yes (read) | Support (reverse) | A source may back a memory |
| Memory | Tension | Yes | Conflict (via Tension) | A Memory may be one side of a Tension via ContradictionReferenceLink |
| Memory | Forecast | No (direct) | — | A memory does not produce forecasts directly |
| Memory | Memory | Yes | Supersession | A memory may supersede a prior version of itself |
| Memory | Review | No | — | Reviews aggregate memory counts; no direct link per-memory |

### Source

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Source | Evidence | Yes | Origin / Support | A source contains or produces evidence spans |
| Source | Memory | Yes (weak) | Support | A source URL may be the origin of a manually captured memory |
| Source | Forecast | No | — | Sources do not generate forecasts; forecasts are user/assistant-side |
| Source | Tension | No (direct) | — | A source does not directly create a tension; evidence from it may |
| Source | Review | No | — | Not aggregated directly |

### Evidence

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Evidence | Memory | Yes | Support | Evidence grounds a memory claim |
| Evidence | Forecast | Yes | Support | Evidence may ground a forecast premise or drivers |
| Evidence | Tension | Yes | Support | Evidence is attached to a tension as grounding |
| Evidence | Source | Yes (read) | Origin (reverse) | Evidence traces back to a source or message |
| Evidence | Message | Yes (read) | Origin (reverse) | EvidenceSpan always traces to a message |
| Evidence | Evidence | No | — | Evidence does not compose into meta-evidence |
| Evidence | Review | No | — | Not aggregated directly per-evidence |

### Forecast

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Forecast | Evidence | Yes (read) | Support (reverse) | Evidence may ground or falsify a forecast |
| Forecast | Tension | Possible | Conflict | A forecast may conflict with a memory → surfaces a tension |
| Forecast | Forecast | Yes | Supersession | A revised forecast may supersede the prior one |
| Forecast | Review | Future | Summary | A review may eventually include open forecasts |
| Forecast | Memory | No (direct) | — | Forecasts do not update memories directly |

### Tension

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Tension | Memory | Yes (read) | Conflict (reverse) | A tension links to the memories that conflict (ContradictionReferenceLink) |
| Tension | Evidence | Yes (read) | Support (reverse) | A tension holds evidence records |
| Tension | Forecast | Future | Conflict (reverse) | A tension may eventually reference a forecast it conflicts with |
| Tension | Review | Yes (read) | Summary (reverse) | A review snapshots the tension's state at a point in time |
| Tension | Tension | No | — | Tensions do not link to each other directly |

### Review

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Review | Tension | Yes (read-only) | Summary | Reads tension counts and top-3 at snapshot time |
| Review | Memory | Yes (read-only) | Summary | Reads active memory count at snapshot time |
| Review | Forecast | Future (read-only) | Summary | May include open forecast count in future |
| Review | Session | No | — | Reviews are user-scoped, not session-scoped |
| Review | Review | Yes | Comparison only | Two reviews may be compared (diff); no structural link |

### Chat Session

| From | To | Allowed | Type | Notes |
|---|---|---|---|---|
| Session | Message | Yes | Composition | A session owns all its messages |
| Session | Memory | Yes | Origin | A session may be noted as the source of a captured memory |
| Session | Tension | Yes | Origin | A session may be noted as the source of a detected tension |
| Session | Forecast | Yes | Origin | A session may be noted as the source of a captured forecast |
| Session | Review | No | — | Reviews are week-scoped, not session-scoped |

---

## 3. Primary vs Derived Links

### Definitions

**Primary link** — created by deliberate user action or a governed, deterministic process with explicit acceptance. Should be auditable. Should be trusted.

**Derived link** — created by inference, heuristics, automated detection, or derivation pipelines without per-instance user acceptance. Should be labeled as derived and treated with lower epistemic authority until promoted.

### Link classification

| Link | Primary | Derived | Notes |
|---|---|---|---|
| Message → Memory (explicit capture) | Primary | — | User clicked capture; trust as stated |
| Message → Memory (derivation run) | — | Derived | Candidate until promoted by user or governance |
| Message → EvidenceSpan (explicit) | Primary | — | User selected a span |
| Message → EvidenceSpan (automated) | — | Derived | Extracted by derivation pipeline |
| Message → Forecast (explicit capture) | Primary | — | User clicked Forecast button on assistant message |
| Message → Tension (automated detection) | — | Derived | Pipeline heuristic; treated as candidate until confirmed |
| Memory → Tension (ContradictionReferenceLink) | Both | Both | Link is created explicitly; whether it's trusted depends on the source of the memory |
| Evidence → Memory (via DerivationArtifact) | — | Derived | Governed extraction output; candidate until promoted |
| Evidence → Tension (ContradictionEvidence) | Both | Both | May be added by user or by detection pipeline |
| Review → Tension (snapshot) | — | Derived | Always computed; no user action |
| Memory supersedes Memory | Primary | — | Must be explicit; never auto-superseded silently |
| Forecast supersedes Forecast | Primary | — | Must be explicit; not auto-replaced |

### Key rule

**Derived links must remain distinguishable from primary links in both the data model and the UI.**

A candidate tension produced by automated detection is not the same as a tension explicitly accepted by the user. If this distinction collapses, the system loses auditability.

---

## 4. Promotion Logic

Promotion is the boundary between observed/inferred and durable/trusted. Every core entity has a promotion path.

### Message → Memory

| State | What it is | Trigger |
|---|---|---|
| Raw transcript | Text in Redis buffer | Every message, automatically |
| Candidate memory | `ReferenceItem` with `status=candidate` | Derivation run or explicit user capture |
| Active memory | `ReferenceItem` with `status=active` | User promotes, or governed auto-promotion rule |

A message never becomes an active memory directly. The path is: message → (derivation / capture) → candidate → (promotion) → active.

A message that is only in the Redis transcript buffer is not yet a memory. It is transient context.

### Message → Evidence

| State | What it is | Trigger |
|---|---|---|
| Raw text | Message content in DB | Every stored message |
| Extracted span | `EvidenceSpan` with position + hash | Derivation run or explicit user selection |
| Linked evidence | `EvidenceSpan` connected to a Memory, Tension, or Forecast | Link creation (derivation or user action) |

An unlinked `EvidenceSpan` is extracted evidence but not yet grounding anything. It is not functioning as evidence until linked. Extraction and linking are two distinct steps.

### Message → Forecast

| State | What it is | Trigger |
|---|---|---|
| Speculative text | Inline claim in assistant message | Natural language; no DB record |
| Captured forecast | `Projection` with premise + drivers + outcomes | Explicit user capture via Forecast button |
| Monitored forecast | `Projection` with `status=monitored` (not yet implemented) | Future: user explicitly marks it for tracking |

Only assistant messages may be captured as forecasts. A user's casual speculation is not a forecast until structured and captured. The system should not auto-capture forecasts.

### Tension creation

| State | What it is | Trigger |
|---|---|---|
| Surface friction | Inconsistency detected in a message | Automated detection pipeline; not persisted |
| Candidate tension | `ContradictionNode` created, not yet surfaced | Detection pipeline writes to DB |
| Tracked tension | `ContradictionNode` with status `open`, surfaced to user | System surfaces via Top-3 or detail view |
| Escalated tension | Probe level increased | Escalation logic on repeated avoidance |
| Resolved / closed | Terminal state | Explicit user action only |

The detection pipeline may create a `ContradictionNode` automatically. However, the pipeline result should be labeled as system-inferred until the user has engaged with it. Auto-creation of tensions is a derived action; auto-resolution is never allowed.

---

## 5. Explicit-Action vs Automatic-Action Boundaries

### May be automatic (system-initiated, no user approval required)

- Appending messages to the Redis transcript buffer
- Running the tension detection pipeline on new user messages
- Creating a candidate `ContradictionNode` when the detection pipeline finds a conflict
- Creating `EvidenceSpan` records via derivation runs
- Creating candidate `ReferenceItem` (memory) records via derivation runs
- Computing a weekly Review snapshot (draft state)
- Updating escalation level and avoidance count on a tension
- Surfacing top-3 tensions in context injection
- Expiring snoozed tensions when `snoozedUntil` has passed

### Requires explicit user action

- Promoting a candidate memory to active status
- Resolving, accepting trade-off, or archiving a tension
- Confirming or marking a forecast as failed
- Superseding a memory with a new version
- Locking a weekly Review
- Linking evidence to a specific claim (when not done by derivation)
- Capturing a message excerpt as evidence with intent
- Capturing a forecast from an assistant message
- Deleting any core entity
- Unlinking a reference from a tension

### Boundary cases that need explicit policy (not yet decided)

- **Auto-promotion of candidate memories**: Should derivation-run candidates auto-promote after N days without dispute? Not yet decided. Default: manual promotion required.
- **Auto-closing stale tensions**: Should tensions with no activity for N months be auto-archived? Not yet decided. Default: never auto-close.
- **Auto-linking evidence to tensions**: The detection pipeline currently writes `ContradictionEvidence` without user approval. This is a deviation from the rule above and is tolerated as a pragmatic compromise, but should be revisited when the evidence model matures.

---

## 6. Invariants

Invariants are rules that must hold for the system to remain coherent. A feature that violates an invariant is a bug in the design, not just the implementation.

### Memory invariants

1. **Every active memory must have a traceable origin.** A memory without a `sourceSessionId` or `sourceMessageId` or an explicit user note is an orphan. Orphaned memories should be flagged, not silently accepted.
2. **Memory is not equivalent to transcript.** Nothing in the Redis transcript buffer is a memory. Memories are DB records with explicit status and provenance.
3. **Active memory may be superseded, not silently overwritten.** Updating the `statement` of an existing active `ReferenceItem` in place is destructive. The correct path is to create a new version and link via `supersedesId`.
4. **Candidate and active memories are not the same.** Code that ignores the `status` field and treats all `ReferenceItem` rows as equally trusted is incorrect.

### Evidence invariants

5. **Evidence must point to a concrete location.** An `EvidenceSpan` without a valid `messageId`, `charStart`, and `charEnd` is not evidence — it is a note. These are not interchangeable.
6. **Evidence must support something.** An unlinked `EvidenceSpan` is extracted but not yet functioning as evidence. Systems should not treat extraction as equivalent to grounding.
7. **A quote in a message capture panel is not evidence until linked.** Capturing text into the "Save evidence" form does not automatically produce an `EvidenceSpan`. The span must be created and linked to a claim.

### Tension invariants

8. **A tension requires two distinct positions.** A `ContradictionNode` must have non-empty `sideA` and `sideB`. A single position with no counterpart is not a tension — it is an assertion.
9. **A generated response does not resolve a tension.** Producing text that addresses a tension, acknowledges it, or proposes a solution is not the same as resolving it. Resolution requires explicit user action.
10. **A tension's traceability must be preserved.** The `sourceSessionId` and `sourceMessageId` of a tension must not be cleared without cause. If the source message is deleted, the pointer should become null (not cascade-deleted), and the tension should persist.
11. **Tension status is terminal-monotone.** Once a tension is in a terminal state (resolved, accepted_tradeoff, archived_tension), it should only be exited via an explicit Reopen action. Statuses should not revert silently.

### Forecast invariants

12. **A forecast must be falsifiable.** A forecast that has no conditions under which it would be wrong is not a forecast — it is a tautology. Forecasts must have stated outcomes that can in principle fail to materialize.
13. **A forecast is not confirmed merely because later text is consistent with it.** Textual agreement in subsequent messages does not constitute confirmation. Confirmation requires explicit action.
14. **A forecast is not the same as a plan.** Plans prescribe what should happen; forecasts describe what is expected to happen. These are different epistemic objects.

### Review invariants

15. **A locked review is immutable.** Once `status=locked`, no field on the review should be updated except `lockedAt`. The input hash seals the state for integrity checking.
16. **A review does not control the entities it describes.** Locking a review does not lock the tensions, memories, or forecasts that were snapshotted. Those continue to evolve.
17. **Reviews are week-scoped, not session-scoped.** A review aggregates all activity for a given `weekStart` for the user, regardless of how many sessions occurred.

### General invariants

18. **User-facing label softness must not erase internal precision.** "Tension" (user-facing) and "Contradiction" (internal) refer to the same concept. "Forecast" and "Projection" are the same. The UI simplification is a rendering choice, not a conceptual simplification. Code that relies on user-facing labels for logic is incorrect.
19. **Derived links must remain distinguishable from primary links.** The data model and UI should always be able to indicate whether a link was created by user action or automated inference. Conflating these undermines auditability.
20. **The system preserves revision history.** Superseding, resolving, or archiving an entity retains the prior state. Destructive overwrites of `statement`, `sideA`, `sideB`, or `outcomes` are not allowed on durable entities.

---

## 7. Disallowed and Dangerous Relations

These are the things the system must not do, even if they would be technically easy to implement.

### Response-driven state changes

- **A response must not automatically rewrite durable memory.** The assistant generating a message that contradicts a belief does not update, supersede, or archive that belief. Memory is written only by governed processes or explicit user action.
- **A response must not automatically resolve a tension.** Producing a well-reasoned answer about a conflict does not close the conflict. The tension continues until the user resolves it.
- **A response must not automatically confirm a forecast.** Text that is consistent with a forecast's predicted outcomes does not confirm it.

### Heuristic-driven closure

- **A tension must not be auto-resolved by confidence heuristics.** Even if the system assigns a low confidence score to a tension, it should not silently close it. Low confidence may affect surfacing priority but not lifecycle state.
- **A memory must not be auto-superseded by a newer claim without user awareness.** If the detection pipeline produces a claim that conflicts with an existing active memory, the result should be a candidate tension, not a silent overwrite of the memory.

### Summary objects as controllers

- **A review must not become a mutable controller over the entities it summarizes.** A review is read-only over its subjects. It must not trigger state changes on tensions or memories as a side effect of being created, viewed, or locked.
- **Locking a review must not propagate any state change to underlying objects.**

### Source / message conflation

- **A source must not be treated as evidence without an identified span or claim.** Linking a URL to a tension is not the same as grounding the tension with evidence from that URL. The link is at best a reference pointer, not evidence grounding.
- **A message must not be treated as truth merely because it exists.** A message with `role=assistant` is a generated output. It reflects the model's response under the conditions of that moment. It is raw material, not a system-verified claim.

### Evidence conflation

- **An unlinked quote is not evidence.** A text snippet captured from a message that has not been linked to a specific claim (memory, tension, or forecast) is not functioning as evidence. Systems must not surface it as such.

---

## 8. Ontology Debt Register

These are the structural tensions identified across Pass 1 and Pass 2 that are officially deferred as ontology debt. Each has a risk assessment and a deferral status.

---

### OD-1: Memory vs Source split (`ReferenceItem` ambiguity)

**What it is:** The `ReferenceItem` model currently functions as both an internal Memory (a synthesized cognitive claim like a goal, belief, or preference) and an external Source (a URL or document linked for reference). These are conceptually distinct entities with different semantics, lifecycle rules, and relation permissions.

**Why it matters:** A "goal" and a "linked URL" have different roles in the system. Goals are assertable claims that can be superseded by new beliefs. URLs are external references that ground evidence. Treating them identically prevents enforcing the correct relation rules (e.g., Sources should produce Evidence; Memories should participate in Tensions).

**Risk it creates:** Code that queries all `ReferenceItem` rows and injects them as "memories" into context is silently including external URL references as if they were internal cognitive claims. This inflates the context with non-assertable items and obscures what the system actually knows about the user.

**Deferral status:** Deferred. Does not block current feature work. Blocks correct evidence-grounding and Source-specific relation enforcement. Should be addressed before scaling memory injection logic.

---

### OD-2: Dual evidence systems (`EvidenceSpan` vs `ContradictionEvidence`)

**What it is:** The system has two evidence mechanisms that have grown separately:
- `EvidenceSpan` — character-level, content-hashed, linked to derivation artifacts and profile artifacts. Precise and well-structured.
- `ContradictionEvidence` — simpler, session/message-tagged, attached directly to a `ContradictionNode`. Lacks character-level precision.

**Why it matters:** Evidence should be a single, unified concept. A span of text either is evidence for something or it is not. Having two parallel structures means that evidence grounding a tension cannot easily be compared to or cross-linked with evidence grounding a memory.

**Risk it creates:** Future work that tries to unify tension grounding with memory grounding (e.g., showing all evidence for a claim in one place) must reconcile two incompatible structures. Code that searches for evidence linked to a user must query two tables with different schemas.

**Deferral status:** Deferred. Does not block current feature work. Blocks a unified evidence view and cross-claim evidence reuse. Should be addressed before evidence becomes a first-class user-facing surface.

---

### OD-3: Tension vs Contradiction naming precision

**What it is:** "Tension" is the user-facing label; "Contradiction" is the internal term used in the DB (`ContradictionNode`, `ContradictionStatus`, `ContradictionType`, `ContradictionEvidence`). These are exact-equivalent names for the same concept. However, "contradiction" implies logical incompatibility, while "tension" is softer and includes friction, competing priorities, and unresolved uncertainty — not just strict logical contradiction.

**Why it matters:** The current tension types include `pattern_loop` and `narrative_conflict`, which are not strict contradictions. Using "contradiction" as the internal term risks guiding future engineers toward interpreting all tension nodes as logical contradictions, when many are softer conflicts.

**Risk it creates:** Misclassification of tension types, over-aggressive detection heuristics, or incorrect resolution criteria if future engineers assume "contradiction" means the formal logical relation.

**Deferral status:** Deferred. Low risk in the short term because the distinction is noted here. Should be resolved when the tension type taxonomy is expanded or when automated detection rules are formalized.

---

### OD-4: Forecast lifecycle not fully implemented

**What it is:** The `Projection` DB model has no `status` field. There is no lifecycle enforcement for forecasts. Every forecast is implicitly "open" and cannot be marked confirmed, failed, or superseded through any system mechanism.

**Why it matters:** Forecasts that are permanently open cannot be evaluated, compared, or reviewed. The system cannot learn from whether its (or the user's) forecasts were correct. This makes forecasts decorative rather than epistemically useful.

**Risk it creates:** Users save forecasts and never revisit them because there is no resolution path. The forecast list grows indefinitely without meaningful pruning. The review snapshot cannot include forecast outcomes.

**Deferral status:** Partially blocking. Adding a `status` field and basic lifecycle transitions (open → confirmed / failed / superseded) is a small schema change with high conceptual value. Should be addressed in the next feature pass on forecasts.

---

### OD-5: Review language vs internal audit language

**What it is:** "Review" is the user-facing label; `WeeklyAudit` is the internal DB model name. Unlike OD-3, this pair does not carry a semantic risk — "audit" and "review" are close synonyms for a periodic reflective snapshot. The risk is purely one of code readability.

**Why it matters:** Internal code and external language are misaligned. An engineer reading the codebase will encounter `WeeklyAudit`, `audit-api.ts`, `/api/audit/`, and `AuditListPanel` while the user sees "Review" everywhere. This creates a minor friction but is not a conceptual problem.

**Risk it creates:** Low. New engineers may be confused. Search for "review" in the codebase will not find the implementation.

**Deferral status:** Low priority. May be addressed if/when a larger internal naming pass is justified. Not worth a targeted refactor on its own.

---

### OD-6: Probe rung / escalation level simplification

**What it is:** The system uses two distinct internal concepts that are both displayed as "Level N" in the UI:
- `recommendedRung` (`ProbeRung` enum) — how forcefully to surface or probe the tension (gentle mirror → forced choice)
- `escalationLevel` (integer) — how many escalation events have occurred

The UI shows a single "Level" label, collapsing these two distinct dimensions.

**Why it matters:** `recommendedRung` is a qualitative probe intensity recommendation. `escalationLevel` is a quantitative event counter. Displaying them as the same thing conflates what the system recommends doing with what has already happened.

**Risk it creates:** Moderate. As escalation logic becomes more sophisticated, the user (and future engineers) may be confused about what "Level 3" means — is it the probe intensity or the count of escalation events?

**Deferral status:** Deferred. The simplification is acceptable for current UI surface area. Should be revisited when escalation logic is exposed more explicitly to users.

---

## 9. Minimal Implementation Implications

This section notes what Pass 2's conceptual definitions will require from future code work. This is not a task list — it is a statement of consequences.

**From the Memory / Source split (OD-1):**
Schema change needed: a separate `SourceItem` or `ExternalReference` model distinct from `ReferenceItem`. The context injection pipeline must differentiate between cognitive claims and external references when building the system prompt.

**From the dual evidence systems (OD-2):**
A future unified `Evidence` model should replace both `EvidenceSpan` (when used as claim grounding) and `ContradictionEvidence`. Both should point to a message + char range, and both should support a `linkedEntityType + linkedEntityId` field for polymorphic claim grounding.

**From the forecast lifecycle gap (OD-4):**
Add `status String @default("open")` to the `Projection` model. Add a lifecycle API endpoint (`PATCH /api/projection/[id]`) that accepts `{ status: "confirmed" | "failed" | "superseded" }`. This is the minimum viable forecast lifecycle.

**From primary vs derived link distinction:**
When creating links between entities via automated pipelines, the creating record should carry a `origin` or `createdBy` field distinguishing `"user"`, `"detection_pipeline"`, and `"derivation_run"`. This is essential before the UI surfaces derived links to users as if they were explicit.

**From invariant #20 (revision history):**
Do not implement `UPDATE` mutations on `statement`, `sideA`, `sideB`, `outcomes`, or `premise` fields of durable entities. All revisions should use the supersession / versioning path.

**From invariant #19 (label precision):**
Internal code should never use user-facing label strings as logic keys. The detection pipeline should reference `ContradictionNode`, not "Tension". The API routes should use internal terms. The UI layer is the only place where user-facing labels appear.

---

## 10. Deliverable Summary

**File created:** `docs/cognitive-architecture-pass-2.md`

**Most important allowed relation rules:**
- Message → Memory / Evidence / Forecast: allowed, but creates candidates, not active objects
- Evidence → Memory / Tension / Forecast: the primary grounding relation; must be linked to be functional
- Memory ↔ Tension: the central feedback loop; a conflict between memories surfaces a tension
- Review → Tension / Memory: read-only snapshot; never controls or modifies

**Most important invariants:**
1. A generated response does not resolve a tension or update a memory
2. Evidence must point to a concrete location and be linked to a specific claim
3. Derived links must remain distinguishable from primary links
4. Supersession retains history; silent overwrite is disallowed
5. A review is read-only over the entities it summarizes

**Most important disallowed relations:**
- Response → auto-resolve Tension
- Response → auto-update Memory
- Response → auto-confirm Forecast
- Low-confidence heuristic → auto-close Tension
- Review lock → propagate state change to underlying entities
- Source URL → treated as evidence without an identified span

**Ontology debt list:**
| ID | Issue | Risk | Deferral |
|---|---|---|---|
| OD-1 | Memory vs Source in ReferenceItem | Moderate | Deferred |
| OD-2 | Dual evidence systems | Moderate | Deferred |
| OD-3 | Tension vs Contradiction naming precision | Low | Deferred |
| OD-4 | Forecast lifecycle not implemented | Moderate (partially blocking) | Near-term |
| OD-5 | Review vs Audit naming in code | Low | Low priority |
| OD-6 | Probe rung / escalation level conflation | Moderate | Deferred |

**Code changes made:** None. This is a documentation-only pass.
