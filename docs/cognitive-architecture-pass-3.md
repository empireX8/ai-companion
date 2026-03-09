# Cognitive Architecture Pass 3: System Flows, Decision Boundaries, and Operational Cognition

_Companion to Pass 1 (Core Ontology) and Pass 2 (Relation Rules, Invariants, Promotion Logic)._
_Scope: no code changes. Documentation only._

---

## 1. System Entry Points

Every durable state change in the system originates from one of five entry points. Each entry point has a distinct ownership model, latency budget, and promotion ceiling.

### 1.1 Live Chat Message (User Sends)

**Trigger:** user submits a message in an active chat session.

**Ownership:** user-initiated; system responds.

**Latency budget:** response must begin streaming within ~2 s; background work may continue for up to 60 s after response completes.

**Promotion ceiling:** no entity promoted to `active` during this entry point without prior user confirmation (see §8). Candidates may be created.

**What happens:** see §2 (full staged flow).

---

### 1.2 Assistant Response (System Sends)

**Trigger:** `streamText` emits a completed response chunk.

**Ownership:** system-generated content; user sees it.

**Latency budget:** background analysis runs after stream completes (fire-and-forget). No UI blocking.

**Promotion ceiling:** same as 1.1 — candidates only during the background pass.

**What happens:** see §3.

---

### 1.3 Explicit Capture (User Acts)

**Trigger:** user clicks "Save as memory", "Mark as evidence", "Save forecast", or "Add source" in the chat capture panel.

**Ownership:** fully user-driven.

**Latency budget:** synchronous; user expects immediate confirmation feedback.

**Promotion ceiling:** directly creates `active` / `candidate` entity — no additional gating needed. User intent is explicit.

**What happens:** see §4.

---

### 1.4 Import (Bulk Historical Data)

**Trigger:** user uploads a ChatGPT export ZIP; finalize + process pipeline runs.

**Ownership:** system runs bulk extraction; user initiated it.

**Latency budget:** minutes; polling via `/api/upload/status`.

**Promotion ceiling:** sessions and messages are always created. Memories, tensions, and candidates are created at `candidate` status and surfaced in the next chat; they do not auto-promote to `active` on import.

**What happens:** sessions + messages reconstructed → detection pipelines run on each conversation batch → `candidate` entities written → import summary returned.

---

### 1.5 Review Generation (Scheduled / On-Demand)

**Trigger:** user navigates to `/audit` and a review does not yet exist for the current week, or user clicks "Backfill".

**Ownership:** system-computed snapshot; user locks it.

**Latency budget:** synchronous; p95 < 2 s.

**Promotion ceiling:** Review is a read-only aggregate. It does not promote any entity. It may surface candidates the user hasn't seen yet.

**What happens:** `buildWeeklyAudit` reads current state → computes metrics → writes `WeeklyAudit` row → user reviews, then optionally locks.

---

## 2. End-to-End Flow: User Message

This is the most important flow in the system. Every stage is listed explicitly with its promotion rule.

### Stage 1 — Message Enters

1. `POST /api/message` receives `{ sessionId, content, mode }`.
2. Message persisted to `Message` table with `role: "user"`.
3. Transcript buffer refreshed from Upstash Redis (capped 20 k chars of recent turns).
4. **Promotion rule:** none. Message is durable immediately, but no other entity is created yet.

### Stage 2 — Transient Context Assembly

5. Four parallel reads: recent memories (Pinecone), active tensions (DB), active references (DB), pending forecasts (DB).
6. Results merged into a context block injected into the system prompt.
7. **Promotion rule:** none. Reads are non-mutating.

### Stage 3 — Pipeline Decision

8. `ResponseMode` checked (`standard` vs `deep`). Deep mode runs additional retrieval passes.
9. System prompt constructed: base instructions + context block + conversation transcript.
10. `streamText` called; response begins streaming to client.
11. **Promotion rule:** none. Pipeline selection is not a mutation.

