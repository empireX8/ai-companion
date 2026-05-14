# MindLab Understanding Engine — Product Surface / UI Map v1

**Date:** 2026-05-14  
**Sources:** Canonical Theory Map v1, `docs/step2a-infrastructure-audit.md`, `docs/step2b-architecture-application-map.md`  
**Scope:** Product architecture and interaction design only. No implementation.

## 1. Purpose

This document translates the Understanding Engine architecture into user-facing product surfaces. It defines:

- what surfaces exist after the update
- what each surface is responsible for
- what each surface reads/writes
- how surfaces connect
- what appears on web vs mobile
- what must be designed before Step 3
- what should not be visually overbuilt yet

This is an **additive intelligence update**. Existing surfaces remain: Today, Journal, Explore, Check-ins, Timeline, Patterns, Tensions, Actions, Library/Receipts. The update makes them more connected and more alive.

## 2. Product Surface Principles

- The UI should make the intelligence feel alive through meaningful change events, not theatrics.
- The UI should show progress without fake gamification bars or levels.
- The UI should preserve existing surfaces while strengthening cross-links between them.
- The UI must clearly distinguish: conclusions, hypotheses, investigations, actions, fieldwork, receipts.
- The UI should not expose backend categories as user-facing taxonomy.
- The UI language must be receivable and human, not academic/system jargon.
- The UI must not expose raw agent traces.
- The UI should show evidence/confidence without turning the product clinical.

## 3. Updated Navigation / Surface Map

### Navigation options

**Option A (Recommended): Extended rail**
- Keep existing primary rhythm surfaces.
- Add User Map + Investigations as secondary intelligence surfaces.

**Option B: User Map replaces Today**
- Not recommended: breaks daily orientation/capture behavior.

**Option C: User Map only as Today section**
- Not recommended: overloads Today and underpowers User Map depth.

### Recommended structure (Option A)

| Surface | Main Tab vs Secondary | Existing vs New | Why it exists | Reads | Writes | What it should not become |
|---|---|---|---|---|---|---|
| Today | Main | Existing | Daily orientation | ModelUpdate, Investigation, Fieldwork, Actions, Pattern/Tension highlights | quick capture, check-in shortcuts | Dashboard junk drawer |
| Journal | Main | Existing | Deep reflection capture | Journal entries, related prompts | JournalEntry | Analysis center |
| Explore | Main | Existing | Conversation-based processing and sense-making | User Map context, investigations, action context (mode-dependent) | conversation artifacts, investigation notes, action planning | Therapy branding |
| Check-ins | Secondary | Existing | Fast state capture | active fieldwork prompt, recent state history | QuickCheckIn, fieldwork observations | Journal replacement |
| Timeline | Secondary | Existing | Epistemic chronology | states, entries, sessions, model updates, investigation milestones | none direct | Noisy activity feed |
| Patterns | Secondary | Existing | Behavioral pattern claims | PatternClaim + links outward | pattern dismiss/feedback actions | Full user model |
| Tensions | Secondary | Existing | Contradictions/tension signals | ContradictionNode + links outward | snooze/resolve user actions | Problem list |
| Actions / Experiments | Secondary | Existing evolved | Try/test moves + feedback loops | action suggestions, outcomes, related model objects | Action outcomes, notes | Generic todo list |
| User Map | Secondary | New | Whole-person synthesis | UserMapConclusion, confidence/evidence links, related objects | user correction feedback | Static profile page |
| Investigations | Secondary | New | Active research threads | Investigation, competing theories, needed evidence | progress updates, resolution decisions | Bare question list |
| Library / Receipts | Secondary/Archive | Existing evolved | Proof + source continuity | receipts, evidence spans, source history | corrections/comments | Raw DB browser |

## 4. Today Surface

Today is the **live orientation layer**, not a full dashboard.

### Core card types (priority order)

1. What changed (Model Update)
2. Active investigation
3. Fieldwork prompt (watch for signal)
4. Suggested action/experiment
5. Current state summary
6. Pattern/tension highlight
7. Continue in Explore/Journal

