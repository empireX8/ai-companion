# Cognitive Architecture Pass 4: Retrieval, Surfacing, and Epistemic Priority Rules

_Final pass in the architecture sequence. Builds on:_
_Pass 1 (Core Ontology) · Pass 2 (Relation Rules, Invariants, Promotion Logic) · Pass 3 (System Flows, Decision Boundaries)._
_Scope: documentation only. No code changes._

---

## 1. Retrieval Layers

The system has six distinct retrieval layers. Each layer has a different temporal scope, authority level, and injection posture. They are not equally authoritative, and they are not retrieved uniformly.

---

### Layer A — Immediate Conversational Context

**Contains:** the current user message; the recent session transcript (Redis buffer, capped ~20 k chars); the immediately preceding assistant turns within this session.

**Purpose:** provide moment-to-moment coherence. The assistant must know what was said one message ago before drawing on anything else.

**When queried:** always. Every turn. No threshold.

**Injection posture:** always injected. This layer is the foundation. Nothing in other layers overrides it. If a conflict exists between Layer A and any other layer, Layer A wins by default (see §4).

**Authority:** highest. Direct, unmediated user speech has the strongest epistemic standing in the system.

---

### Layer B — Durable User Cognition

**Contains:** active `ReferenceItem` entities (memories, stable preferences, goals, constraints, patterns). These have been user-confirmed or user-captured and represent the persistent cognitive profile.

**Purpose:** give the assistant continuity across sessions. Without this layer, every conversation starts from zero.

**When queried:** every turn, with relevance filtering. Not all memories are relevant to every message; retrieval is semantic (Pinecone similarity against current message + session context). A message about cooking does not pull memories about career goals unless there is genuine overlap.

**Injection posture:** selectively injected, bounded by relevance score and a per-session cap (N items, to be defined during implementation). Not all retrieved memories are injected — only those above a relevance threshold.

**Authority:** high, but deferential to Layer A. A stored memory that contradicts a live user statement should trigger conflict handling (§5), not silent override.

---

### Layer C — Active Conflict Layer

**Contains:** `ContradictionNode` entities at `open` or `escalated` status. These are active tensions that have not been resolved, snoozed, or archived.

**Purpose:** maintain awareness of the user's live cognitive conflicts. A coherent answer to a planning question may be fundamentally incomplete if it ignores an active tension that directly bears on the plan.

**When queried:** every turn, but with selective injection (see §2). The conflict layer is always consulted; whether its contents enter the prompt depends on relevance.

**Injection posture:** selectively injected, prioritized by escalation level. Top-N tensions (by `escalationLevel` descending, then `lastEscalatedAt` descending) are candidates for injection. Not injected when the current turn is clearly unrelated to any active tension.

**Authority:** high when directly relevant. A tension that bears on the user's question should shape how the assistant frames its answer — not by resolving the tension, but by refusing to paper over it (see §6). When not relevant, kept background.

---

### Layer D — Grounding Layer

**Contains:** `EvidenceSpan` entities and `ContradictionEvidence` entities. Named sources (currently embedded in Memory/Evidence fields; future `Source` entity per OD-1). Evidence is the record of what has been observed or stated in support of claims.

**Purpose:** provide factual grounding when the assistant makes claims about the user's history, beliefs, or patterns. Evidence is what separates a well-grounded claim from an assistant paraphrase.

**When queried:** selectively, when the assistant is about to assert something about the user's past behavior, stated beliefs, or claimed commitments. Not queried for general conversation.

**Injection posture:** rarely injected directly. Evidence is most useful as a backstop — retrieved to verify whether a claim has support, not typically pasted into the prompt wholesale. Exception: when the user explicitly asks "why do you think that?" or "where did that come from?", evidence is surfaced on demand.

**Authority:** grounding evidence is stronger than unsupported memory (see §4). A claim about the user that has zero evidence backing should be hedged. A claim backed by multiple evidence spans can be stated with more confidence.

---

### Layer E — Forward-Looking Layer

**Contains:** active `Projection` (Forecast) entities. Stated expected outcomes, predictions, goals with horizons.

**Purpose:** give the assistant awareness of what the user has committed to expecting. A forecast is a cognitive stake — ignoring it when the user is planning something related is a failure mode.

**When queried:** selectively. Queried when the current turn involves planning, future-oriented reasoning, expectation-setting, or decision-making. Not queried for retrospective or present-moment conversation.

**Injection posture:** selectively injected, only when the turn is planning- or future-oriented. A user asking about a current task does not need their 6-month forecasts injected. A user asking "should I do X?" — where an active forecast bears directly — should have that forecast in the assistant's context.

**Authority:** moderate. Forecasts reflect what the user believed at capture time. They may be stale. They should inform but not constrain the assistant's response.

---

### Layer F — Reflective Layer

**Contains:** `WeeklyAudit` (Review) snapshots. Aggregate metrics, top-3 tension snapshots, density/stability scores, locked records.

**Purpose:** provide longitudinal perspective. Reviews are not moment-to-moment; they are periodic reflections on the user's overall cognitive state over a week. They answer "has anything changed across time?" rather than "what does the user want right now?"

**When queried:** rarely, and almost exclusively when the user is explicitly engaging in reflection or review. Not queried for most turns.

**Injection posture:** almost never injected directly into the model prompt. Review summaries are better surfaced as explicit read-on-demand material (the `/audit` page) than injected as background context. Exception: if the user asks "how have I been doing?" or "is this a pattern?", a brief review summary may be injected.