### Stage 4 — Candidates Created (Background)

12. After stream completes, fire-and-forget background task runs.
13. Background task may:
    - Detect a new tension (creates `ContradictionNode` at `candidate` status).
    - Detect a memory-worthy fact (creates `ReferenceItem` at `candidate` status).
    - Detect a forecasted outcome (creates `Projection` at `candidate` status).
    - Detect a named external source (does not create a DB row; noted in session metadata only — OD-1).
14. All detections write only to `candidate` status. None may write `active` directly.
15. Detections are best-effort. A crash or timeout in the background task does not fail the response.
16. **Promotion rule:** candidates created silently; not surfaced in the same response turn that created them.

### Stage 5 — Response Completes

17. Full assistant message persisted to `Message` table with `role: "assistant"`.
18. Redis transcript buffer updated.
19. **Promotion rule:** none beyond §Stage 4.

### Stage 6 — Background Work Drains

20. Any in-flight detection tasks write their results.
21. If a candidate tension was created, its escalation level is computed and set.
22. **No silent promotion occurs.** Candidates remain candidates until user explicitly confirms or the next capture action promotes them.

### Stage 7 — Surfacing (Next Turn)

23. On the *next* user message, Stage 2 reads may surface the candidates created in Stage 4.
24. The assistant may reference them naturally or the capture panel may highlight pending candidates.
25. The user sees them; explicit capture action promotes to `active` (§4).

---

## 3. End-to-End Flow: Assistant Response

This flow describes what happens to the assistant's *output* — distinct from the input processing in §2.

### Stage A — Stream

1. Response tokens stream to client via Server-Sent Events.
2. No entity writes occur during streaming.

### Stage B — Completion Hook

3. On final chunk, `onFinish` callback fires (Vercel AI SDK).
4. Full response text available.

### Stage C — Response Analysis (Background)

5. Background pass analyzes the assistant's own output for:
   - **Hedged claims**: phrases like "you might consider", "you've mentioned before", "this seems to conflict with" — these are candidates for surfacing, not for auto-creating evidence.
   - **Forecast language**: "if X then Y", "likely outcome", "you expect" — candidates for a Forecast.
   - **Tension acknowledgment**: if the assistant explicitly names a tension in its response, this is a signal that an existing `ContradictionNode` is relevant; escalation may be bumped by 1 rung if user engaged meaningfully (see Pass 2 §Evidence promotion logic).
6. No entity auto-promoted from assistant response text alone. The assistant's output is input to detection, not a promotion trigger.

### Stage D — Evidence Bump (Conditional)

7. If user engaged with a surfaced tension (e.g., sent a message that extends the tension rather than resolving it), the background task may add an `EvidenceSpan` pointing to the current session.
8. This is the only automatic write from an assistant response — an evidence link on an *existing, already-active* tension. It does not create new tensions.
9. **Rule:** auto-evidence is permitted only for entities already at `active` status. It is never the mechanism that first creates a tension.

---

## 4. Capture Flows

Explicit capture is the user's direct intervention in the entity lifecycle. Each capture type has its own flow.

### 4.1 Save Memory

1. User selects text from the conversation (or the system highlights a suggested fragment).
2. User clicks "Save as memory".
3. Client posts `POST /api/reference` with `{ content, sessionId, source: "user_capture" }`.
4. `ReferenceItem` created at status `active` immediately (user intent is unambiguous).
5. Toast confirms creation; undo action registered (5-minute window).
6. Memory is available for context injection on the next turn.

**No candidate stage for user-initiated memory capture.** Direct to `active`.

### 4.2 Mark as Evidence

1. User identifies a passage relevant to an existing tension.
2. User opens the tension's detail page or the capture panel and clicks "Mark as evidence".
3. Client posts `POST /api/contradiction/[id]/evidence` with `{ note, source: "user_capture", sessionId }`.
4. `ContradictionEvidence` row created; escalation re-evaluated.
5. If escalation threshold crossed, `ContradictionNode.escalationLevel` incremented (automatic, because the user action was the trigger — see Pass 2 boundary rules).