### Rules

- Show only top 1–2 items per card type.
- Collapse older model updates behind “See previous updates”.
- Hide cards with no evidence-backed content.
- Never show synthetic “insight of the day.”

### Empty states

- No model updates: “No model changes yet. Keep capturing your week.”
- No investigations: “No active questions right now.”
- No fieldwork: card hidden.
- No suggested actions: “Suggestions appear when there’s enough signal.”

### Only show when evidence exists

- Model update card
- Investigation progress card
- Fieldwork prompts
- Confidence language above “emerging”

### Do not show until backend support exists

- “What MindLab is working on” engine summary
- Model update diffs
- investigation progress state machine
- fieldwork completion-derived updates

## 5. User Map Surface

User Map is a living synthesis surface, not a category dump.

### Structure

1. **Master Theory / Whole-person synthesis** (short narrative)
2. **Synthesis areas**
- Operating Logic
- State Ecology
- Tension Architecture
- Recovery Architecture
- Meaning System
- Relational Field
- Developmental Vector
- Current Frontier
3. **Conclusions list**
4. **Evidence + corrections controls**

### Conclusion card contains

- conclusion statement
- status (`emerging`, `supported`, `disputed`)
- confidence language
- evidence count + source diversity + time spread
- linked patterns/tensions/actions/investigations/timeline
- “Does this feel accurate?” correction action

### Detail view

- full conclusion text
- confidence rationale
- evidence drawer
- related graph (patterns/tensions/investigations/actions/timeline)
- model update history for this conclusion
- correction history

### Evidence drawer / receipts

- grouped by source type
- quote/snippet + date + source link
- deep link into Library receipt/source context

### Uncertainty states

- **Emerging**: weak/early signal
- **Supported**: multi-source, multi-time evidence
- **Disputed**: contradicted by user correction or new evidence
- **Superseded**: replaced by a newer conclusion version

## 6. Investigations Surface

Investigations are active research threads with explicit theory testing.

### Placement decision

**Recommended:** Hybrid
- standalone list surface (`/investigations`)
- surfaced on Today
- linked heavily from User Map, Patterns, Tensions
- detail pages for thread-level work

### Investigation list

- title + organizing question
- status (`open`, `gathering evidence`, `testing`, `resolving`, `resolved`, `reopened`)
- seeded-from info (pattern/tension/check-in/user-started)
- next needed evidence
- related area chips

### Investigation detail includes

- organizing question
- competing theories (A/B/…)
- evidence for/against each theory
- evidence still needed
- linked User Map nodes
- linked Patterns/Tensions
- linked Timeline moments
- linked Fieldwork assignments
- linked Actions/Experiments
- progress timeline

### Resolution mechanics

- resolved finding updates User Map
- emits Model Update event
- thread remains readable with resolution record
- auto-reopen if contradictory evidence crosses threshold

## 7. Explore Surface

Explore supports reflection, sense-making, and forward movement.

### Mode options

- Option A: Release / Understand / Move
- Option B: Vent / Make sense of it / Decide what to do
- Option C: No visible mode (intent detection only)

### Recommendation

**Hybrid of B + C**
- visible user-friendly modes: `Vent`, `Make sense`, `Decide`
- intent detection suggests mode, user can override

### Mode behavior

| Mode | User intent | Assistant posture | Can save | Should not conclude immediately | Engine feed | Safety |
|---|---|---|---|---|---|---|
| Vent | emotional unloading | supportive, non-analytic | optional private note only | no stable traits/conclusions | minimal | strongest guard |
| Make sense | pattern/context understanding | analytic, collaborative | investigation notes, candidate evidence | no hard conclusions from single episode | investigation + candidate signals | standard guard |
| Decide | choose next move | practical, experimental | action/experiment, fieldwork plan | no “this always works” claims | action outcome loop | standard guard |

## 8. Actions / Experiments Surface

Actions evolve into evidence-aware behavior loops.

### Distinctions

- **Action:** Try this move.
- **Experiment:** Test a hypothesis with explicit expected signal.
- **Tested Move:** Experiment/action with repeated outcomes.
- **What Works:** Context-indexed set of tested moves.