**Authority:** low for moment-to-moment response shaping; high for longitudinal trend claims. A review snapshot should not override current-session nuance, but it is the most reliable source for claims about trends over time.

---

## 2. Retrieval Policy

### 2.1 What Should Always Be Retrieved

| Entity | Justification |
|---|---|
| Current turn (Layer A) | Mandatory for coherence |
| Recent session transcript (Layer A) | Mandatory for continuity within session |
| Active memories — semantically relevant slice (Layer B) | Core profile; should always inform the assistant |
| Top active tensions by escalation level (Layer C) | The user's live cognitive conflicts are always relevant to know, even if not always injected |

"Always retrieved" does not mean "always injected." The conflict layer is always fetched; whether it enters the prompt is governed by §3.

### 2.2 What Should Be Retrieved Selectively

| Entity | Condition for Retrieval |
|---|---|
| Low-relevance memories (Layer B) | Only if semantic similarity to current turn exceeds threshold |
| Evidence spans (Layer D) | Only when the assistant is about to make a grounded claim about the user |
| Sources (Layer D) | Only when provenance is directly relevant to the answer |
| Forecasts (Layer E) | Only when the turn is future-oriented or planning-related |
| Review summaries (Layer F) | Only when the user is explicitly in reflection mode |

### 2.3 What Should Be Gated Behind Stronger Relevance Thresholds

- **Evidence from old sessions:** evidence more than 90 days old should require higher relevance score to enter the prompt. Old evidence may be stale or superseded by user self-correction.
- **Resolved or accepted-tradeoff tensions:** these are terminal. They should not be retrieved as if they were still active. They may be surfaced on demand (e.g., "show me resolved tensions") but should not enter the injection pool.
- **Forecast entities without a clear horizon or status:** if a forecast has no expiry and no status context, it is ambiguous whether it is still held. Inject only if clearly current (see OD-4 gap).
- **Review data older than the current week:** inject only if the user is explicitly doing longitudinal reflection.

### 2.4 What Should Almost Never Be Injected by Default

- Locked Review metrics as raw numbers (they mean little without context).
- Evidence text verbatim (usually too raw; summarized by the assistant from the evidence if needed).
- All memories regardless of relevance (the injection cap enforces this — see §13.6).
- Candidate entities of any type. Candidates are surfaced in the UI; they do not enter the model context.
- Archived or terminal entities unless explicitly requested by the user.

---

## 3. Surfacing vs. Injection

These are four distinct states an entity can be in at response time:

| State | Definition |
|---|---|
| **Retrieved** | Fetched from DB/Pinecone in the current turn's context assembly pass |
| **Injected** | Included in the model's system prompt for this turn |
| **Surfaced** | Made explicitly visible to the user (in UI: capture panel, context drawer, notifications) |
| **Background only** | Fetched and available to the system for conflict checking, but not injected and not shown |

### 3.1 Memory (ReferenceItem)

| State | When |
|---|---|
| Retrieved | Every turn (semantic top-N against current message) |
| Injected | When relevance score exceeds threshold AND within injection cap |
| Surfaced | When the assistant references a memory explicitly, or user opens the memory panel |
| Background only | When retrieved but below relevance threshold, or when injection cap is full |

**Key rule:** a memory that is retrieved but not injected is not wasted — it informs the conflict-checking pass (§5) without cluttering the prompt.

### 3.2 Tension (ContradictionNode)

| State | When |
|---|---|
| Retrieved | Every turn (all active/escalated tensions for this user) |
| Injected | When semantically relevant to the current turn AND escalation level ≥ threshold |
| Surfaced | When injected and the assistant explicitly references it; also always visible in context drawer |
| Background only | When retrieved but not relevant to the current turn; still checked for conflicts |

**Key rule:** a tension should never be injected just because it exists. It is injected when the current conversation is actively in territory the tension covers. Tension overload creates fatigue; restraint is essential (see §7).

### 3.3 Evidence (EvidenceSpan / ContradictionEvidence)

| State | When |
|---|---|
| Retrieved | When the assistant is about to assert a claim about the user's history or patterns |
| Injected | Rarely. When the specific evidence span is the answer (e.g., "you said X on 2024-03-01") |
| Surfaced | On demand (user clicks "show evidence" on a tension; evidence panel on detail pages) |
| Background only | Default. Evidence grounds the system's confidence without appearing in the prompt |

**Key rule:** evidence is a backstop for the system's epistemic confidence, not a citation list in every answer. Its presence justifies the assistant's tone; its content rarely needs to be quoted.

### 3.4 Source

| State | When |
|---|---|
| Retrieved | When the memory or evidence it backs is retrieved |
| Injected | Almost never; source attribution is metadata, not content |
| Surfaced | On demand (detail pages; "where does this come from?" queries) |
| Background only | Default |

**Key rule:** source labels should not be used as decorative credibility. A source is only meaningful if its content actually grounded the associated entity. Injecting source names without content is noise.

### 3.5 Forecast (Projection)

| State | When |
|---|---|
| Retrieved | On planning/future-oriented turns |
| Injected | When directly relevant to the user's current question or decision |
| Surfaced | When the assistant references a forecast, or user navigates to forecasts list |
| Background only | All other turns |

**Key rule:** a forecast should not shape the assistant's answer unless the current question is genuinely about expectations, planning, or outcomes. Injecting forecasts into present-moment or retrospective conversations is a relevance failure.

### 3.6 Review (WeeklyAudit)

