# MindLab Understanding Engine — Step 4A Category, Agent Architecture, and Intelligence Library Addendum

**Date:** 2026-05-14  
**Type:** Strategic architecture addendum (doc-only)

## 1. Purpose of this addendum

The planning chain is already largely locked for implementation sequencing and Phase 1A schema scope. This addendum exists to prevent strategic drift before coding starts by clarifying three areas that can easily drift later:

1. Product category and Journal role
2. Advanced agent architecture and the meaning of Phase 7
3. External Intelligence Library / domain knowledge architecture

This addendum does not reopen the full planning chain and does not block Phase 1A unless it finds a direct conflict. No direct Phase 1A conflict is identified.

## 2. Product category decision

**Category lock:** MindLab = **Personal Intelligence System**.

Why “journal app” is no longer the primary category:

- A journal app primarily stores and retrieves authored entries.
- MindLab does that, but also synthesizes cross-surface evidence over time, tracks model movement, maintains active inquiry threads, generates fieldwork/action loops, and preserves claim provenance.
- MindLab is architected as a system that learns longitudinally from multiple evidence channels, not a single writing surface.

Why journaling still matters:

- Journal remains a high-quality, high-signal deep capture entry point.
- It is an effective early wedge for user adoption.
- It provides long-form personal evidence the engine can interpret over time.

Why internal positioning should not collapse to “just a journal”:

- It under-describes the architecture, narrows product decisions, and incentivizes UI-only optimizations over intelligence-system coherence.

Why Personal Intelligence System fits:

- It matches the core loop (Capture -> Reveal -> Understand -> Generate -> Preserve)
- It matches the additive Understanding Engine architecture sitting above existing systems.

**Positioning sentence:**

A journal remembers what you wrote. MindLab learns how you work.

## 3. Journal role inside the product

Journal remains a core surface and is defined as:

- deep capture surface
- long-form life evidence source
- reflection input
- one important source for the Understanding Engine

Journal should not become:

- the whole app
- the analysis center
- a dashboard
- a therapy-branded space
- a replacement for Explore, Check-ins, Timeline, Patterns, or Your Map

Phase 1A constraints:

- Do not rename database models or routes in Phase 1A.
- Do not rename `JournalEntry` now.
- Product/copy renaming discussions belong to later UI phases.

## 4. Updated product positioning ladder

### Internal category

Personal Intelligence System

Use when:

- defining roadmap priorities
- making architecture tradeoffs
- aligning cross-functional decision-making

### Early market wedge

A journal that learns how you work.

Use when:

- onboarding early users
- introducing the product with low cognitive load
- connecting to familiar behaviors quickly

### Mature positioning

Your personal intelligence system for understanding yourself over time.

Use when:

- communicating full product scope
- describing differentiated long-term value
- presenting advanced capabilities

### Adjacent categories and boundaries

- Journal app: adjacent on capture, not sufficient for multi-surface intelligence
- Mood tracker: adjacent on state logging, not sufficient for synthesis/investigations
- Therapy app: adjacent on reflection support, not clinical treatment product
- Productivity app: adjacent on action loops, not task-management-first
- AI coach: adjacent on guidance, but MindLab is evidence-system-first, not persona-first
- Second brain: adjacent on memory/provenance, but MindLab focuses on personal understanding dynamics, not just storage/retrieval

MindLab is adjacent to these categories but not reducible to any one of them.

## 5. Agent architecture clarification

“Agents” in MindLab should not mean:

- UI characters
- mascots
- autonomous fantasy workers
- ungrounded chat personas
- therapy bots

Agents should mean specialized internal reasoning modules/lenses.

### Candidate reasoning lenses

| Lens | What it looks at | What it can contribute | What it must not overclaim |
|---|---|---|---|
| State / nervous-system lens | check-ins, state transitions, overload/stability signals | state-context hypotheses and fieldwork prompts | stable identity conclusions from acute states |
| Behavioral pattern lens | PatternClaims, behavioral repetition, triggers/recovery | pattern continuity and change hypotheses | full-person synthesis alone |
| Social / relational lens | interpersonal context in entries/messages | relational dynamics hypotheses | causal certainty without corroboration |
| Identity / self-concept lens | self-descriptors, belief statements, corrections | identity-framed hypothesis candidates | fixed identity claims from sparse episodes |
| Values / philosophy lens | preferences, meaning language, tradeoff logic | values conflict/priority interpretation | normative judgments as factual proof |
| Sociology / environment lens | context constraints, institutions, workload/system pressures | environment-aware alternative explanations | over-attributing all behavior to structure |
| Power / incentives lens | role pressure, asymmetry, reward/punishment dynamics | incentive-aware interpretation | deterministic claims without evidence |
| Development / goals lens | goals, growth direction, stalled vs advancing patterns | progression hypotheses and experiment framing | guaranteed growth predictions |
| Objectivity referee | all candidate claims and links | evidence sufficiency, contradiction checks, uncertainty enforcement | replacing domain lenses with one generic judgment |
| Safety / language judge | all candidate user-facing text | blocks therapy/diagnosis/overclaim language | deciding truth without evidence/objectivity input |