**Escalation from user-triggered evidence is automatic.** The user caused it; no additional confirmation gate.

### 4.3 Save Forecast

1. User writes or confirms a forecasted outcome.
2. User clicks "Save forecast" in the capture panel.
3. Client posts `POST /api/projection` with `{ content, sessionId, horizon? }`.
4. `Projection` created at status `active`.
5. No candidate stage.

**Note:** Forecasts have no lifecycle state in the current schema (OD-4). Until that debt is resolved, `active` is the only status; deletion or archival is manual.

### 4.4 Add Source (Future — OD-1)

_Not yet implemented as a distinct entity. Currently, source attribution is stored as a string field on `ReferenceItem` or `EvidenceSpan`. When OD-1 is resolved:_

1. User identifies an external source (article, book, conversation partner).
2. User clicks "Add source".
3. `Source` entity created; linked to the originating Memory or Evidence.
4. Status: `active` immediately (user-initiated).

---

## 5. Detection / Derivation Flows

Detection pipelines run in the background after message completion. They are the system's autonomous cognition layer — the part that acts without explicit user instruction.

### 5.1 Trigger Conditions

Detection runs when ALL of the following are true:
- A user message has been processed and a response has been generated.
- The session is active (not archived or imported-only).
- The response mode allows background work (both `standard` and `deep` modes do).

Detection does NOT run:
- During streaming.
- During import processing (import has its own batch pipeline).
- During review generation (read-only aggregate).

### 5.2 Detection Output Types

| Pipeline | Output Entity | Output Status | Confidence Required |
|---|---|---|---|
| Tension detector | `ContradictionNode` | `candidate` | High (explicit conflict signal) |
| Memory detector | `ReferenceItem` | `candidate` | Medium (stated fact, preference, constraint) |
| Forecast detector | `Projection` | `candidate` | Medium (outcome statement with horizon) |
| Evidence linker | `ContradictionEvidence` | `active` (on existing active tension only) | High (clear relevance signal) |
| Source extractor | _(metadata only, OD-1)_ | N/A | Any |

### 5.3 Confidence Thresholds

Detection pipelines must apply an internal confidence gate before writing any entity:

- **High confidence:** explicit language — named conflict, stated preference, quoted commitment, numeric prediction. Write candidate.
- **Medium confidence:** implied or hedged language — "tends to", "usually", "might". Write candidate only if the fragment is substantive (> ~20 tokens of meaningful content).
- **Low confidence:** ambient tone, speculative asides, conversational filler. Do not write. Surface as a prompt annotation at most (not a DB entity).

_These thresholds are policy, not hard-coded numeric scores. The detection prompt must be authored to respect them._

### 5.4 Derivation Runs (Batch)

For import and future scheduled jobs, the `DerivationRun` + `DerivationArtifact` models track pipeline execution:

- One `DerivationRun` per batch execution.
- Each detection output is a `DerivationArtifact` linked to the run.
- Artifacts at `candidate` status are promoted only after user review or a future auto-promotion policy (not yet defined).
- Failed runs are logged; partial results are retained (not rolled back).

### 5.5 Deduplication

Before writing any candidate entity, detection pipelines must check for semantic equivalence with existing entities:

- **Memory:** if an existing `ReferenceItem` with overlapping content exists at `active`, skip (do not create a duplicate candidate).
- **Tension:** if an existing `ContradictionNode` with the same `sideA`/`sideB` pair exists (any status), add evidence to it instead of creating a new node.
- **Forecast:** if an existing `Projection` with the same prediction statement exists, skip.

Deduplication is conservative: when in doubt, skip the write and surface the existing entity.

---

## 6. Surfacing Logic

"Surfacing" is the act of making a stored entity visible to the user or the assistant. Not all stored entities are surfaced; not all surfaced entities are stored.