| State | When |
|---|---|
| Retrieved | On explicit reflection turns or trend-pattern questions |
| Injected | Only as a brief summary when user is in longitudinal reflection mode |
| Surfaced | Primarily via the `/audit` page; not chat-native by default |
| Background only | All standard turns |

**Key rule:** the Review layer exists for the user to engage with directly, not for the assistant to constantly reference. It is a structured artifact, not a live context signal.

---

## 4. Priority Hierarchy

This is the most important section in this document. When multiple cognitive signals are available and they compete or conflict, this hierarchy defines what wins.

### 4.1 Full Priority Ordering (Most Authoritative → Least)

```
1. Direct live user statement (Layer A — current turn)
2. Recent session context (Layer A — same session transcript)
3. Active user correction of a stored belief (Layer A overriding Layer B)
4. Evidence-grounded active memory (Layer B + Layer D, supported)
5. Active tension (Layer C) when directly topically relevant
6. Unsupported active memory (Layer B, no evidence backing)
7. Active forecast (Layer E)
8. Candidate entity (any type — surfaced only, never injected)
9. Evidence/source grounding for Layer D claims
10. Weekly Review snapshots (Layer F)
11. Assistant-generated abstractions (not stored as entities)
```

This ordering is not a strict total ordering for all cases — the domain of the question mediates it (§8). But it is the baseline when no domain-specific rule applies.

### 4.2 Specific Comparisons

**Recent direct user statement vs. older stored memory**

The direct statement wins, always. If the user says "actually, I've changed my mind about X", that supersedes whatever Memory stored about X regardless of how many evidence spans backed the old belief. The user's live voice outranks their historical record. The system should update or flag the memory (see §5), not defend it.

**Active (user-confirmed) memory vs. low-confidence candidate memory**

Active memory wins. A candidate has not cleared the user-confirmation gate. It should not outrank, contradict, or supplement a confirmed memory in prompt injection. Candidates are shown in the capture panel UI; they do not compete with confirmed entities in the cognitive stack.

**Evidence-grounded claim vs. unsupported memory**

Evidence-grounded claim wins. A memory with one or more evidence spans is materially more reliable than one captured in isolation. When the two conflict (different statements of the "same" fact), the evidence-grounded version should be preferred and the discrepancy surfaced.

**Active tension vs. smooth background memory**

Context-dependent. If the current turn directly touches the tension domain: the tension takes priority — the assistant should not provide a seamlessly smooth answer that implicitly resolves a tension the user is actively experiencing. If the current turn is unrelated: the tension stays background. Do not inject irrelevant tensions to seem thorough.

**Explicit user correction vs. existing stored belief**

Correction wins completely. This is not a competition. An explicit "that's not right" or "I don't think that anymore" is a hard override. The system should immediately treat the stored belief as superseded (candidate for update), not re-surface it later in the same session.

**Source-backed evidence vs. assistant-generated paraphrase**

Source-backed evidence wins. The assistant may paraphrase, summarize, or synthesize — but when the user asks for grounding, raw evidence and named sources outrank the assistant's interpretation of them. The assistant's abstraction is downstream of evidence, not equivalent to it.

**Current session context vs. historical profile**

Session context wins for immediate behavior and stated preferences. Historical profile provides continuity and background. The failure mode to avoid: letting a rich historical profile make the assistant assume it knows what the user wants in the current session. Each session starts from Layer A; profile enriches it, does not replace it.

### 4.3 When the Ordering Reverses (Exceptions)

- **User is explicitly in reflection mode:** the user has navigated to `/audit` or is asking about patterns over time. In this context, Layer F (Review) rises in priority because the user is specifically engaging with longitudinal perspective, not moment-to-moment context.
- **User is asking about a past statement:** if the user asks "didn't I say X before?", the historical profile (Layer B) and evidence (Layer D) temporarily dominate over current-session context, because the user is asking about history.
- **Deep mode is active:** retrieval breadth increases, but the priority ordering within retrieved material does not change. More is retrieved; nothing changes which of the retrieved signals takes precedence.

---

## 5. Conflict-Handling Rules

Conflicts arise when retrieved signals disagree. Each class of conflict has a defined handling policy.

### 5.1 Current User Statement Conflicts with Stored Memory

**Example:** the assistant retrieved a memory "I prefer async communication" but the user just said "I'm trying to be more proactive about direct calls."

**What wins:** the current statement (see §4.2).

**What to surface:** if the discrepancy is significant, the assistant may acknowledge it lightly ("that's a shift from what you said before — noted"). It should not interrogate the user.

**Entity action:** flag the stored memory as a candidate for supersession. Do not auto-update the memory in the same turn. Surface a candidate update in the capture panel. User confirms if they want to replace or add.

**Response posture:** answer based on the current statement. Do not hedge by averaging the old and new positions.

---

### 5.2 Forecast Conflicts with Active Memory

**Example:** a stored memory says "I'm committed to staying in my current role for 2 years" but an active forecast says "I expect to transition to a new role within 6 months."

**What wins:** neither automatically. Both are stored user-stated positions, potentially from different times. This is itself a tension candidate.

**What to surface:** if the current turn is about career planning, the assistant should surface this conflict explicitly ("you've expressed both X and Y — it might be worth clarifying which reflects your current thinking").

**Entity action:** if the assistant surfaces this and the user engages, the background pass should create a `candidate` tension for the conflict, or add evidence to an existing tension if one already covers this domain.

**Response posture:** do not resolve the conflict for the user. Frame it as an open question they can address.

---

