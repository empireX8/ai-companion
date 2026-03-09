# Product Behavior / Guided Cognition Pass — Planning Document

**Status:** Planning only. No code changes in this document.
**Preceded by:** Foundation Stabilization Pass (ontology, lifecycle, candidate semantics, injection gating, profile artifact dormancy)
**Followed by:** Implementation packets derived from this document

---

## Phase Goal

Define how the product should feel and behave in live use now that the foundation is stable.

The foundation pass established what things *are* — memory, tension, forecast, candidate, source, each with a clean lifecycle and correct injection semantics. This pass defines what things *do* — how the assistant speaks, when it uses what it knows, what the user understands and when, and where the product currently feels incomplete or untrustworthy.

---

## What This Phase Is

- A behavioral and UX design definition for the live product
- A set of tone and interaction rules for the assistant
- A legibility audit for each product surface
- A roadmap for the next implementation packets
- A source of truth for product decisions that have not yet been made explicitly

## What This Phase Is Not

- A schema change
- An ontology redesign
- A performance optimization
- A philosophical re-evaluation of what memory or tension means
- A new feature category introduction

## Why It Comes After Stabilization

The foundation pass was necessary first because product behavior depends on correct semantics. Before candidates were properly gated, before injection was relevance-gated, before dismissed memories were semantically distinct from inactive ones, it was impossible to define behavior rules without those rules being violated silently by the infrastructure. Now that:

- candidates never enter the prompt without user confirmation
- memory injection is relevance-scored and capped
- tensions are relevance-gated before injection
- forecasts only enter prompt when relevant
- dismissed items are semantically isolated
- ProfileArtifact creation is dormant (not wiring a shadow system)

...it is safe to define exactly how the product should behave on top of that stable base.

---

## Core Product Questions

### How should chat feel?

The chat should feel like talking to someone who remembers you well but isn't constantly announcing it. The assistant should use what it knows *within* responses — shaping its framing, asking more pointed questions, avoiding things already settled — without narrating the retrieval process. It should not feel like a database lookup service.

The modal register should be warm, direct, and collaborative. Not clinical. Not sycophantic. Not preachy about its own capabilities.

When memory shapes a response, the response should feel *better*, not *different*. The user should notice that the assistant already gets the context, not that the assistant is performing memory retrieval.

### When should memory shape a response?

Memory should shape a response when:
- The user is asking something where stored preferences, goals, or constraints are directly relevant
- The user is navigating a decision that their stored goals bear on
- The user expresses something that contradicts a stored item (tension opportunity, not a correction lecture)
- The user asks something where a past pattern predicts the question behind the question

Memory should *not* shape a response when:
- The stored item is marginally related (token overlap matched but semantic relevance is weak)
- The user is asking a general question with no personal dimension
- The injection would make the response feel presumptuous

The current threshold of score ≥ 1 meaningful token for injection is conservative. That's correct. The assistant should use memory subtly, not exhaustively reference it.

### When should a tension be surfaced versus kept background?

Surfacing a tension in chat should be rare and earned. The context drawer already shows top tensions passively — that's the right pattern for background awareness. In-prompt injection of tensions should happen only when:
- The user is actively engaging with the subject area of the tension
- The tension is directly relevant to a decision the user is navigating now
- The assistant would give subtly worse advice without knowing the tension exists

Even when injected, tensions should not be announced. The assistant should use them to *frame* questions better, not to diagnose the user. The `recommendedRung` field already encodes how gentle or direct the approach should be — the assistant should follow it.

**Key rule:** A surfaced tension should make the assistant ask a better question, not make it deliver a mini-therapy intervention.

### When should a forecast affect a response?

Forecasts are user-stated predictions about future outcomes. They should affect responses when:
- The conversation is explicitly about planning, decisions, or future expectations
- The user is revising or questioning something their forecast was predicated on
- The user asks something where their stored expectation is directly relevant

Forecasts should never be injected into unrelated conversations. The relevance-gating (score ≥ 1) is the correct gate. Forecasts are the lightest context signal — they inform, they don't constrain.

### How explicit should the system be about its own cognition?

The system should be largely transparent but non-intrusive. Specific rules:

- **Never say "I retrieved from your memory."** Say "You mentioned earlier" or "Based on what you've shared" or simply use the information without attribution.
- **Never name the internal system.** Do not say "your Long-term memory block" or "your tension graph." Those are implementation details.
- **When asked directly**, the assistant should say something like: "You told me earlier and I kept it" or "I remember that from our conversations."
- **Candidate cards in chat** are the one explicit system disclosure that is appropriate. They surface cleanly with an action (Apply/Dismiss) and disappear. That pattern is correct.
- **Context drawer** is appropriate for users who want to see what's active. It should remain opt-in (the Clock3 button), not forced open.

---

## User Legibility

### What the user should understand during normal use

A user in a normal chat session should naturally understand:
- The assistant remembers things they've told it (memories)
- Confirmed memories persist across sessions
- Unconfirmed suggestions (candidates) appear as a card and can be accepted or dismissed
- They can save assistant messages as memories, forecasts, references, or evidence
- The side panel shows their saved knowledge

A user does not need to understand during normal use:
- Token overlap scoring
- Injection caps or relevance gating
- Escalation ladders for tensions
- The difference between superseded and inactive

### What should remain visible vs hidden

| Visible | Hidden |
|---|---|
| Candidate card (Apply/Dismiss) | Injection scoring |
| Capture buttons on messages | Retrieval layer details |
| Context drawer (opt-in) | Escalation level numbers |
| Memory panel | Background async processing |
| Tension status (open/snoozed/explored) | DB status fields |
| Forecast confidence | Which prompt block contains what |
| Help page | ProfileArtifact system (dormant, correct) |

### What the user needs to understand about each concept

**Memories:** Things I've told the assistant that it will remember. Confirmed ones persist. Unconfirmed ones are waiting for my approval.

**Tensions:** Unresolved conflicts the system noticed. They don't go away by themselves. I review them and decide what to do.

**Forecasts:** Predictions I've made. The assistant knows about them when I'm talking about the future.

**Candidates:** Things the system detected but hasn't added yet. I confirm or dismiss them.

**Sources:** External things I've saved (links, documents). Not personal memories — reference material.

---

## Guided Cognition Surfaces — Current State and Gaps

### Help Page (`/help`)
**Current state:** 5 plain-language sections (Memories, Sources, Tensions, Forecasts, Candidates) with links to each domain. Reachable from GlobalRail and Cmd+K.

**What's missing:**
- No "when would I use this?" framing for each concept
- No example of what a capture looks like
- No guidance on the difference between confirming a candidate vs adding a memory manually
- No guidance on what happens when a candidate is dismissed (it just disappears — but what does that mean?)

### In-Chat Guidance
**Current state:** Capture buttons appear on assistant message hover (memory, ref, evidence, forecast). Pending candidate card appears at top of message list.

**What's missing:**
- No contextual hint on first use explaining what capture buttons do
- No empty-state on first chat session explaining the companion concept
- No feedback when a save succeeds except the card dismissing
- No clear visual differentiation between the 4 capture modes beyond icon + tooltip
- The candidate card only shows for the current session's candidate — import-created candidates from other sessions don't appear here

### Candidate Review Surfaces
**Current state:**
- `/references/candidates` — confirm/dismiss candidate memories
- `/contradictions/candidates` — confirm/dismiss candidate tensions
- Import result links to both

**What's missing:**
- No batch action (confirm all / dismiss all) — must act one at a time
- No explanation of *why* something was proposed as a candidate (what triggered it)
- No provenance beyond "created at" date — import candidates especially feel context-free
- No count badge anywhere in the rail or header telling the user how many candidates await
- References/candidates is accessible from rail only via `/references` → filter, not a direct link

### Context Drawer (Clock3 in chat top bar)
**Current state:** Shows top 3 surfaced tensions, reference summary stats, weekly audit metrics. Opt-in tuck-down.