### 6.1 Categories

| Category | Stored? | Visible to User? | Injected into Prompt? |
|---|---|---|---|
| `stored-hidden` | Yes | No | No |
| `stored-visible` | Yes | Yes (on demand) | No |
| `stored-injected` | Yes | Yes (via assistant) | Yes |
| `injected-ephemeral` | No | Yes (via assistant) | Yes |
| `shown-on-request` | Yes | Only when navigated to | No |

### 6.2 What Is Injected into the Prompt

Prompt injection is reserved for entities most likely to change the assistant's response quality:

- **Active memories** (`ReferenceItem` at `active`): up to N items by recency + semantic relevance. Always injected if any exist.
- **Top active tensions** (`ContradictionNode` at `open`/`escalated`, highest escalation level first): up to 3.
- **Active pending forecasts** (`Projection`): up to 2.

**Candidates are never injected into the prompt.** They are shown in the capture panel UI but do not influence the assistant's reasoning until promoted.

### 6.3 What Is Surfaced in the UI (Not Prompt)

- **Pending candidates**: shown in the capture panel sidebar as "suggested" items awaiting user action.
- **Weekly Review**: always available at `/audit`; not injected into chat.
- **Tension detail**: always available at `/tensions/[id]`; surfaced in context drawer (top 3 by escalation).
- **Import summary**: shown on the import page after processing completes.

### 6.4 Surfacing Freshness

Injected context is assembled fresh on every user message (Stage 2 of §2). There is no TTL-based cache for surfaced entities — staleness is impossible at the injection point. The Redis transcript buffer has a separate 20 k-char cap and is refreshed per session.

### 6.5 Suppression Rules

An entity is suppressed from injection (even if `active`) when:
- Its status is `snoozed` and the snooze has not expired.
- Its status is `resolved`, `archived`, `accepted_tradeoff`, or any terminal state.
- It is a `candidate` (not yet promoted).

Suppressed entities remain in the DB and visible in domain list pages. They are simply not injected.

---

## 7. Decision Boundaries

These are the policy-level rules that determine which path the system takes when input is ambiguous. Each boundary has a default answer.

### 7.1 Transcript vs. Memory

**Question:** Should this piece of information be stored as a Memory, or left in the transcript?

**Decision rule:**
- If the fact is likely to be relevant in a *different future session*, store as Memory.
- If the fact is only relevant within *this session's context*, leave it in the transcript (Redis buffer).
- If unsure: prefer Memory (over-capture is less harmful than under-capture for a personal knowledge base).

**Signals that favor Memory:** stated preference, long-held belief, recurring theme, explicit "I always/never", named constraint.

**Signals that favor transcript-only:** transient task detail, one-time example, conversational throwaway.

---

### 7.2 Friction vs. Tension

**Question:** Is this a significant cognitive tension worth storing, or just a conversational friction point?

**Decision rule:**
- A Tension must have two identifiable sides (sideA, sideB) that genuinely conflict — not merely different perspectives on the same thing.
- The conflict must be *active* for the user — something that affects decisions or creates stress, not an abstract philosophical disagreement.
- Single-message complaints do not qualify. Recurrence across sessions is the primary signal.

**Default:** prefer *not* creating a Tension on first occurrence. Surface as a candidate; promote only if evidence accumulates or user confirms.

---

### 7.3 Note vs. Evidence

**Question:** Is this text a stand-alone memory, or evidence that should be attached to an existing tension?

**Decision rule:**
- If a strong semantic link to an existing tension exists (cosine similarity > threshold, or explicit reference), prefer Evidence over Memory.
- Evidence requires an anchor tension. If no relevant tension exists, create Memory instead.
- Do not create both. Choose one.

---

### 7.4 Speculation vs. Forecast

**Question:** Is this a real Forecast (prediction the user believes), or speculative exploration?