### 5.3 Evidence Conflicts with a Source Summary

**Example:** a source summary (abstracted) says "book X recommends Y approach" but an evidence span from a prior conversation shows the user explicitly rejected approach Y.

**What wins:** the evidence span (direct user statement) over the source summary (external attributed claim). The user's own experience and stated positions outrank attributed external sources.

**What to surface:** the assistant should not present the source summary as though it applies unambiguously. Hedge: "book X recommends Y, though you've found that hasn't worked for you in the past."

**Entity action:** none automatically. The conflict is handled at response-generation time, not promoted to a new entity.

**Response posture:** acknowledge both, give priority to user's direct experience, do not dismiss the source.

---

### 5.4 Source Conflicts with User Self-Report

**Example:** an external source (cited framework) says success requires trait X; the user's self-report says they lack trait X but succeed anyway.

**What wins:** user self-report. External sources are attributed beliefs, not ground truth about the user's life.

**What to surface:** if relevant, the assistant can name the tension between the framework and the user's experience, framing it as informative rather than invalidating.

**Entity action:** this pattern is a candidate for a Tension creation if it recurs. Single-occurrence discrepancies do not auto-create tensions.

**Response posture:** validate user self-report; use the external source as context, not override.

---

### 5.5 Active Tension Conflicts with a Neat Assistant Answer

**Example:** the user asks "what should I do about X?" and the clean answer exists — but an active tension directly bears on X and remains unresolved.

**What wins:** the tension takes priority over the neat answer. Providing a smooth resolution that ignores an active tension the user is experiencing is a coherence failure. The assistant must not paper over it.

**What to surface:** the tension, framed helpfully — "there's a pull in two directions here that you've been sitting with: [tension summary]. The answer probably depends on how you resolve that."

**Entity action:** if the user's message added new information that bears on the tension, the background pass may add evidence to the tension.

**Response posture:** acknowledge the tension explicitly. Offer structured consideration rather than a false resolution.

---

### 5.6 Review Snapshot Paints a Different Picture Than Current Session

**Example:** the weekly review shows high stability and low tension density, but the current session is full of conflict and uncertainty.

**What wins:** the current session (Layer A) for immediate response. The review is a trailing indicator, not a real-time state.

**What to surface:** if the user is in reflection mode and asks about patterns, it may be worth noting the discrepancy — "your recent week scores showed stability, but this conversation has a different texture."

**Entity action:** if the discrepancy is extreme and recurrent, it may indicate that the Review metrics are not capturing something. No automatic entity creation.

**Response posture:** trust the live session; treat the review as context, not correction.

---

## 6. Response-Shaping Policy

This defines how the different retrieval layers are *allowed* to reshape the assistant's reply, and how aggressively.

### 6.1 When Memory Should Steer Tone or Assumptions

Memory may steer tone when it reflects stable, confirmed preferences — communication style, cognitive mode, known constraints. The assistant may open with fewer caveats if memory confirms the user prefers directness. It may ask fewer clarifying questions if memory fills in background context.

Memory should **not** steer the assistant to assume outcomes. Knowing the user prefers independence does not mean the assistant assumes they want to be left alone in this specific conversation.

**Aggressiveness: moderate.** Memory provides priors; it does not dictate conclusions.

### 6.2 When Tensions Should Be Surfaced Explicitly

A tension should be surfaced explicitly when:
- The user's question directly bears on the tension domain.
- The clean answer would implicitly resolve a tension the user hasn't resolved themselves.
- The user appears to be in a decision point where the tension is the crux.

A tension should stay background when:
- The current turn is unrelated to the tension's domain.
- The user has already acknowledged the tension in this session and is working with it.
- Surfacing the tension would interrupt a simple request with unnecessary weight.

**Aggressiveness: selective.** Tensions are surfaced at decision points, not reflexively.

### 6.3 When Evidence/Source Grounding Should Appear in the Answer

Evidence grounding should appear when:
- The assistant is making a specific claim about the user's history ("you've said before...").
- The user asks "where does that come from?" or "how do you know that?"
- The claim would be materially weakened without grounding.

Evidence should not appear when:
- The conversation is exploratory and citation would feel clinical.
- The evidence would overwhelm the actual answer.
- The claim is low-stakes and conversational.

**Aggressiveness: low by default.** Ground when it improves the answer; stay light otherwise.

### 6.4 When Forecasts Should Matter

Forecasts should shape the response when:
- The user is making a plan that directly relates to a stored forecast.
- The user asks about expected outcomes.
- A forecast creates a constraint (e.g., "by this date, I expect to have done X") that bears on current decisions.

Forecasts should not shape the response when:
- The user is asking about the present or past.
- The forecast is stale (no status, no horizon, stored long ago — OD-4).
- The current question is unrelated to expectations or outcomes.

**Aggressiveness: contextual.** Forecasts are consequential only when the user is operating in forward-looking mode.

### 6.5 When Reviews Should Influence the Answer

Reviews should influence the answer when:
- The user explicitly asks about trends, patterns, or their cognitive state over time.
- The user is in reflection mode (navigating `/audit`, asking "how am I doing?").
- A specific metric from a review directly answers the user's question.

Reviews should not influence the answer when:
- The user is doing normal task-focused work.
- The current session has more up-to-date signal than the review.
- Injecting the review would shift the response from present-tense to analytical mode when the user wants practical help.

**Aggressiveness: low.** Reviews are reference artifacts, not active guides.

### 6.6 When to Stay Narrow and Ignore Broader System Context