### Surface design

- segmented list: `Try this`, `Test this`, `What worked`
- card shows: linked source (pattern/tension/investigation), why this, effort level
- detail shows: hypothesis, context conditions, previous outcomes, related objects

### Feedback flow

- user records: helped / did not help / unclear + optional note
- repeated outcomes update conditions (“works when…”, “fails when…”)
- outcomes feed Model Updates and User Map confidence shifts

### Relationship map

- User Map -> generates action candidates
- Investigations -> generate experiments
- Action outcomes -> update investigations + User Map + model updates

## 9. Fieldwork UX

Fieldwork is observation, not action.

### Definition

- Actions: “Try this move.”
- Fieldwork: “Watch for this signal.”

### Where it appears

- Today (top prompt)
- Check-ins (integrated observation question)
- Investigation detail (full thread fieldwork list)
- Explore (reflection on observations)

### Assignment and completion

- Assigned from investigation evidence gaps or weak conclusion confidence
- Completed via fast check-in or short reflection flow
- Completion creates structured observation linked back to thread

### Design constraints

- 1 clear prompt at a time
- tiny effort footprint (<20 seconds for basic completion)
- contextual timing (“next time X happens…”), not generic homework

### Sample prompts

- “Next time your energy drops after a meeting, note what happened in the 5 minutes before.”
- “When you feel criticized, notice your first body signal before your first thought.”
- “If you avoid replying, record what you predicted would happen if you did reply.”

## 10. Model Updates UX

Model Updates are explicit “your understanding changed” events.

### Model Update card

- short headline: what changed
- why now: new evidence source(s)
- confidence movement (language, not numeric obsession)
- link targets: User Map node, investigation, timeline context, receipts

### Model Update detail

- before/after statement
- driving evidence summary
- related actions/fieldwork/investigation events
- correction impact (if user-triggered)

### Show locations

- Today: top “What changed” slot
- Timeline: chronologically anchored event
- User Map node history: local change log

### When not to show

- trivial backend churn
- unchanged interpretation with only metadata updates
- confidence shifts below meaningful threshold
- updates produced from low-quality single-source evidence

### Example update types

- Conclusion strengthened: “Your self-reliance-under-pressure pattern is now better supported across work + family contexts.”
- Conclusion weakened: “The ‘morning overload’ conclusion is less certain after contradictory check-ins.”
- New link detected: “Shutdown episodes now appear linked to perceived evaluation, not only workload.”
- Investigation progressed: “Active question on criticism response moved to testing stage.”
- Action feedback changed strategy: “Short-message intervention helped in low-conflict situations but failed under urgency.”
- Fieldwork clarified state switch: “State drop is usually preceded by social ambiguity, not schedule density.”

## 11. Timeline Surface

Timeline remains epistemic infrastructure, not activity spam.

### Timeline event layers

- state shifts/check-ins
- journal/explore moments
- pattern evidence milestones
- tension evidence milestones
- action/experiment attempts + outcomes
- fieldwork completions
- model updates
- investigation milestones
- user map node changes

### Anti-clutter rules

- default grouped by day/week with expandable clusters
- default filter shows “meaningful changes” layer
- low-value system events hidden by default

### Filters

- Event type
- Topic/area
- Investigation
- State tag
- Date range
- Confidence impact (high/medium/low)

## 12. Patterns and Tensions Surfaces

### Patterns

**What stays**
- Pattern claims, families, lifecycle behavior, receipts.

**What updates**
- outward links to User Map conclusions, investigations, and tested moves.
- pattern detail adds “where this currently matters” and “what helped.”

**How patterns feed**
- User Map: evidence backbone for behavior conclusions.
- Investigations: seed unresolved mechanism questions.
- Actions/Experiments: generate/validate moves.

### Tensions (Contradictions)

**What stays**
- tension detection/escalation, evidence-backed contradiction cards.

**What updates**
- tension detail links to active investigations and impacted User Map areas.
- explicit “do not over-interpret” framing for unresolved contradictions.