**Decision rule:**
- A Forecast requires the user to *hold* the prediction — not merely consider it hypothetically.
- Language signals: "I expect", "by X date", "if I do Y, then Z will happen" (user asserting).
- Not a Forecast: "what if", "I wonder", "could it be", "hypothetically" (user exploring).
- Default: if ambiguous, prefer *not* creating a Forecast. Surface as a candidate.

---

### 7.5 Auto-Detect vs. Wait for User

**Question:** Should the system create an entity now (background), or wait for the user to initiate capture?

**Decision rule:**
- If the signal is high-confidence and the entity type is Memory or Evidence on an existing tension → create candidate immediately.
- If the signal is medium-confidence → create candidate; surface to user but do not inject into prompt.
- If the signal is low-confidence → do not write. Discard.
- User explicit capture always takes priority and bypasses the confidence gate entirely.

---

## 8. Time and State Transitions

### 8.1 Automatic Transitions (No User Action Required)

These transitions happen without user confirmation. They are permitted because they are low-risk, reversible, or user-caused indirectly.

| Entity | From | To | Trigger |
|---|---|---|---|
| Tension | `snoozed` | `open` | Snooze sentinel date passes (on-read expiry) |
| Tension | `open` | `escalated` | Escalation threshold crossed by accumulated evidence (user-triggered evidence add caused it) |
| Memory | `candidate` | _(surfaced in UI)_ | Next session begins; candidate appears in capture panel |
| Forecast | `candidate` | _(surfaced in UI)_ | Same as Memory |
| Tension | `candidate` | _(surfaced in UI)_ | Same |
| Evidence | `active` | linked | Auto-linked to tension when added (immediate) |

**Automatic escalation** is permitted when user action (adding evidence) is the direct trigger — see Pass 2 boundary rules. The escalation itself does not require a second confirmation.

**Automatic de-escalation** is NOT permitted. Rung reduction requires explicit user action (resolve, accept tradeoff, archive).

### 8.2 Explicit Transitions (User Action Required)

| Entity | Transition | User Action |
|---|---|---|
| Memory | `candidate` → `active` | "Save memory" capture |
| Memory | `active` → deleted | Delete button (with undo window) |
| Tension | `candidate` → `open` | Confirm tension in capture panel |
| Tension | `open` → `snoozed` | Snooze action (with duration) |
| Tension | `open`/`escalated` → `resolved` | Resolve action |
| Tension | `open`/`escalated` → `accepted_tradeoff` | Accept trade-off action |
| Tension | `resolved`/`accepted_tradeoff` → `open` | Reopen action (undo or explicit) |
| Tension | any → `archived` | Archive action |
| Forecast | `candidate` → `active` | "Save forecast" capture |
| Forecast | `active` → deleted | Manual deletion |
| Review | `draft` → `locked` | "Lock week" button |

### 8.3 Never-Silent Transitions

The following transitions must **never** happen without explicit user action, even if the system has high confidence:

- Any entity: `candidate` → `active`
- Tension: any state → `resolved` or `accepted_tradeoff`
- Review: `draft` → `locked`
- Memory: any update to existing `active` content (supersession requires user to initiate)

The system may *suggest* these transitions (surfaced in UI) but may not execute them.

### 8.4 Undo Windows

All explicit terminal actions (resolve, snooze, archive, accept tradeoff) register an undo action with a 5-minute window. After the window expires, the action is permanent unless the user manually reopens.

Automatic transitions (snooze expiry, escalation from evidence) are not undoable via the undo manager — they are natural lifecycle events.

---

## 9. Ambiguous-Case Policy

When the system cannot determine the right action with confidence, these ordered defaults apply.

### 9.1 Prefer Candidate Over Durable

When uncertain whether to create an entity: create it at `candidate` status rather than `active`. A false candidate is cheap (user dismisses it). A false `active` entity pollutes the context injected into future sessions.

### 9.2 Prefer Surfacing Over Silent Mutation

When uncertain whether to surface a candidate to the user or quietly discard it: surface it. The user can dismiss. Silent discard means lost information with no recovery path.