The assistant should stay narrow when:
- The user is asking a simple, direct question with a clear answer that needs no profile context.
- The user has explicitly asked for brevity or directness.
- The injected context is not meaningfully relevant to the question at hand.
- Adding context would lengthen the answer without improving it.

**Restraint is a feature.** An assistant that always draws on its full cognitive context becomes exhausting. The user's immediate intent is the primary guide; the system context enriches it, not replaces it.

---

## 7. Relevance and Restraint Rules

The following rules protect against the failure modes of an over-coupled cognitive system.

### R-1: Relevance Before Completeness

Inject what is relevant to *this turn*, not everything that is technically available. Completeness is not a goal; coherent, grounded, useful responses are. The retrieval system should optimize for relevance, not coverage.

### R-2: Tension Surfacing Is Proportional, Not Compulsive

A tension should surface when the current turn enters its domain, not in every response. If there are five active tensions and none of them bear on a question about scheduling, none of them appear. Tensions are flags, not mantras.

### R-3: Grounding Is Earned, Not Decorative

Evidence and sources should appear in responses when they actually improve the answer — when they add specificity, challenge a vague claim, or answer a provenance question. Using evidence as decoration ("as the evidence shows...") without it doing meaningful work is a form of false authority.

### R-4: The User's Immediate Intent Is Central

All retrieval enrichment is subordinate to what the user is actually asking for right now. If a memory, tension, or forecast is not helping the user's immediate question, it should not appear in the response regardless of how high it ranks in the system.

### R-5: Unresolved Conflict Should Be Named Once, Not Repeated

When a tension is relevant and surfaced, it should be named clearly — once. The assistant should not re-surface the same tension across multiple turns in a session unless the user re-engages with it. Repeatedly flagging the same unresolved conflict creates anxiety rather than clarity.

### R-6: Older Signals Should Decrease in Weight

A memory captured 18 months ago is a weaker signal than one captured last week. A forecast with no horizon is weaker than one with a stated date. The system should apply a recency weight to retrieval scoring, not treat all stored entities as equally current.

### R-7: History Is Context, Not Script

The stored cognitive profile is a record of what has been true, not a mandate for what must be true. The assistant should use profile data to enrich and contextualize responses, never to constrain or predict the user's current intentions.

### R-8: Candidate Entities Are Invisible to Response Generation

Candidates are shown in the UI capture panel. They do not enter the model prompt. They do not influence tone, assumptions, or claims. A candidate has not cleared the user-confirmation gate; treating it as confirmed would be a protocol violation.

---

## 8. Priority by Task Type

The retrieval priority ordering in §4 is the baseline. This section defines task-type overrides — how the system should bias retrieval when it can infer what the user is doing.

### A. Simple Factual / Direct Question

**Examples:** "what's the capital of X?", "how do I do Y in Z language?", "remind me what we decided about X."

**Prioritize:** Layer A (current conversation + transcript for "remind me" questions).
**Background:** everything else.
**Ignore unless strongly relevant:** tensions, forecasts, reviews.

**Rule:** do not enrich a simple factual question with the full cognitive profile. Answer directly. Only pull from the profile if the question is about the user's own history or stated preferences.

---

### B. Personal Advice / Self-Understanding Question

**Examples:** "am I being too hard on myself?", "why do I keep doing X?", "what do you know about how I tend to approach this?"

**Prioritize:** Layer B (durable memories), Layer C (active tensions related to the domain), Layer D (evidence grounding any claims made about patterns).
**Background:** Layer A (provide current context), Layer E (forecasts if the question has a forward dimension).
**Ignore:** Layer F unless trends are explicitly being asked about.

**Rule:** this is the highest-value use case for the full cognitive stack. Memories and tensions are both relevant; evidence backs up pattern claims. Response should be substantive and grounded, not just reflective.

---

### C. Conflict / Tension Question

**Examples:** "I keep going back and forth on this", "I feel stuck between X and Y", "I can't decide."

**Prioritize:** Layer C (all directly relevant tensions), Layer D (evidence that bears on the sides of the conflict), Layer B (memories that ground each side).
**Background:** Layer A.
**Inject:** the active tension if one exists for this domain. If no tension exists yet, this is a strong candidate for tension creation.
**Ignore:** forecasts and reviews unless the conflict is about future outcomes or patterns.

**Rule:** the goal is not to resolve the conflict for the user. The goal is to surface the structure of the conflict clearly, grounded in what has been said and stored, and help the user see their own positions more clearly.

---

### D. Planning / Future-Oriented Question

**Examples:** "should I take this opportunity?", "how should I approach next quarter?", "what are my options for X?"

**Prioritize:** Layer E (active forecasts), Layer B (memories that set constraints or goals), Layer C (tensions that would affect the plan).
**Background:** Layer A.
**Consider injecting:** a relevant forecast as an explicit "you've committed to expecting X — does that change this?"
**Ignore:** reviews unless pattern trends are explicitly relevant.

**Rule:** planning questions benefit from forecasts and constraints being explicit. Help the user see the cognitive context of their plan, not just the tactics.

---

### E. Review / Reflection Question

**Examples:** "how have I been doing lately?", "what patterns have come up?", "am I making progress on the things I care about?"

**Prioritize:** Layer F (Review snapshots), Layer C (tension trends — have open tensions changed?), Layer B (memory evolution — have stated preferences shifted?).
**Background:** Layer A (provides framing but is not the answer).
**Consider injecting:** brief review metric summary if recent review is available.