**Guardrail**
- contradictions are prompts for inquiry, not instant conclusions.

## 13. Library / Receipts Surface

Library stays the trust layer.

### Design decisions

- receipts appear from every major surface via “View evidence”
- receipt panel shows source snippet + date + origin + linked conclusion/investigation/update
- corrections can be submitted from receipt-linked context

### Continuity functions

- preserve source history (including imports)
- allow reverse traversal: source -> claim/update(s) influenced
- show evidence reuse across surfaces

### EvidenceSpan visibility

- No separate top-level EvidenceSpan surface in v1.
- EvidenceSpan is exposed inside receipt detail as “source context highlight.”
- Keep it inspectable but not a primary navigation destination.

## 14. Check-ins Surface

Check-ins become high-frequency state telemetry for the engine.

### Role

- state capture + quick context
- detect state switches
- attach lightweight fieldwork observations
- feed emotional routing in Explore

### Relationships

- Timeline: direct chronological state backbone
- Emotional processing: helps route/suggest Vent vs Make sense vs Decide
- Fieldwork: fastest completion path
- Model updates: can trigger or contextualize change events

### Mobile needs

- 1-tap state tags
- optional 1-line context
- optional fieldwork response in same interaction
- offline-safe capture sync

## 15. Mobile Surface Map

Mobile remains backend-derived; no local intelligence reimplementation.

| Surface | Must exist in mobile v1 | Can wait until parity phase | Must be backend-derived | Never hardcoded/synthetic |
|---|---|---|---|---|
| Today | Yes | No | Yes | Yes |
| Journal | Yes | No | N/A for authored text; prompts yes | Yes |
| Explore | Yes | No | mode policy/context yes | Yes |
| Check-ins | Yes | No | state routing + fieldwork prompt yes | Yes |
| Timeline | Yes | No | Yes | Yes |
| Patterns | Yes | No | Yes | Yes |
| Tensions | Yes | No | Yes | Yes |
| Actions / Experiments | Yes | No | Yes | Yes |
| User Map | Yes (lite + detail) | richer visualizations can wait | Yes | Yes |
| Investigations | Yes (list + detail) | advanced editing can wait | Yes | Yes |
| Model Updates | Yes (Today + Timeline) | dedicated archive can wait | Yes | Yes |
| Fieldwork | Yes (prompt + completion) | standalone full manager can wait | Yes | Yes |
| Receipts | Yes (from deep links) | full library tooling can wait | Yes | Yes |

## 16. Information Hierarchy

Global hierarchy:

1. What matters now?
2. What changed?
3. What is MindLab investigating?
4. What does MindLab currently understand about me?
5. What should I do/watch next?
6. What evidence supports this?
7. What can I correct?

### Applied by surface

| Surface | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Today | primary | primary | primary | secondary | primary | deep link | deep link |
| User Map | secondary | secondary | secondary | primary | secondary | primary in detail | primary |
| Investigations | secondary | primary | primary | secondary | primary | primary | secondary |
| Actions | primary | secondary | secondary | secondary | primary | secondary | secondary |
| Timeline | secondary | primary | primary | secondary | secondary | deep link | deep link |

## 17. Language / Naming Decisions

| Concept | Options | Recommended |
|---|---|---|
| User Map | Your Map, How You Work, Understanding Map, MindLab Map | **Your Map** |
| Master Theory | Current Understanding, Big Picture, Whole Pattern, How It Connects | **Current Understanding** |
| Investigations | Active Questions, Open Threads, What We’re Testing, In Progress | **Active Questions** |
| Model Updates | What Changed, Your Model Changed, New Understanding, Recent Shifts | **What Changed** |
| Fieldwork | Watch For, Signals to Watch, Notice This, Between Sessions | **Watch For** |
| Actions / Experiments | Try This / Test This, Next Move / Test Move, Do / Test, Actions / Experiments | **Try This / Test This** |
| Tested Moves | What Worked, Proven Moves, Reliable Moves, Moves That Help | **What Worked** |
| Emotional Modes | Vent / Make Sense / Decide, Release / Understand / Move, Pause / Sort / Act | **Vent / Make sense / Decide** |
| Model Maturity Levels | Emerging/Developing/Established/Reliable, Early/Growing/Solid/Deep, Thin/Building/Grounded/Adaptive | **Emerging / Developing / Established / Reliable** |
| Meta-Observer (if surfaced) | Confidence Check, Blind Spot Check, Coverage Check, Quality Signals | **Confidence Check** (only if ever surfaced) |