## 6. Future agent deliberation flow

Future internal flow (not Phase 1A):

User evidence packet  
-> domain lenses interpret evidence  
-> lenses generate hypotheses, objections, alternative explanations  
-> Objectivity referee checks evidence, logic, uncertainty  
-> Safety/language judge blocks unsafe or overclaiming output  
-> system routes result to:
- Your Map
- Active Question
- What Changed
- Watch For
- Try This / Test This
- or no persistence yet

### Phase alignment

Phase 2-adjacent:

- evidence packet assembly
- conservative synthesis
- baseline objectivity gates
- baseline safety/language guard

Boundary clarification:

- Phase 2 may implement conservative synthesis, evidence packet assembly, baseline objectivity gates, and safety/language guards.
- Phase 2 must not implement full multi-lens agent deliberation.
- Full domain lenses, Intelligence Library retrieval, knowledge-aware referee behavior, and advanced objection/counterfactual deliberation belong to Phase 7 or a separately approved later phase.
- This Step 4A addendum is strategic guardrail guidance, not Phase 2 implementation scope expansion.

Phase 7:

- multi-lens deliberation depth
- richer objection/counterfactual generation
- robust referee + knowledge-aware validation
- advanced routing and confidence calibration

## 7. Phase 7 meaning

Phase 7 should eventually include:

- advanced agent/lens deliberation
- Intelligence Library / domain knowledge retrieval
- Objectivity referee improvements
- Generative Self-Model
- Meta-Observer / Blind Spot Engine
- model maturity signals
- advanced causal chain modeling
- domain knowledge update mechanism

Phase 7 should not be implemented early.

This addendum expands the meaning of Phase 7 beyond Step 3 shorthand and should be treated as the strategic completion of that label.

## 8. Intelligence Library definition

MindLab should distinguish two libraries.

### User Library

User-specific evidence and provenance:

- receipts
- evidence spans
- journal entries
- sessions
- patterns
- tensions
- actions
- references
- imports

### Intelligence Library

External/domain knowledge for interpretation:

- psychology
- sociology
- philosophy
- political theory
- behavior change
- relationships
- identity development
- decision theory
- systems theory
- power/institutions
- economics
- anthropology
- stress/trauma research (careful, non-diagnostic use)

Core rule:

- User evidence proves user-specific claims.
- Domain knowledge helps interpret user evidence.
- External theory is not proof about the user by itself.

## 9. Domain knowledge architecture

Potential future objects/modules (not required for Phase 1A):

- `DomainKnowledgeSource`: source registry (publisher, provenance, date, quality metadata)
- `DomainKnowledgeClaim`: normalized claim-level representation from a source
- `Framework`: higher-level conceptual framework grouping related claims
- `TheoryModel`: formalized model/lens that can be invoked in reasoning passes
- `ResearchUpdate`: update event describing additions/revisions/deprecations
- `AgentKnowledgeProfile`: per-lens profile of what knowledge is preferred/allowed
- `RetrievalLog`: trace of which domain items influenced interpretation
- `SourceReliabilityRating`: reliability/confidence scores with revision history

Sourcing, updating, versioning, constraints:

- sourced from curated references first; expansion can include controlled retrieval later
- explicit versioning for claims/frameworks/models
- update pipeline with deprecation and contradiction handling
- domain reliability metadata required before promotion to active interpretive use
- strict separation between interpretive theory and user-evidence proof

## 10. Objectivity and domain knowledge

Objectivity is not prompt tone; it is a system.

Required objectivity subsystems:

- evidence rules
- logic rules
- uncertainty rules
- source reliability rules
- domain validity rules
- counterargument generation
- alternative explanation tracking
- falsification/disconfirmation prompts
- strict separation of personal evidence vs interpretive theory

Future Objectivity Referee checks:

- Is this claim supported by user evidence?
- Is domain theory used appropriately?
- Are alternative explanations represented?
- Is uncertainty stated correctly?
- Is claim stability proportional to evidence?
- Is high-emotion evidence overweighted?
- Is therapy/diagnosis language appearing?

## 11. Domain knowledge vs user evidence boundary

| Category | Example | Can prove user-specific claim? | Role |
|---|---|---|---|
| User evidence | journal entry, check-in, pattern evidence | yes, if sufficient | direct evidence |
| Domain knowledge | sociology/psychology/philosophy framework | no, not by itself | interpretive lens |
| Agent inference | synthesized explanation | no, unless evidence-backed | hypothesis/conclusion candidate |
| User correction | “that’s wrong / partly right” | yes, model adjustment signal | confidence/lifecycle modifier |

Domain knowledge can make the system smarter, but it must not let the system overclaim.

## 12. Relationship to Phase 1A

This addendum does not require Phase 1A schema scope changes.

Phase 1A still builds only:

- `UserMapConclusion`
- `Investigation`
- `ModelUpdate`
- `FieldworkAssignment`
- `UnderstandingEvidenceLink`
- required enums/indexes/migration/minimal tests

Phase 1A must not build:

- Intelligence Library
- agent system
- Objectivity referee
- domain knowledge ingestion
- research update mechanisms
- Phase 7 advanced objects

Phase 1A should keep contracts extensible so later phases can add these systems cleanly.

## 13. Relationship to Phase 2

Phase 2 may begin with:

- evidence packet assembly
- conservative synthesis
- objectivity gates
- high-emotion guard
- single-episode limitation
- meaningful-delta checks

Phase 2 should not claim full domain-agent architecture or Intelligence Library capabilities unless those systems are explicitly built.

If any domain knowledge is used in Phase 2, it must be:

- minimal
- explicit
- constrained
- never treated as user evidence

## 14. Relationship to UI phases

Later UI implications:

- Do not present MindLab as “just a journal.”
- Keep Journal as a capture surface.
- Your Map is the understanding surface.
- Active Questions is the investigation surface.
- What Changed represents model movement.
- Watch For represents fieldwork.
- Try This / Test This represents action/experiment.
- Intelligence Library should not become a user-facing “library” by default.
- Agents should not appear as characters by default.

## 15. Risks and guardrails

| Risk | Mitigation |
|---|---|
| Journal-app category undersells product | lock internal category as Personal Intelligence System and maintain positioning ladder |
| Personal intelligence category harder to explain | use wedge framing first: “a journal that learns how you work” |
| Agents become gimmicks | define agents as internal lenses; ban mascot/persona framing |
| Domain knowledge becomes hallucination fuel | require source reliability controls and objectivity referee checks |
| External theory overpowers user evidence | enforce user-evidence-first proof rule and strict boundary contract |
| Objectivity degrades to style-only | implement explicit evidence/logic/uncertainty/domain-validity gates |
| Intelligence Library becomes too broad | stage rollout, strict curation, versioning, and reliability filters |
| Premature Phase 7 work distracts core engine | lock phase boundaries; forbid advanced implementation in Phase 1A/2 |
| UI exposes technical internals too early | maintain copy contract and progressive disclosure in UI phases |

## 16. Final decisions

- Product category = Personal Intelligence System
- Journal = deep capture surface
- Journal remains in product for now
- no schema/route renaming now
- agents = future internal reasoning lenses
- Intelligence Library = future external domain knowledge layer
- User Library and Intelligence Library are distinct
- domain knowledge cannot prove user-specific claims by itself
- Objectivity requires evidence + logic + uncertainty + domain-validity checks
- Phase 1A can proceed after this addendum because no direct conflict is found

## 17. Open questions for later

Non-blocking for Phase 1A:

- exact Intelligence Library schema
- exact source curation method
- update cadence for new research
- domain knowledge ingestion mode: curated, RAG-based, or hybrid
- agent implementation shape: separate calls, structured passes, or modular evaluators
- whether any agent reasoning should ever be user-visible
- market research for final positioning language
- whether Journal navigation label should change in later UI phases

## 18. Final verdict

- **Does this addendum change Phase 1A?** No.
- **Does it block Phase 1A?** No.
- **What must be remembered before Phase 2?** Build conservative evidence-first synthesis and gates; do not imply full agent/domain architecture.
- **What must be remembered before Phase 7?** Phase 7 must include mature lens deliberation + Intelligence Library + stronger objectivity/referee systems, but only after core engine stability.