This does not mean surface everything — low-confidence detections are still discarded (§5.3). The rule applies specifically to cases that crossed the confidence threshold but whose entity type or target anchor is ambiguous.

### 9.3 Prefer Provenance Retention

When uncertain whether to keep a source link or drop it: keep it. Provenance (which session, which message, which turn) is cheap to store and expensive to recover if lost. Never strip a `sessionId` or `messageId` from an entity to simplify a write.

### 9.4 Prefer Specificity Over Breadth

When uncertain whether one piece of text should be one entity or two: prefer one entity with a precise scope over two entities with broad, overlapping scopes. Deduplication (§5.5) is easier when entities are narrow. Merging later is harder than splitting early.

### 9.5 Prefer Existing Entity Over New Entity

When an incoming signal could extend an existing entity or create a new one: prefer extension. Add evidence to an existing tension rather than creating a second tension for the same conflict. Update a memory rather than creating a near-duplicate.

Exception: if the existing entity is `locked` or `archived`, create a new entity with a supersession link (Pass 2 §Relation Types — supersession).

---

## 10. Operational Invariants

These invariants govern the runtime behavior of the system. They complement the structural invariants in Pass 2 §10.

**OP-1: Response always precedes background writes.**
The user receives a complete response before any detection pipeline writes are persisted. Background tasks never block or delay the stream.

**OP-2: Candidates never enter the system prompt.**
No entity at `candidate` status is injected into the assistant context. Only `active` / `open` / `escalated` entities are injected.

**OP-3: Detection failures are non-fatal.**
A crash in any background detection pipeline does not fail the session. The user receives the response regardless. Detection results from the failed run are lost; no partial writes are retained from a crashed pipeline.

**OP-4: Duplicate detection writes are idempotent.**
If a detection pipeline runs twice for the same turn (e.g., due to a retry), the second run must not create a second entity. Deduplication (§5.5) is mandatory before any write.

**OP-5: Import does not override user-promoted entities.**
Import pipelines (§1.4) may create new entities but may never update an entity the user has already promoted to `active`. If an import-sourced candidate conflicts with an existing `active` entity, the candidate is discarded (or held as a supersession candidate — never silently overwriting).

**OP-6: Snooze expiry is on-read, not scheduled.**
Snoozed tensions expire when they are next read (query time), not via a background job. The sentinel date `2099-12-31T23:59:59Z` indicates indefinite snooze. All reads of `ContradictionNode` must apply the on-read expiry check before returning status.

**OP-7: Review locking is irreversible.**
Once a `WeeklyAudit` is locked, its metrics and hash are sealed. No background process or detection pipeline may mutate a locked review. The only permitted operation on a locked review is reading.

**OP-8: Escalation level is derived from evidence, not set directly.**
The `escalationLevel` field on `ContradictionNode` must be computed by `computeEscalationLevel` using the current evidence count and timestamps. Direct writes to `escalationLevel` bypassing this function are disallowed.

**OP-9: User message persisted before any other write.**
Within a single request, the user's `Message` row is written before any detection artifact. If the request fails after message write but before detection, the message is durable; detection is lost. This is acceptable.

**OP-10: All entity writes are user-scoped.**
Every entity write must include the authenticated `userId` from Clerk. Cross-user writes are disallowed. There is no concept of a "shared" entity across users in the current schema.

---

## 11. Human Override / User Control

The user is the authority on their own cognitive state. The system makes suggestions; the user decides.

### 11.1 What the User Can Always Do

- **Dismiss any candidate** without promotion. Dismissal is permanent for that candidate instance (it will not resurface from the same source event).
- **Edit any active memory** before or after creation. Edits are not versioned in the current schema (OD-debt); they overwrite in place.
- **Delete any entity** (Memory, Forecast, Tension). Deletion is soft-undoable for 5 minutes; hard-permanent after.
- **Reopen any resolved/snoozed tension** at any time. Reopening re-enters the standard escalation ladder.
- **Lock or leave unlocked any Review.** The user controls when (or whether) a weekly snapshot becomes immutable.
- **Override the assistant's characterization.** If the assistant labels something a Tension and the user disagrees, the user may dismiss the candidate and the entity is not created. The assistant's detection is advisory, not authoritative.