**What's missing:**
- Escalation level displayed as a number ("Level 3") — meaningless to most users
- No direct action from the context drawer (it's read-only, no links to individual tensions)
- Reference summary shows Active/Candidate/Total counts but no link to act on candidates
- The "This week" section shows raw float metrics (e.g., Stability: 0.731) — not user-meaningful
- No link to the candidate review surface when candidates exist

### Post-Import Guidance
**Current state:** Import result block links to: Sessions, Tensions, Candidate Tensions (conditional), Candidate Memories, Weekly Review.

**What's missing:**
- No prioritization — all links are equal, no suggestion of which to do first
- No explanation of what "reviewing candidates" means or how long it takes
- No summary of *what kind* of tensions or memories were found — just raw counts
- No onward journey guidance (after reviewing candidates, what should the user do next?)

---

## Chat Behavior Design

### When relevant memory exists

The assistant should use the memory *within* its response naturally. It should not announce it. Examples:

- If the user has a stored preference for concise responses, the assistant should be concise — not say "I know you prefer concise responses."
- If the user has a stored goal to quit a job, and asks about resume formatting, the assistant can frame its help around that context without saying "given your stored goal of..."
- If the user asks something that directly references a stored constraint ("can I do X?"), the assistant can answer with the constraint in mind and, when appropriate, say "based on what you've shared" once.

### When relevant tension exists

The assistant should use the tension to ask a *better question*, not to diagnose. The `recommendedRung` encodes the level:

- `rung1_gentle_mirror`: Simply reflect. "I notice that connects to something you've wrestled with before — what feels different this time?"
- `rung2_naming`: Name the tension gently. "There seems to be a pull between X and Y here."
- `rung3_direct`: Surface it explicitly. "You've said both A and B to me. Which feels more true right now?"

The assistant should not move to a higher rung than recommended. It should not surface the tension unprompted if the conversation doesn't naturally touch on it.

### When relevant forecast exists

The assistant should treat a forecast as background context — something the user said they expected. If the user is now talking about something related, the assistant can acknowledge the prediction: "You expected X — how is that tracking?" or simply use it as framing without naming it.

### When there is uncertainty

If the assistant is uncertain about something the user told it, it should ask rather than guess. It should not fabricate memory. If asked about something not in its context: "I'm not sure I have that — could you remind me?"

### When there is conflict between current user statement and stored state

This is the governance moment. The current system creates a candidate when it detects a conflict. The assistant should:
1. Respond naturally to what the user said now (not to the stored version)
2. Not argue with the user based on stored memory
3. Let the candidate card surface the question non-intrusively

The assistant should not say "But you said X before." It should respond to the current statement. The candidate card does the governance work.

### Tone rules

- Direct, not clinical
- Curious, not presumptuous
- Concise unless the user signals they want depth
- Does not moralize
- Does not narrate its own cognition aloud
- Does not pad responses with acknowledgments ("Great question!")
- Does not over-confirm ("Got it! I understand that...")

---

## Candidate Interaction Design

### What candidates should feel like

Candidates should feel like a light suggestion from a trusted assistant, not a system notification. "I noticed this — does it belong?" not "ALERT: New candidate detected."

The card format is correct. The action labels (Apply/Confirm, Dismiss) are appropriate. The challenge is making candidates feel *earned* — the user should feel like the system noticed something real, not just scraped keywords.

### Confirm/dismiss expectations

**Confirm:** The item enters the active set. Future chats will use it. It should feel permanent-until-changed.

**Dismiss:** The item is gone. It should not reappear. The user should trust that dismissed means dismissed. No phantom re-detection of the same statement.

### Lightweight vs heavyweight

**Lightweight (should be):**
- Candidate card appearing in chat
- Confirm/dismiss action (one click)
- Viewing candidate list on candidates page

**Heavyweight (avoid):**
- Requiring users to write anything to confirm a candidate
- Showing multiple conflicting candidates for the same topic simultaneously
- Requiring users to explain why they're dismissing
- Showing candidates from weeks ago without context

### Differences between candidate memories and candidate tensions

| Candidate memories | Candidate tensions |
|---|---|
| Proposed by governance trigger (user said something that looks like a preference/goal/constraint) | Proposed by AI contradiction detection (cross-statement conflict) |
| Single statement to confirm | Two-sided tension to confirm (sideA / sideB) |
| Session-scoped origin — may be current chat or import | May span multiple sessions |
| Confirm = enters active memory injection | Confirm = enters active tension tracking and may be surfaced in future chats |
| Dismiss = dismissed forever | Dismiss = deleted |
| Review surface: `/references/candidates` | Review surface: `/contradictions/candidates` |
| Chat card: appears for current session's candidate only | No in-chat card currently — only via candidates page |

---

## Friction and Trust Risks

### What could make the product feel invasive

- The assistant referencing stored memory unexpectedly in a context that feels unrelated
- Candidate cards appearing too frequently — every message feeling like it generates a suggestion
- The assistant seeming to "track" the user rather than help them
- Tensions being surfaced in a way that feels like diagnosis or judgment
- The assistant contradicting the user based on stored state ("But you said...")

### What could make the product feel confusing

- Too many concepts visible at once (memories, candidates, tensions, forecasts, sources — five separate things)
- Candidate cards that don't explain what triggered them
- Tension escalation levels displayed as raw numbers
- Float metrics (0.731) displayed where human-readable summaries would serve better
- The help page explaining what things *are* but not what to *do* with them

### What could make the product feel noisy

- Candidate card appearing on almost every message
- The context drawer showing tensions that have nothing to do with the current conversation
- Injected tensions making the assistant feel tangential or distracted
- Forecasts surfacing when the user is just chatting casually

### What behaviors would reduce trust

- Dismissed candidates reappearing (re-detection of same statement)
- Memory injection that is clearly wrong (hallucinated provenance)
- The assistant saying "I remember you said X" when X is not something the user actually said
- Candidates appearing for things the user didn't meaningfully express
- Governance card appearing and then vanishing before the user can act on it (race condition)

---

## What Still Feels Incomplete at Product Level

### References / Memories

- The memory panel in chat shows all references (active, candidate, inactive) but candidates in the panel cannot be confirmed from the panel — only from `/references/candidates` or the detail page. There is no in-panel confirm for import-created candidates.
- "Deactivate" is the action label in the panel for active memories — this is too technical. "Remove" or "Archive" would be clearer.
- There is no concept of "which memories shaped this response" — the user can't trace why the assistant said something.

### Forecasts

- No mechanism for the user to update a forecast as time passes (only archive or delete)
- No "how is this tracking?" workflow — forecasts are saved and then... sit there
- No aggregate view of forecast confidence over time
- The forecast detail page shows Drivers and Outcomes but no narrative — the AI never refers to the forecast in a structured way during conversation

### Candidate Review

- No count badge on rail items to indicate pending candidates
- No batch actions on candidates pages
- No provenance explanation for why something became a candidate
- Import-created candidate memories are only visible at `/references/candidates`, not in the live chat governance card

### Context Drawer

- Escalation level number displayed ("Level 3") should be translated to a human phrase
- Reference summary stats have no action path from the drawer
- "This week" metrics are raw floats — should be human-readable summaries (e.g., "Stable" / "Stressed" / "Critical")
- No direct link from the drawer to relevant items (clicking a tension title should navigate)

### Import Follow-Up

- Import result is a static summary — no sense of what's most important to review first
- The import result disappears once the user navigates away (no persistent summary in import history)
- No onboarding for first-time importers explaining what "candidate tensions" and "candidate memories" mean

### Chat Communication

- First-session empty state does not explain the companion concept or what to expect
- No success feedback when a capture action completes (capture modal closes, that's it)
- The "Standard / Deep" mode toggle has no in-product explanation of what Deep mode does differently
- Voice input (mic button) has no transcription display during recording — user doesn't know what was captured

---

## Recommended Implementation Order

### Packet A — Candidate Legibility (design-first, then code)
*Goal: Make candidates feel earned and actionable.*

Design decisions first:
- Define what "why this became a candidate" looks like — provenance sentence or tag
- Define what the candidate count badge looks like in the rail
- Decide: batch actions yes/no for this packet (probably no — keep lightweight)

Then implement:
1. Count badge on GlobalRail for pending candidates (memories + tensions combined, or separate)
2. Provenance sentence on candidate cards: "Detected from your message on [date]" or "Proposed during import"
3. Direct GlobalRail entry for candidate review (not buried under /references)

### Packet B — Context Drawer Human Readability (small, mostly code)
*Goal: Make the context drawer legible without domain knowledge.*

1. Replace escalation level number with human phrase (e.g., Level 0–1 = "Gentle", 2–3 = "Exploring", 4+ = "Direct")
2. Replace raw float stability metric with label ("Stable" ≥ 0.75 / "Stressed" ≥ 0.50 / "Critical" < 0.50)
3. Make tension titles in drawer clickable (navigate to `/contradictions/[id]`)
4. Add link from drawer to candidate review when candidates exist

### Packet C — In-Chat First Use and Feedback (design-first)
*Goal: New users understand what's happening; existing users get feedback.*

Design decisions first:
- What does the first-session empty state say?
- Is the first-session onboarding a one-time tooltip, a card, or part of the empty state?
- What does a successful capture look like? (toast? momentary badge? nothing?)

Then implement:
1. First-session empty state with brief companion explanation
2. Capture success feedback (minimal — a brief visual confirmation)
3. "Standard / Deep" tooltip explanation

### Packet D — Help Page Depth (pure content, then minor code)
*Goal: Help page explains what to do, not just what things are.*

1. Add "When would I use this?" to each concept section
2. Add "What happens when I confirm/dismiss a candidate?"
3. Add first-use walkthrough summary ("Your first week with Mind Lab")
4. Ensure help page is reachable from import result block

### Packet E — Memory Panel UX Labels (small code cleanup)
*Goal: Technical labels replaced with plain language.*

1. "Deactivate" → "Remove" on active memory panel actions
2. "Promote" → "Confirm" on candidate panel actions (matching candidate pages)
3. Confidence display: consider hiding "low/medium/high" from casual view, surfacing on hover

---

## Explicit Non-Goals of This Phase

- **No ontology revision** — the memory/tension/forecast/candidate/source taxonomy is stable
- **No schema changes** — the Prisma schema is not touched in this phase
- **No performance optimization** — injection scoring, query timing, caching are out of scope
- **No philosophical re-evaluation** — "is this the right product to build?" is deferred
- **No new data categories** — no new entity types, no new status values
- **No AI model changes** — model selection, prompt length, or API changes are not this phase's scope

---

## The 5 Most Important Product Behavior Decisions

**1. How explicit should the assistant be about memory use?**
Current: No explicit policy. The system prompt tells the assistant what it knows, but doesn't tell it how to communicate that.
Decision needed: Adopt the "use naturally, never announce" rule. Define 2–3 example response patterns.

**2. When does a tension get surfaced in-chat vs stay background?**
Current: Tensions are injected when relevance score ≥ 1. The assistant may or may not use them.
Decision needed: Adopt the "use to ask a better question, not to diagnose" rule. Define rung-to-behavior mapping.

**3. What does a candidate count badge look like, and where does it live?**
Current: No badge exists. Candidates are invisible unless the user navigates to candidate pages.
Decision needed: Badge location (rail? header?) and threshold (show at 0? show at 1+?).

**4. How does the context drawer translate metrics to human language?**
Current: Raw floats and level numbers displayed.
Decision needed: Stability threshold → label mapping. Escalation level → phrase mapping.

**5. What does the first-session experience look like?**
Current: Empty chat with no explanation of what the companion does.
Decision needed: Empty state copy, whether first-use guidance is passive (static text) or active (prompt suggestion).

---

## Recommended First Implementation Packet After This Planning Pass

**Packet B — Context Drawer Human Readability**

Rationale: It is the smallest, most contained change with the most immediate legibility impact. It requires no design decisions beyond metric thresholds, it touches only one component and one minor behavior change, and it makes the product feel noticeably more coherent the moment a user opens the context drawer. It is pure code with no UX ambiguity.

After Packet B, proceed to Packet A (candidate legibility) which requires one design decision (badge location) before implementation.

---

## Confirmation

This is a planning and design document only. No code was changed. No schema was modified. All implementation is deferred to subsequent packets derived from this document.

---

*Created: 2026-03-08*
*Phase: Product Behavior / Guided Cognition Pass*
*Preceded by: Foundation Stabilization Pass, Forecast Lifecycle Foundation, Memory Candidate Completion, Relevance-Gated Injection Pass*