## 18. Anti-Patterns

The UI must avoid:

- fake progress bars
- random insight feed
- generic self-help cards
- therapy-mode branding
- diagnosis-style language
- dumping backend categories into UI
- turning agents into characters
- replacing existing surfaces unnecessarily
- making User Map a static profile page
- presenting hypotheses as conclusions
- overloading Today
- making Fieldwork feel like homework
- mobile hardcoded intelligence

## 19. Recommended Product Surface Direction

### Main navigation

- Main: Today, Journal, Explore
- Secondary: Check-ins, Timeline, Patterns, Tensions, Actions, User Map, Investigations, Library

### Page types

- Surface pages: list/orientation
- Detail pages: User Map node, Investigation thread, Action/Experiment detail
- Shared drawers: evidence/receipts, correction, quick links

### What changes first

1. Today orientation cards (what changed, active questions, watch for, try this)
2. User Map surface with correction + receipts
3. Investigations list/detail with theory testing
4. Actions/Experiments + feedback loop
5. Timeline integrated model events

### What remains familiar

- existing routes/surfaces
- Patterns/Tensions as first-class surfaces
- Journal/Explore/Check-ins capture habits
- Library as proof layer

### Redesign before implementation

- Today card hierarchy + gating logic
- User Map card/detail/correction architecture
- Investigation thread interaction model
- Explore mode switch UX
- Actions vs Experiments language and flows
- Timeline layers/filters

### Visual polish later

- advanced visualization treatments
- rich graph canvases
- animations/transitions beyond functional clarity

## 20. Step 3 Handoff

Step 3 Execution Map needs:

### Confirmed surfaces/routes

- `/`, `/journal`, `/explore`, `/check-ins`, `/timeline`, `/patterns`, `/contradictions`, `/actions`, `/library`
- new: `/user-map`, `/user-map/[id]`, `/investigations`, `/investigations/[id]`

### Required backend objects

- UserMapConclusion
- Investigation
- ModelUpdate
- FieldworkAssignment
- Action/Experiment extension of SurfacedAction
- receipt/evidence linking updates across objects

### Required APIs (minimum)

- `GET /api/user-map`, `GET /api/user-map/[id]`, `PATCH /api/user-map/[id]/correct`
- `GET /api/investigations`, `GET /api/investigations/[id]`, `PATCH /api/investigations/[id]`
- `GET /api/model-updates`
- `GET /api/fieldwork`, `PATCH /api/fieldwork/[id]`
- `PATCH /api/actions/[id]/outcome`
- additive link fields in existing pattern/tension/timeline/library responses

### Required UI components

- Today model update card
- investigation summary card + thread detail sections
- user map conclusion card + uncertainty badge + correction control
- evidence drawer / receipt inspector
- fieldwork prompt + quick completion
- action/experiment outcome capture
- timeline event layer chips + filters

### Mobile parity requirements

- all intelligence surfaces consume backend-derived outputs
- no local synthesis logic
- v1 supports Today/User Map/Investigations/Model Updates/Fieldwork flows in thin-client form

### Test implications

- evidence routing integrity tests
- status/uncertainty rendering tests
- correction -> model update -> surface propagation tests
- investigation reopen-on-contradiction tests
- timeline layer/filter correctness tests
- mobile/web parity contract tests for shared endpoints

### Rollout order

1. backend objects + APIs (dark)
2. engine writes + objectivity gates (dark)
3. User Map beta
4. Investigations beta
5. Today “What changed” + fieldwork
6. Actions/Experiments feedback loop
7. Timeline integrated model events
8. mobile parity pass