### 11.2 What the User Cannot Do (System Protects)

- **Unlock a locked Review.** Once `locked`, the hash is sealed. The user may create a new review for the same week (future capability) but cannot mutate the locked one.
- **Revert an import.** Bulk import creates sessions, messages, and candidate entities. Once persisted, reverting would require manual deletion. The system does not provide bulk revert. (This is a known gap — OD-debt candidate.)
- **Force a candidate to skip confirmation.** There is no "auto-promote all candidates" shortcut. Each candidate requires one explicit user action.

### 11.3 Override Audit Trail

For audit purposes, user overrides of system suggestions should be logged as metric events where practical:
- `candidate.dismissed` — user rejected a system-created candidate.
- `entity.deleted` — user deleted an active entity.
- `tension.reopened` — user re-opened a terminal tension.

These events are informational; they do not block any action.

---

## 12. Non-Goals for Operational Cognition

The following behaviors are explicitly outside the scope of this system.

**12.1 Real-time classification during streaming.**
The system does not perform entity extraction while the response is streaming. Classification happens only after the full response is available.

**12.2 Multi-turn reasoning about candidates.**
The system does not chain detection runs across turns to build a "stronger" candidate. Each detection run is independent. If recurrence across sessions is a signal, it is detected by comparing against existing entities (§5.5), not by stateful pipeline memory.

**12.3 Automatic resolution of tensions.**
The system never marks a tension `resolved` without user action. Even if all evidence points toward resolution, the system may surface a "this tension may be resolved" prompt — but the click is the user's.

**12.4 Predictive surfacing / push notifications.**
The system does not proactively alert the user that something has changed (e.g., "your snooze expired"). It surfaces current state on demand (at session start, in the context drawer, on navigation to a domain page).

**12.5 Cross-session reasoning about user intent.**
Detection pipelines operate on the current session + historical context (injected via Pinecone). They do not maintain an internal "session chain" reasoning model. Each turn is evaluated independently with historical context as reference.

**12.6 Confidence score exposure.**
Confidence thresholds are internal to the detection pipelines. Users do not see a numeric confidence score on candidates. The system either surfaces a candidate or does not.

**12.7 Competing entity graphs or versioned ontologies.**
The system maintains a single coherent entity graph per user. There is no branching, versioning, or "alternative world" model. All entities exist in one flat namespace per user.

---

## 13. Minimal Implementation Implications

The following gaps or changes to existing code are implied by this document. No changes are made in this pass.

### 13.1 Background Task Idempotency

**Gap:** current background detection (fire-and-forget after `streamText`) has no deduplication guard. If the task runs twice, duplicate candidates may be created.

**Required:** a deduplication check (§5.5) must be implemented before any detection write. At minimum, check for semantic overlap against existing entities in the same user's namespace.

### 13.2 Candidate Lifecycle

**Gap:** `ReferenceItem` and `Projection` do not have a `candidate` status field. The current schema treats all created entities as implicitly `active`.

**Required (OD-4 and general):** a `status` field on `ReferenceItem` and `Projection` with at least `candidate | active | archived` to support the staged promotion model described in this document.

### 13.3 Candidate Surfacing in Capture Panel

**Gap:** the chat capture panel shows user-initiated capture only. It has no mechanism to display system-detected candidates for user confirmation.

**Required:** the capture panel must be extended to display pending candidates with Confirm / Dismiss actions. This is the critical UI surface for the candidate model to work.

### 13.4 Evidence Auto-Link Guard

**Gap:** `POST /api/contradiction/[id]/evidence` does not verify that the target tension is `active` (not `candidate`) before writing evidence.