**Rule:** this is the primary (and nearly exclusive) use case for Layer F injection. Review data is meaningful here; it is a distraction everywhere else.

---

### F. Clarification of Prior Conversation

**Examples:** "wait, what did you mean by X?", "can you say more about what you said earlier?", "I thought you said Y."

**Prioritize:** Layer A (transcript of current session), then recent session history.
**Background:** everything else.
**Do not inject:** profile memories or tensions unless the clarification specifically touches them.

**Rule:** clarification is a transcript retrieval task. Do not reach into the durable profile to answer "what did you just say." The answer is in the session, not in stored entities.

---

## 9. Epistemic Caution Rules

These rules govern how confidently the system should speak based on the strength of its backing.

### EC-1: Unsupported Memory Does Not Outweigh Direct Correction

A memory with no evidence backing is a weak claim about the user's past state. If the user directly contradicts it, the memory loses immediately. The assistant should not defend an unsupported stored belief.

### EC-2: Age Degrades Confidence

Old memories should be spoken with lower confidence than recent ones. If the system retrieved a memory from 18 months ago with no corroborating evidence, the assistant should hedge: "you've mentioned before..." rather than "you believe..."

### EC-3: A Source Summary Is Not Stronger Than Direct Evidence Spans

A named external source is an attribution, not evidence about the user. Direct evidence spans (what the user actually said in a recorded session) are stronger ground for claims about the user than any external source attribution.

### EC-4: Review Snapshots Are Trailing Indicators

A weekly review score is an aggregate from the past week. It is not a statement about the user's current state. The assistant should not use a review score to override or correct what the user is saying in the current session. "Your stability score was 0.82 last week" is context; it is not a claim about who the user is right now.

### EC-5: Forecasts Do Not Confer Certainty

A stored forecast is what the user believed they expected at capture time. It is not a commitment, a promise, or a prediction with independent validity. The assistant should hold forecasts as expressions of intent or expectation — not as evidence that something is likely to happen. Never let a forecast sharpen an otherwise uncertain claim into a confident one.

### EC-6: Tension Existence Does Not Imply Ongoing Experience

An active tension in the system reflects a conflict that was detected or confirmed at some point. It does not mean the user is feeling that conflict in this turn. The assistant should not project emotional experience from stored tensions onto the current moment without a live signal from the current session.

### EC-7: Candidate Entities Have Zero Epistemic Standing

Candidates are hypotheses. They have not been confirmed. They must not be spoken about as though they are facts about the user, even internally in the system's reasoning. If a candidate tension exists and the user's turn is related to its domain, the assistant may choose to probe gently — it must not assert the candidate as established.

### EC-8: The System's Own Abstractions Are the Weakest Form of Evidence

Abstractions generated by the assistant or detection pipelines (summaries, pattern characterizations, tension titles) are derived products. They are downstream of evidence, not independent evidence. If the user challenges an abstraction, the challenge is settled by returning to the underlying evidence, not by defending the abstraction.

---

## 10. Operational Retrieval Invariants

**RT-1: Candidates are never injected.**
No entity at `candidate` status enters the model system prompt. Violation of this rule means unconfirmed hypotheses shape the assistant's behavior, corrupting epistemic integrity.

**RT-2: Direct user correction outranks all stored signals.**
When the user explicitly corrects the assistant, the correction is immediately treated as authoritative. No re-surfacing of the corrected belief in the same session.

**RT-3: Provenance must be preserved through retrieval.**
Retrieved entities must carry their `sessionId`, `createdAt`, and status through to the response-shaping layer. Retrieval must not strip this metadata. Provenance grounds confidence assessment (EC-2, EC-3).

**RT-4: Surfacing must not imply truth-status beyond what the entity warrants.**
If the assistant surfaces a candidate ("it looks like you might be working toward X"), the framing must reflect its candidate status. If it surfaces an active memory, the framing may be more confident. The grammar of surfacing should match the epistemic standing of the entity.

**RT-5: Evidence and source usage must remain traceable.**
When evidence or a source grounds a claim, the system must be able to identify which entity provided that grounding. Mixing evidence from multiple entities into an unattributed claim is a provenance failure.

**RT-6: Injection must be relevance-constrained and bounded.**
No retrieval layer has unlimited injection capacity. Each layer contributes at most N items per turn, gated by relevance. The total injected context must not grow without bound across sessions.

**RT-7: Terminal entities are excluded from retrieval injection.**
Resolved, archived, accepted-tradeoff, and hard-deleted entities are not candidates for injection. They may be surfaced on explicit user request (detail pages, history views) but do not enter the active cognitive stack.

**RT-8: Retrieval does not modify entities.**
The retrieval pass is read-only. Entity creation, update, and status changes happen only in the write paths (§2 background pass, §4 explicit capture). Reading an entity does not change it.

**RT-9: Retrieval must respect snooze status.**
A snoozed tension is excluded from injection. On-read expiry (Pass 3 OP-6) must be applied before the entity is considered for injection. An expired snooze surfaces the tension; an active snooze hides it.

**RT-10: Per-session retrieval state is not persisted.**
What was retrieved in turn N does not automatically carry over to turn N+1. Each turn assembles context fresh (Pass 3 §6.4). Retrieval decisions in one turn do not constrain retrieval decisions in the next.

---

## 11. Disallowed Retrieval Behaviors

These are retrieval and surfacing behaviors the system must not perform, stated explicitly.

**Inject every available memory, all the time.**
Even with a large memory store, injection must be capped and relevance-filtered. An ever-growing context injection degrades coherence and makes the system's behavior opaque.