**Required (OP-9 complement):** the evidence route must reject writes to `candidate` tensions. Evidence can only be added to `open` or `escalated` tensions.

### 13.5 Metric Events for Override Audit

**Gap:** `candidate.dismissed`, `entity.deleted`, and `tension.reopened` metric events are not yet fired.

**Required (§11.3):** fire-and-forget `postMetricEvent` calls at each user override point. Low-priority but needed for the audit trail to be meaningful.

### 13.6 Import Candidate Isolation

**Gap:** import currently creates entities with no status field — they are effectively `active` from creation.

**Required:** import-created memories, tensions, and forecasts must be written at `candidate` status and presented to the user for review, not silently injected into the prompt from the first post-import session.

### 13.7 Snooze Expiry on All Reads

**Gap:** on-read snooze expiry (OP-6) must be applied consistently. Any query that returns `ContradictionNode` rows must apply the expiry check. If any query path returns a snoozed tension with an expired sentinel as `snoozed`, that is a surfacing bug.

**Required:** audit all query paths in `app/api/contradiction/` to confirm on-read expiry is applied. The existing `contradiction-snooze-expiry.ts` service must be called on every query result, not just the primary list endpoint.

---

## 14. Document Scope and Exclusions

This document defines operational flows and decision boundaries. It does not make code changes.

It does not define:
- The specific prompts used by detection pipelines (prompt engineering is out of scope for architecture documents).
- Numeric confidence thresholds (these are calibration decisions made during implementation).
- Database indexes or query optimization (performance is not addressed here).
- Authentication or authorization flows (Clerk handles these; they are not part of cognitive architecture).
- UI component design (covered by existing layout architecture docs).

---

## 15. Deliverable Summary

### What This Document Defines

| Section | Key Output |
|---|---|
| §1 System Entry Points | 5 entry points, each with ownership, latency budget, and promotion ceiling |
| §2 User Message Flow | 7-stage pipeline; no silent promotion; candidates created in background only |
| §3 Assistant Response Flow | 4 stages; auto-evidence only on existing active tensions; no new entity creation from output alone |
| §4 Capture Flows | 4 capture types; user-initiated capture is direct-to-active (no candidate stage) |
| §5 Detection Flows | Trigger conditions, output types, confidence thresholds, derivation runs, deduplication rules |
| §6 Surfacing Logic | 5 categories (stored-hidden → shown-on-request); injection rules; suppression rules |
| §7 Decision Boundaries | 5 decision rules (transcript vs memory, friction vs tension, note vs evidence, speculation vs forecast, auto vs wait) |
| §8 State Transitions | Automatic transitions, explicit transitions, never-silent transitions, undo windows |
| §9 Ambiguous-Case Policy | 5 ordered defaults (prefer candidate, prefer surfacing, prefer provenance, prefer specificity, prefer extension) |
| §10 Operational Invariants | 10 runtime invariants (OP-1 through OP-10) |
| §11 Human Override | What users always can do; what the system protects; override audit trail |
| §12 Non-Goals | 7 explicit exclusions from operational scope |
| §13 Implementation Implications | 7 gaps identified with required resolutions (no code changes in this pass) |

### Three Most Important Principles

1. **No silent promotion.** The system may detect and store candidates, but it may never promote any entity to `active` without user confirmation. Violations of this principle corrupt the user's cognitive model with system-generated noise.

2. **Background work is non-blocking and non-fatal.** Detection pipelines run after the response completes. They must not delay the user, and their failure must not affect the conversation. Resilience and user-responsiveness take priority over detection completeness.

3. **User intent overrides system confidence.** An explicit user capture action bypasses all confidence gates. A user dismissal of a system candidate is final. The system is advisory; the user is authoritative over their own cognitive state.

---

_Pass 3 of 3. The three passes together (Ontology → Relations/Invariants → Flows/Decisions) constitute the complete cognitive architecture specification for the current system._