**Surface tensions in every answer regardless of topical relevance.**
A response to "can you summarize this article?" does not need the user's active tensions. Irrelevant tension surfacing creates noise and trains the user to dismiss the signal.

**Treat all stored entities as equally authoritative.**
Entity status, age, evidence backing, and origin all affect authority. A candidate from yesterday is not equivalent to a user-confirmed memory from last year. The system must differentiate.

**Let Review summaries overwrite current live context.**
A weekly aggregate score does not cancel out what the user is expressing in the current session. Reviews are trailing indicators; they should contextualize, not override.

**Allow assistant-generated abstractions to outrank direct user statements.**
The assistant summarizes and characterizes — but those abstractions are derived products. If the user says their own experience is different from the assistant's characterization, the user wins.

**Use evidence or source labels as decorative credibility.**
Citing "evidence shows..." when the evidence is vague, stale, or tangentially related is a false-grounding behavior. Sources and evidence must do actual work when invoked.

**Inject terminal entities as if they were active.**
A resolved tension, archived memory, or completed forecast does not belong in the injection context. Injecting them implies they are still live, which would misinform the assistant's response.

**Surface candidates in the model context.**
Candidates belong in the UI capture panel. They have not been confirmed. Injecting them gives them the same standing as confirmed entities, which violates the staged promotion model.

**Suppress retrieved conflicts to deliver a smoother answer.**
If a retrieved tension or conflicting memory is relevant and the user's question touches its domain, the system must not quietly discard it to produce a cleaner response. Coherence is not the same as accuracy. Surfacing conflict is a feature.

**Blend evidence from multiple entities without attribution.**
If the assistant draws on evidence from two different sessions to make a composite claim, each source must remain traceable. Blending loses provenance and degrades epistemic reliability.

---

## 12. Ontology Debt Implications for Retrieval

The ontology debts identified in Pass 2 (OD-1 through OD-6) each have specific retrieval consequences.

### OD-1: Memory vs. Source Ambiguity

**Current state:** `ReferenceItem` conflates two distinct entity types — a durable user-held belief (Memory) and an external attribution (Source). Both are stored in the same table with no type distinction.

**Retrieval risk:** the system cannot differentiate injection priority between "this is what the user believes" (high authority) and "this is from a book the user mentioned" (lower authority). Without the split, all `ReferenceItem` entities are treated as equivalent, which violates §4.2 (source-backed evidence vs. user self-report ordering).

**Retrieval priority implication:** Memory and Source have *different* retrieval roles. Memories are injected to inform the assistant's assumptions. Sources are retrieved for grounding claims, but are secondary to user self-report.

**Can this stay deferred?** Not indefinitely. As the memory store grows, mixed Memory/Source retrieval will produce noisy injections. Resolution becomes more urgent as retrieval volume increases. Short-term mitigation: use a `sourceType` field or naming convention within `ReferenceItem` to distinguish them for retrieval scoring purposes.

### OD-2: Dual Evidence Systems

**Current state:** `EvidenceSpan` and `ContradictionEvidence` are separate models. `EvidenceSpan` is a general evidence record; `ContradictionEvidence` is tension-specific.

**Retrieval risk:** a query for "all evidence relevant to this domain" must hit two tables. There is no unified evidence retrieval surface. Worse, priority rules (§4, §9) treat evidence as a single tier — but the system cannot implement that cleanly with two disparate models.

**Retrieval priority implication:** evidence grounding (Layer D) cannot be evaluated uniformly across entity types without joining both tables. This creates a practical gap between the priority hierarchy and its implementability.

**Can this stay deferred?** For now, with awareness that any evidence-backed priority logic (EC-3, RT-5) is partially broken until unification. Medium-term priority.

### OD-3: Tension vs. Contradiction Naming Precision

**Current state:** the DB model is `ContradictionNode`; the UI uses "Tension." This creates a surface-level inconsistency but does not affect retrieval logic, as the entity is unambiguous in the schema.

**Retrieval risk:** minimal. The mismatch is cosmetic for retrieval purposes.

**Can this stay deferred?** Yes. Low priority for retrieval correctness.

### OD-4: Forecast Lifecycle Gap

**Current state:** `Projection` has no `status` field. All forecasts are implicitly active; there is no `candidate`, `expired`, or `superseded` state.

**Retrieval risk:** the retrieval policy (§2.3) says forecasts with no status should be gated behind stronger thresholds. Without a status field, the system cannot distinguish a current forecast from a stale one programmatically. All forecasts are equally retrievable.

**Retrieval priority implication:** the forward-looking layer (Layer E) cannot implement recency weighting or status filtering without a `status` field. Injecting stale forecasts into planning conversations creates false context.

**Can this stay deferred?** Not for long. This is the highest-priority retrieval gap. A `status` field on `Projection` is needed to make forecast injection safe.

### OD-5: Review vs. Audit Internal Naming

**Current state:** the DB model is `WeeklyAudit`; the UI uses "Review." Same situation as OD-3.

**Retrieval risk:** none. Cosmetic inconsistency.

**Can this stay deferred?** Yes.

### OD-6: Rung / Level Conflation

**Current state:** `ProbeRung` enum and `escalationLevel` integer are two distinct internal concepts, collapsed to "Level N" in the UI. Retrieval of tensions uses `escalationLevel` for priority ordering.

**Retrieval risk:** mild. As long as retrieval consistently uses `escalationLevel` (the integer) for ordering and `ProbeRung` is treated as a display enum, there is no conflict. The risk materializes if retrieval code accidentally sorts by `recommendedRung` (string/enum) instead of `escalationLevel` (integer).

**Can this stay deferred?** Yes, with the caveat that retrieval priority for tensions must explicitly use `escalationLevel` for numerical ordering.

---

## 13. Minimal Implementation Implications

These are the pressures this architecture creates on future implementation. Not a task list; future architecture constraints.

**Retrieval scoring fields.** The priority hierarchy (§4) requires comparing entities across layers. Currently there is no per-entity relevance score stored. Context assembly must compute relevance at query time (semantic similarity, recency, escalation level). As volume grows, pre-computed scoring fields will be needed.

**Source/Memory type split becomes retrieval-urgent.** OD-1 blocks clean implementation of the §4.2 priority ordering between user self-report and external sources. A `kind` field on `ReferenceItem` (e.g., `"memory" | "source"`) is the minimum viable resolution.

**Evidence unification becomes retrieval-urgent.** OD-2 blocks unified Layer D retrieval. A join query or a unified `Evidence` view is needed before the grounding layer can work correctly across all entity types.

**Forecast status field is needed now.** OD-4 means Layer E (§1, §2.3) cannot be correctly implemented. A `status` field on `Projection` is the most urgent schema change implied by this document.

**Candidate/active distinction must be preserved in retrieval APIs.** Any retrieval endpoint that does not filter by `status` will return candidates alongside active entities, breaking RT-1. All retrieval paths must default to excluding `candidate` status unless explicitly requested.

**Per-layer injection caps must be explicit.** The "bounded injection" requirement (RT-6) implies named constants in context assembly: `MAX_MEMORIES_INJECTED`, `MAX_TENSIONS_INJECTED`, etc. These do not exist yet and must be introduced before retrieval volume makes prompt size unpredictable.

**On-read expiry must cover all retrieval paths.** Pass 3 OP-6 noted this; it recurs here because retrieval from Layer C (tensions) in any context — not just the primary list endpoint — must apply the snooze expiry check before considering a tension for injection (RT-9).

---

## 14. Scope and Exclusions

This document does not make code changes. It does not:

- Define specific prompt templates or injection formatting.
- Define numerical relevance thresholds (calibration happens during implementation).
- Define `MAX_MEMORIES_INJECTED` or similar constants (these are implementation-time decisions).
- Redesign Standard/Deep mode (that is a separate operational layer above this one).
- Address performance optimization, caching, or query planning.
- Cover multi-user or shared-context scenarios (the system is strictly per-user).

---

## 15. Deliverable Summary

### File Created

`docs/cognitive-architecture-pass-4.md`

---

### Retrieval Layers

| Layer | Contains | Default Posture |
|---|---|---|
| A — Immediate Context | Current turn, session transcript | Always injected |
| B — Durable Cognition | Active memories, preferences, constraints | Selectively injected (relevance-filtered) |
| C — Active Conflict | Open/escalated tensions | Retrieved always; injected selectively |
| D — Grounding | Evidence spans, sources | Retrieved on-demand; rarely injected |
| E — Forward-Looking | Active forecasts | Retrieved on planning turns only |
| F — Reflective | Weekly reviews, snapshots | Retrieved on explicit reflection; almost never injected |

---

### Priority Hierarchy (Most → Least Authoritative)

1. Direct live user statement (Layer A, current turn)
2. Recent session context (Layer A, same session)
3. Active user correction of stored belief
4. Evidence-grounded active memory (Layer B + D)
5. Active tension when directly topically relevant (Layer C)
6. Unsupported active memory (Layer B)
7. Active forecast (Layer E)
8. Candidate entities (UI only, never injected)
9. Evidence/source grounding for Layer D claims
10. Weekly Review snapshots (Layer F)
11. Assistant-generated abstractions

---

### Key Conflict-Handling Rules

- User statement vs. stored memory → user statement wins; memory flagged for supersession candidate
- Forecast vs. active memory → neither wins; surface as tension candidate if not already tracked
- Evidence vs. source summary → direct evidence wins; source is secondary attribution
- Source vs. user self-report → user self-report wins
- Active tension vs. neat answer → tension must be surfaced; system must not paper over it
- Review snapshot vs. current session → current session wins; review is trailing context only

---

### Key Restraint Rules

- Relevance before completeness (R-1)
- Tension surfacing is proportional, not compulsive (R-2)
- Grounding is earned, not decorative (R-3)
- User's immediate intent is central (R-4)
- Unresolved conflict surfaced once per session, not repeatedly (R-5)
- Older signals carry less weight (R-6)
- History is context, not script (R-7)
- Candidate entities are invisible to response generation (R-8)

---

### Most Important Disallowed Retrieval Behaviors

1. Injecting every available memory regardless of relevance
2. Surfacing tensions in every answer regardless of topical connection
3. Treating all stored entities as equally authoritative
4. Letting Review summaries overwrite current live context
5. Allowing assistant-generated abstractions to outrank direct user statements
6. Using evidence/source labels as decorative credibility without actual grounding
7. Injecting candidate entities into the model context
8. Suppressing retrieved conflicts to produce a smoother answer

---

### Code Changes

None. Documentation-only pass.

---

_Pass 4 of 4. The complete architecture sequence:_
_Pass 1 — What are the core entities?_
_Pass 2 — How are they connected, constrained, and promoted?_
_Pass 3 — How does cognition move through the system?_
_Pass 4 — When signals compete, which ones win and why?_
