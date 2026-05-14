# MindLab Understanding Engine — Architecture/Application Map v1

**Date:** 2026-05-13  
**Source documents:**
- MindLab Understanding Engine — Canonical Theory Map v1
- `docs/step2a-infrastructure-audit.md` (Infrastructure Audit)

**Status:** Architecture document — no implementation, no schema changes, no code.

---

## 1. Purpose

This document bridges the Canonical Theory Map and implementation planning. It defines:

- **How the Understanding Engine sits on top of existing MindLab infrastructure** — as an additive intelligence layer, not a replacement.
- **How existing systems feed the new brain** — patterns, tensions, timeline, actions, evidence, check-ins, journal, explore all become evidence streams.
- **How the new brain feeds existing surfaces back** — deeper outputs, cross-links, model updates, investigations, and experiments enrich what already exists.
- **What new architecture objects are needed** — UserMapConclusion, Investigation, ModelUpdate, GenerativeSelfModelEntry, FieldworkAssignment, MetaObserverFinding.
- **How the full update should be sequenced** — foundation → connection → surface → advanced intelligence → mobile parity.
- **What requires UI/product surface design before implementation** — navigation, User Map structure, Investigation flows, Explore modes, Actions/Experiments language.

### Framing

This is an **additive** update. Nothing existing is deprecated or removed:

- **Patterns** stay. They feed the User Map, Investigations, and Model Updates.
- **Tensions/Contradictions** stay. They seed Investigations and inform the User Map.
- **Actions** stay. They evolve into Actions/Experiments with feedback loops.
- **Timeline** stays. It becomes stronger as the epistemic infrastructure for all claims.
- **Receipts/Library** stay. They remain the trust/proof layer.
- **Journal/Explore/Check-ins** stay. They remain evidence capture surfaces.
- **Mobile/web parity** still matters. All new endpoints serve both.

The Understanding Engine sits **above and between** these systems. It synthesizes, connects, and explains — it does not replace.

---

## 2. Current Infrastructure Summary

### PatternClaim / PatternClaimEvidence

| Aspect | Detail |
|--------|--------|
| **What it already does** | Derives behavioral pattern claims across 5 families (trigger_condition, inner_critic, repetitive_loop, recovery_stabilizer, contradiction_drift). Has lifecycle (candidate→active→paused→dismissed), strength levels (tentative→developing→established), evidence receipts, session/journal spread tracking. |
| **How it feeds the Understanding Engine** | PatternClaims are the primary evidence stream for User Map conclusions about behavioral patterns. Each claim's summary, strength, evidence count, and spread inform confidence. |
| **What it should remain responsible for** | Pattern detection and lifecycle management. The 5-family taxonomy. Evidence receipt collection. |
| **What it should NOT be overloaded to become** | The User Map itself. A generic claim container for non-behavioral insights. A causal chain model. |

### ContradictionNode / ContradictionEvidence

| Aspect | Detail |
|--------|--------|
| **What it already does** | Detects and tracks tensions between beliefs/behaviors. Has escalation levels, rung system, snooze/surface tracking, evidence collection. |
| **How it feeds the Understanding Engine** | Contradictions are natural Investigation seeds. They reveal where the User Map has unresolved tensions. They inform Model Updates when resolved. |
| **What it should remain responsible for** | Tension detection, escalation, and surface management. |
| **What it should NOT be overloaded to become** | The full Investigation system. A multi-faceted hypothesis tracker. |

### ProfileArtifact

| Aspect | Detail |
|--------|--------|
| **What it already does** | Stores low-level extracted artifacts from evidence spans. |
| **How it feeds the Understanding Engine** | Provides raw material for User Map synthesis. A single input among many. |
| **What it should remain responsible for** | Low-level artifact extraction and storage. |
| **What it should NOT be overloaded to become** | The User Map. A structured conclusion layer. A confidence-bearing claim. |

### EvidenceSpan / Receipts

| Aspect | Detail |
|--------|--------|
| **What it already does** | Character-range evidence spans linked to messages. Receipts (PatternClaimEvidence, ContradictionEvidence) provide quote-level proof for claims. |
| **How it feeds the Understanding Engine** | Receipts are the trust/proof layer for every User Map conclusion, Investigation finding, and Model Update. |
| **What it should remain responsible for** | Evidence provenance, quote safety, display-safe proof. |
| **What it should NOT be overloaded to become** | A synthesis layer. Evidence is input, not output. |

### SurfacedAction

| Aspect | Detail |
|--------|--------|
| **What it already does** | Template-based action generation in stabilize/build buckets. Linked to patterns, claims, and goals. Status tracking (not_started, done, helped, didnt_help). |
| **How it feeds the Understanding Engine** | Action outcomes (helped/didnt_help) provide feedback that updates pattern confidence, informs Investigations, and triggers Model Updates. |
| **What it should remain responsible for** | Action surfacing, status tracking, and existing template-based generation. |
| **What it should NOT be overloaded to become** | The full Experiment/Fieldwork system. Actions are one output of the Understanding Engine, not the engine itself. |

### Timeline Aggregation

| Aspect | Detail |
|--------|--------|
| **What it already does** | Aggregates check-ins, sessions, and journal entries into rhythms, repeated signals, links, and recent states. |
| **How it feeds the Understanding Engine** | Timeline provides the temporal/epistemic context for all claims. State switches, pattern emergence, investigation progress — all anchored in timeline. |
| **What it should remain responsible for** | Temporal aggregation, rhythm detection, state sequencing. |
| **What it should NOT be overloaded to become** | A causal reasoning engine. Timeline shows what happened, not why. |

### Eval Pipeline

| Aspect | Detail |
|--------|--------|
| **What it already does** | Offline evaluation of pattern detection quality. Measures behavioral gate accuracy, family signal precision, abstention rates, faithfulness, rationale sufficiency/minimality, review routing. |
| **How it feeds the Understanding Engine** | Eval diagnostics seed the Meta-Observer / Blind Spot Engine. They reveal where the system is overconfident, under-evidenced, or wrong. |
| **What it should remain responsible for** | Offline quality measurement, regression gates, calibration. |
| **What it should NOT be overloaded to become** | The full Meta-Observer. Eval is one input — the Meta-Observer also needs live data signals, user corrections, and coverage analysis. |

### Journal / Journal Chat / Explore

| Aspect | Detail |
|--------|--------|
| **What it already does** | Free-form journal entries, journal chat sessions, explore chat sessions. User-authored evidence capture. |
| **How it feeds the Understanding Engine** | Primary evidence capture surfaces. Journal entries feed pattern detection. Explore sessions can host Investigations and emotional processing. |
| **What it should remain responsible for** | Evidence capture, user expression, exploration. |
| **What it should NOT be overloaded to become** | The only evidence source. A diagnostic/therapy interface. |

### Check-ins

| Aspect | Detail |
|--------|--------|
| **What it already does** | State/event check-ins with tags and notes. |
| **How it feeds the Understanding Engine** | State switches feed timeline, inform emotional processing context, seed fieldwork observations. |
| **What it should remain responsible for** | State capture, event tracking. |
| **What it should NOT be overloaded to become** | A full journal replacement. |

### Library

| Aspect | Detail |
|--------|--------|
| **What it already does** | Aggregates receipts from patterns, contradictions, actions, and references into a unified view. |
| **How it feeds the Understanding Engine** | Library is the proof/trust surface. Users can review evidence behind any claim. |
| **What it should remain responsible for** | Receipt aggregation, evidence browsing, trust verification. |
| **What it should NOT be overloaded to become** | A synthesis or conclusion surface. |

### Web Surfaces

| Aspect | Detail |
|--------|--------|
| **What they already do** | 30+ routes covering Today, Journal, Chat, Explore, Check-ins, Timeline, Patterns, Contradictions, Actions, Evidence, Library, References, Import, Settings, etc. |
| **How they feed the Understanding Engine** | Each surface is a potential consumer of Understanding Engine outputs. Today can show model updates. Patterns can link to investigations. Actions can show experiment results. |
| **What they should remain responsible for** | Their existing surfaces and data display. |
| **What they should NOT be overloaded to become** | Intelligence engines themselves. Surfaces display intelligence — they don't generate it. |

### Mobile Surfaces

| Aspect | Detail |
|--------|--------|
| **What they already do** | 7 screen components consuming backend APIs. Timeline, pattern detail, tension detail, account. |
| **How they feed the Understanding Engine** | Mobile consumes the same backend APIs. New Understanding Engine endpoints serve both web and mobile. |
| **What they should remain responsible for** | Thin client display of backend-derived intelligence. |
| **What they should NOT be overloaded to become** | Intelligence computation. Mobile must not reimplement backend logic. |

---

## 3. Additive Understanding Engine Layer

The Understanding Engine is a **higher synthesis layer** that connects and coordinates existing systems. It does not replace them — it makes them more connected, explainable, and useful.

### What it synthesizes

| Input | Source System | How Used |
|-------|--------------|----------|
| Pattern claims | PatternClaim | User Map conclusions, Investigation evidence, Model Update triggers |
| Tensions | ContradictionNode | Investigation seeds, User Map uncertainty, Model Update triggers |
| Profile artifacts | ProfileArtifact | Low-level input to User Map synthesis |
| Timeline evidence | Timeline aggregation | Temporal context for all claims, state switch detection |
| User-authored content | Journal, Explore, Check-ins | Evidence capture, fieldwork observations, emotional episodes |
| Action outcomes | SurfacedAction | Feedback loop for pattern confidence, Investigation progress |
| Fieldwork observations | FieldworkAssignment (new) | Investigation evidence, Model Update triggers |
| Model updates | ModelUpdate (new) | Change history, progress visibility |
| User corrections | User feedback on claims | Confidence adjustment, lifecycle changes |
| Receipts/evidence | PatternClaimEvidence, ContradictionEvidence, EvidenceSpan | Trust/proof layer for all conclusions |
| Emotional episodes | Explore sessions + Check-ins | State ecology, emotional processing context |
| Decisions | DerivationRun, system actions | Audit trail, model history |

### What it produces

| Output | Consumer | Purpose |
|--------|----------|---------|
| User Map conclusions | Today, User Map surface, Explore | What the model believes about the user |
| Investigations | Investigations surface, Explore, Timeline | Active research threads |
| Model Updates | Today, Timeline, User Map | What changed and why |
| Actions/Experiments | Actions surface, Today | What to try next |
| Fieldwork assignments | Check-ins, Today, Explore | What to watch for |
| Meta-Observer findings | Internal (shadow mode) | System quality, blind spots |
| Generative self-model entries | User Map, Explore | Causal understanding (v1 conservative) |

### How it connects

```
                    ┌─────────────────────────────────┐
                    │     Understanding Engine         │
                    │  (synthesis + coordination)      │
                    └─────────────────────────────────┘
                         ↕           ↕           ↕
              ┌──────────┘           │           └──────────┐
              ▼                      ▼                      ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │  Evidence Layer  │   │  Trust Layer     │   │  Surface Layer  │
    │  (Patterns,      │   │  (Receipts,      │   │  (Today, User   │
    │   Tensions,      │   │   Library,       │   │   Map, Explore, │
    │   Timeline,      │   │   EvidenceSpan)  │   │   Actions,      │
    │   Journal,       │   │                  │   │   Timeline,     │
    │   Check-ins)     │   │                  │   │   Mobile)       │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 4. System Relationship Map

### Evidence Flow

```
Journal / Explore / Check-ins
    │
    ▼
Evidence Landscape (raw data)
    │
    ├──▶ PatternClaim (behavioral patterns)
    │       │
    │       ├──▶ User Map (evidence-backed conclusions)
    │       ├──▶ Investigations (pattern needs exploration)
    │       └──▶ Model Updates (pattern strength changed)
    │
    ├──▶ ContradictionNode (tensions)
    │       │
    │       ├──▶ Investigations (tension seeds research)
    │       ├──▶ User Map (tension = uncertainty)
    │       └──▶ Model Updates (tension resolved/emerged)
    │
    ├──▶ ProfileArtifact (low-level extraction)
    │       │
    │       └──▶ User Map (one input among many)
    │
    ├──▶ Timeline (temporal context)
    │       │
    │       ├──▶ All claims (time/state anchoring)
    │       ├──▶ Investigations (when things happened)
    │       └──▶ Model Updates (change history)
    │
    └──▶ EvidenceSpan / Receipts (trust layer)
            │
            ├──▶ All claims (proof)
            ├──▶ Library (browsable evidence)
            └──▶ User corrections (confidence adjustment)
```

### Feedback Flow

```
User Map
    │
    ├──▶ Actions/Experiments (what to try)
    │       │
    │       └──▶ Action outcomes → Model Updates → User Map
    │
    ├──▶ Fieldwork (what to watch for)
    │       │
    │       └──▶ Observations → Investigations → User Map
    │
    ├──▶ Explore (investigation conversation)
    │       │
    │       └──▶ Insights → User Map
    │
    └──▶ Today (model updates visible)
            │
            └──▶ User engagement → more evidence → User Map
```

### Quality Flow

```
Eval Pipeline
    │
    └──▶ Meta-Observer / Blind Spot Engine
            │
            ├──▶ Thin areas → Investigations
            ├──▶ Overconfidence → Model Updates (confidence down)
            ├──▶ Weak evidence → Fieldwork (gather more)
            ├──▶ Stuck investigations → User attention
            └──▶ User corrections → Confidence/lifecycle updates
```

---

## 5. Proposed New Architecture Objects

### UserMapConclusion / UserMapNode

| Aspect | Detail |
|--------|--------|
| **Purpose** | The evidence-backed conclusion layer for the User Map. Represents what the model believes about the user, with clear distinction between conclusion and hypothesis. |
| **What it represents** | A synthesized, evidence-backed understanding of one aspect of the user's inner system. Not a raw pattern — a conclusion drawn from multiple evidence streams. |
| **Existing inputs** | PatternClaim (summaries, strength, evidence), ContradictionNode (tensions that inform this area), ProfileArtifact (low-level extractions), Timeline (temporal context), QuickCheckIn (state patterns), JournalEntry (user's own understanding), Action outcomes (what worked/didn't), Fieldwork observations, User corrections |
| **Likely fields** | `id`, `userId`, `title`, `summary`, `category` (behavioral_pattern \| value \| strength \| identity_belief \| relational \| developmental), `confidence` (0..1), `status` (hypothesis \| tentative \| established \| revised \| superseded), `evidenceSummary` (JSON: {patternClaimIds[], contradictionNodeIds[], fieldworkIds[], actionOutcomeIds[], correctionIds[]}), `evidenceCount`, `sourceDiversity` (how many different source types), `timeSpread` (days between first and last evidence), `lastUpdatedAt`, `version`, `supersededById`, `userCorrection` (user feedback: accurate \| partial \| inaccurate), `relatedInvestigationIds[]`, `relatedModelUpdateIds[]`, `relatedTimelineEventIds[]` |
| **Persisted?** | **Yes** — persisted table, updated by derivation runs. Versioned for diff tracking. |
| **What feeds it** | Understanding Engine synthesis pass (reads from PatternClaim, ContradictionNode, ProfileArtifact, Timeline, Fieldwork, Action outcomes) |
| **What reads it** | Today surface, User Map surface, Explore, Investigation detail, Model Update generation |
| **How it connects to existing systems** | References PatternClaims (not replaces them). References ContradictionNodes. References EvidenceSpan/Receipts for proof. Feeds Model Updates when changed. Feeds Actions/Experiments generation. |
| **What it must NOT replace** | PatternClaim (patterns remain their own system). ContradictionNode (tensions remain their own system). ProfileArtifact (low-level extraction remains). Timeline (temporal infrastructure remains). |

### Investigation

| Aspect | Detail |
|--------|--------|
| **Purpose** | An active research thread about the user, organized around an unresolved mechanism, tension, pattern, state, behavior, contradiction, or developmental question. |
| **What it represents** | A structured inquiry into something the model doesn't fully understand yet. Not a question — a research thread with competing theories, evidence for/against, and a resolution path. |
| **Existing inputs** | ContradictionNode (primary seed — tensions naturally suggest investigation), PatternClaim (patterns needing deeper exploration), QuickCheckIn state transitions (unexplained changes), Timeline anomalies, User curiosity (from Explore), Action failures (why didn't this help?), Fieldwork results (unexpected observations), User corrections (model got it wrong) |
| **Likely fields** | `id`, `userId`, `title`, `organizingQuestion`, `status` (open \| gathering_evidence \| testing \| resolving \| resolved \| abandoned), `source` (contradiction \| pattern \| state_switch \| user_curiosity \| fieldwork_result \| model_uncertainty \| user_correction), `sourceIds[]` (references to originating objects), `competingTheories` (JSON: [{label, summary, evidenceFor, evidenceAgainst, confidence}]), `evidenceNeeded` (what would resolve this), `relatedUserMapConclusionIds[]`, `relatedPatternClaimIds[]`, `relatedContradictionNodeIds[]`, `relatedTimelineEventIds[]`, `relatedFieldworkAssignmentIds[]`, `relatedActionExperimentIds[]`, `resolutionSummary`, `resolvedAt`, `resolvedIntoUserMapConclusionId` |
| **Persisted?** | **Yes** — backend model with lightweight frontend cache. |
| **What feeds it** | Created from seeds (contradictions, patterns, state switches, user curiosity). Updated by fieldwork results, action outcomes, Explore conversations, new evidence. |
| **What reads it** | Investigations surface, Explore (investigation mode), User Map (related investigations), Today (active investigations), Timeline (investigation history) |
| **How it connects to existing systems** | Seeds from ContradictionNode. References PatternClaim. Generates FieldworkAssignments. Generates Actions/Experiments. Updates User Map on resolution. Appears on Timeline. |
| **What it must NOT replace** | ContradictionNode (tensions remain). PatternClaim (patterns remain). The investigation is a meta-layer that connects them. |

### ModelUpdate

| Aspect | Detail |
|--------|--------|
| **Purpose** | Records that MindLab's understanding changed — a conclusion strengthened/weakened, a new link appeared, an investigation progressed, a fieldwork result clarified something. |
| **What it represents** | A single atomic change in the model's understanding. Not a full system state — a delta. |
| **Existing inputs** | DerivationRun (temporal anchor), PatternClaim lifecycle transitions, ContradictionNode status changes, UserMapConclusion confidence changes, Investigation status changes, FieldworkAssignment completions, Action outcome recordings, User corrections |
| **Likely fields** | `id`, `userId`, `updateType` (conclusion_strengthened \| conclusion_weakened \| conclusion_added \| conclusion_superseded \| investigation_progressed \| investigation_resolved \| fieldwork_completed \| action_outcome_recorded \| contradiction_emerged \| contradiction_resolved \| user_correction_applied \| model_maturity_increased), `affectedObjectType` (usermap_conclusion \| investigation \| pattern_claim \| contradiction_node \| fieldwork_assignment \| action_experiment), `affectedObjectId`, `beforeSummary` (short description of previous state), `afterSummary` (short description of new state), `evidenceBasis` (what evidence drove this change), `confidenceDelta` (how confidence moved, if applicable), `userFacingSummary` (one sentence for Today/User Map), `internalOnly` (boolean — true for system-internal updates not shown to user), `derivationRunId` (link to the run that produced this), `createdAt` |
| **Persisted?** | **Yes** — lightweight event record. |
| **What feeds it** | Understanding Engine after each derivation run, Investigation status changes, Action outcome recordings, User corrections. |
| **What reads it** | Today (latest updates), Timeline (update history), User Map (change history for a conclusion), Explore (context for conversation) |
| **How it connects to existing systems** | Links to DerivationRun. References affected objects by type+id. Appears on Timeline. Feeds Today's "what changed" summary. |
| **What it must NOT replace** | DerivationRun (run audit trail remains). Timeline (temporal infrastructure remains). ModelUpdate is a lightweight event layer on top of both. |

### GenerativeSelfModelEntry / CausalChain

| Aspect | Detail |
|--------|--------|
| **Purpose** | The lightweight v1 version of the Generative Self-Model. Models causal chains only where evidence is strong enough. |
| **What it represents** | A conservative causal link between events/states/patterns in the user's inner system. Not autonomous causal modeling — evidence-backed chains. |
| **Existing inputs** | PatternClaim (pattern families as chain nodes), ContradictionNode (tensions between chain elements), QuickCheckIn (state transitions), Timeline (temporal ordering), Action outcomes (what broke or reinforced a chain) |
| **Likely fields** | `id`, `userId`, `chain` (ordered array of nodes: [{type: event \| interpretation \| state \| strategy \| function \| cost \| stabilizer \| identity_update}, summary, sourceType, sourceId, confidence}]), `evidenceSummary` (what evidence supports this chain), `evidenceCount`, `timeSpread`, `status` (speculative \| plausible \| established), `relatedUserMapConclusionIds[]`, `relatedInvestigationIds[]`, `lastUpdatedAt` |
| **Persisted?** | **Yes** — but only created when evidence is strong enough. Not generated speculatively. |
| **What feeds it** | Understanding Engine synthesis pass, only when multiple evidence streams converge on the same causal pattern. |
| **What reads it** | User Map (causal context), Explore (deeper understanding), Investigation (causal hypothesis) |
| **How it connects to existing systems** | References PatternClaims as chain nodes. References ContradictionNodes as tension points. References Timeline for temporal ordering. |
| **What it must NOT replace** | PatternClaim (patterns remain independent). ContradictionNode (tensions remain). The causal chain is a synthesis, not a replacement. |
| **V1 constraint** | Only create causal chains when: (1) ≥3 evidence sources converge, (2) time spread ≥7 days, (3) no active contradiction contradicts the chain, (4) confidence ≥0.6 on all nodes. |

### Action / Experiment

| Aspect | Detail |
|--------|--------|
| **Purpose** | Evolves existing SurfacedAction into model-derived experiments with feedback loops. Uses "Actions / Experiments" as primary language. |
| **What it represents** | A move the user can try (action) or a structured test of a hypothesis (experiment). Both have feedback that updates the model. |
| **Existing inputs** | SurfacedAction (existing infrastructure), PatternClaim (what patterns suggest trying), ContradictionNode (what tensions need testing), Investigation (what hypothesis needs testing), UserMapConclusion (what understanding needs validation), FieldworkAssignment (what observation needs action) |
| **Likely fields** | `id`, `userId`, `type` (action \| experiment), `source` (template \| model_derived \| investigation \| fieldwork), `sourceIds[]`, `title`, `description`, `hypothesis` (for experiments: "if I do X, then Y should happen"), `bucket` (stabilize \| build \| explore \| test), `status` (suggested \| active \| completed \| dismissed), `outcome` (helped \| didnt_help \| unclear \| in_progress), `outcomeDetail` (user's description of what happened), `conditions` (when this action works/fails — JSON), `linkedFamily`, `linkedClaimId`, `linkedGoalId`, `linkedInvestigationId`, `linkedFieldworkAssignmentId`, `feedbackLoop` (did this update the model? — JSON: {updatedUserMapConclusionIds[], updatedInvestigationIds[], modelUpdateIds[]}) |
| **Persisted?** | **Yes** — extends SurfacedAction or parallel model. |
| **What feeds it** | Understanding Engine (model-derived), Investigation (hypothesis testing), Template system (existing), User (manual creation) |
| **What reads it** | Actions surface, Today, Investigation detail, Explore |
| **How it connects to existing systems** | Extends SurfacedAction infrastructure. Links to PatternClaim, ContradictionNode, Investigation, FieldworkAssignment. Feeds back into User Map and Model Updates. |
| **What it must NOT replace** | Existing SurfacedAction (template-based actions remain). The evolution is additive — experiments alongside existing actions. |

### FieldworkAssignment

| Aspect | Detail |
|--------|--------|
| **Purpose** | A lightweight observation task. Separate from Actions — Actions = try this move, Fieldwork = watch for this signal. |
| **What it represents** | A prompt to observe and report on a specific signal, state, or pattern in daily life. |
| **Existing inputs** | Investigation (what evidence is needed), UserMapConclusion (what needs validation), PatternClaim (what needs observation), ContradictionNode (what tension needs monitoring) |
| **Likely fields** | `id`, `userId`, `title`, `watchFor` (what signal to observe), `whyItMatters` (linked to investigation/model area), `capturePrompt` (what to record), `status` (active \| completed \| dismissed), `observation` (user's report), `evidenceReturned` (links to receipts/evidence), `linkedInvestigationId`, `linkedUserMapConclusionId`, `linkedPatternClaimId`, `linkedContradictionNodeId`, `completesAt` (optional deadline), `createdAt`, `completedAt` |
| **Persisted?** | **Yes** — lightweight model. |
| **What feeds it** | Investigation (evidence needed), User Map (validation needed), Pattern Claim (observation needed) |
| **What reads it** | Today (fieldwork prompts), Check-ins (observation capture), Explore (fieldwork conversation), Investigation detail |
| **How it connects to existing systems** | Links to Investigation, User Map, Pattern Claim, Contradiction. Feeds observations back into all of them. Appears on Timeline. |
| **What it must NOT replace** | Actions (fieldwork is observation, not action). Check-ins (fieldwork is structured observation, check-ins are free-form state capture). |

### ModelMaturitySignal

| Aspect | Detail |
|--------|--------|
| **Purpose** | Responsible version of model maturity levels. Signals reflect model depth, not user worth. |
| **What it represents** | A set of evidence-backed signals about how developed the model's understanding is. Not a gamified level — a diagnostic signal. |
| **Existing inputs** | Total evidence count, source diversity (how many different source types), pattern coverage (how many families have established claims), contradiction awareness (tensions identified), investigation depth (investigations resolved), time span (days between first and latest evidence), user correction rate (how often the model gets it wrong) |
| **Likely fields** | Not a persisted model — computed on read from existing data. Signals: `evidenceVolume` (low \| medium \| high), `sourceDiversity` (low \| medium \| high), `patternCoverage` (families with established claims / total families), `contradictionAwareness` (tensions tracked), `investigationDepth` (investigations resolved), `timeSpan` (days), `userCorrectionRate` (corrections / total claims), `overallMaturity` (early \| developing \| established — computed from signals) |
| **Persisted?** | **No** — computed on read from existing data. |
| **What feeds it** | Aggregate queries across PatternClaim, ContradictionNode, Investigation, UserMapConclusion, DerivationRun. |
| **What reads it** | Today (subtle maturity indicator), User Map (context for confidence), Internal (Meta-Observer input) |
| **What it must NOT be** | A gamified progress bar. A "73% complete" meter. A ranking compared to other users. A measure of user worth. |
| **What not to fake** | Do not create maturity levels from message count alone. Do not present "Level 3 of 5" as if it means something. Maturity signals should answer "how much evidence does the model have?" not "how good is the user?" |

### MetaObserverFinding

| Aspect | Detail |
|--------|--------|
| **Purpose** | Internal system-quality layer. Detects thin areas, stuck investigations, weak evidence, overconfidence, ignored surfaces, missing feedback, repeated user corrections. |
| **What it represents** | A finding about the model's own quality or blind spots. Not user-facing by default — feeds system improvement. |
| **Existing inputs** | Eval pipeline (behavioral gate accuracy, family signal precision, abstention rates, faithfulness), PatternClaim (low-confidence claims, stale claims), ContradictionNode (stuck tensions), Investigation (stuck investigations, no progress), UserMapConclusion (low evidence count, low source diversity), FieldworkAssignment (uncompleted assignments), Action outcomes (high didnt_help rate), User corrections (repeated corrections on same area), Timeline (signals with no corresponding claim) |
| **Likely fields** | `id`, `findingType` (thin_evidence \| stuck_investigation \| overconfidence \| underconfidence \| ignored_surface \| missing_feedback \| repeated_correction \| blind_spot \| eval_regression), `severity` (info \| warning \| critical), `summary`, `detail`, `affectedObjectType`, `affectedObjectId`, `evidenceBasis` (what data supports this finding), `suggestedAction` (what to do about it — e.g., "gather more evidence in X area", "review investigation Y"), `status` (open \| acknowledged \| resolved), `internalOnly` (boolean — most findings are internal), `createdAt`, `resolvedAt` |
| **Persisted?** | **Yes** — internal system table. |
| **What feeds it** | Eval pipeline (scheduled runs), Live data analysis (periodic scans), User correction analysis, Coverage analysis |
| **What reads it** | System operators (if any), Automated improvement triggers, Development team (for product decisions) |
| **How it connects to existing systems** | Reads from all existing models. Eval pipeline is one input — not the whole Meta-Observer. |
| **What it must NOT be** | User-facing by default. A source of anxiety for users. A replacement for human judgment about product direction. |

---

## 6. Existing Model Reuse Map

| Existing Model/Pipeline | Current Role | How It Feeds the Understanding Engine | What It Must Not Replace | Needed Extension/New Layer |
|------------------------|-------------|--------------------------------------|--------------------------|---------------------------|
| **PatternClaim** | Behavioral pattern detection (5 families) | Primary evidence stream for User Map conclusions. Informs Investigation seeds. Triggers Model Updates on lifecycle transitions. | User Map itself. Generic claim container. Causal chain model. | None — feed into UserMapConclusion synthesis. |
| **PatternClaimEvidence** | Quote-level receipts for pattern claims | Trust/proof layer for User Map conclusions. Evidence for Investigation findings. | Synthesis layer. Evidence is input, not output. | May need cross-linking to UserMapConclusion. |
| **ContradictionNode** | Tension detection and escalation | Primary Investigation seed. Informs User Map uncertainty. Triggers Model Updates on resolution/emergence. | Full Investigation system. Multi-faceted hypothesis tracker. | Link to Investigation model. |
| **ContradictionEvidence** | Quote-level receipts for contradictions | Evidence for Investigation findings. Trust layer for tension claims. | Investigation evidence system. | May need cross-linking to Investigation. |
| **ProfileArtifact** | Low-level artifact extraction | One input among many to User Map synthesis. Raw material, not conclusion. | User Map. Structured conclusion layer. | None — keep as low-level input. |
| **EvidenceSpan** | Character-range evidence spans | Trust/proof layer for all Understanding Engine claims. | Synthesis or conclusion layer. | May need linking to UserMapConclusion. |
| **ReferenceItem** | Goals and memory items | Context for Action/Experiment generation. Input to User Map (values, goals). | Investigation or User Map. | May need linking to Investigation. |
| **SurfacedAction** | Template-based action generation | Foundation for Actions/Experiments. Outcome feedback loop for User Map and Investigations. | Full Experiment/Fieldwork system. | Extend with experiment type, hypothesis, feedback loop, investigation linking. |
| **QuickCheckIn** | State/event check-ins | State switch detection for Timeline. Input to emotional processing context. Fieldwork observation capture. | Full journal or investigation system. | May need fieldwork-specific capture fields. |
| **JournalEntry** | Free-form journal entries | Evidence capture for pattern detection. User's own understanding. Fieldwork reflection. | Structured investigation or conclusion system. | None — keep as free-form capture. |
| **Session/Message** | Chat sessions and messages | Evidence capture for pattern detection. Explore conversation context. Investigation conversation host. | Intelligence engine. | May need surface type expansion for Release/Understand/Move modes. |
| **Timeline aggregation** | Temporal aggregation of check-ins, sessions, journal entries | Epistemic infrastructure for all claims. Temporal context for User Map, Investigations, Model Updates. | Causal reasoning engine. | May need model update and investigation event integration. |
| **Import pipeline** | ChatGPT archive import | Historical evidence for pattern detection. Feeds User Map with longitudinal data. | Real-time intelligence. | None — keep as data ingestion. |
| **Eval pipeline** | Offline pattern detection quality measurement | Seeds Meta-Observer findings. Reveals overconfidence, under-evidence, blind spots. | Full Meta-Observer. | Extend with live data analysis, user correction analysis, coverage analysis. |

---

## 7. Agent Deliberation Practical V1

### Design Principle

Do not build fantasy autonomous agents. V1 deliberation is a **structured model call** with clear input/output contracts, not an autonomous reasoning loop.

### V1 Deliberation Structure

```
1. Evidence Packet Builder
   ├── Collects: active PatternClaims, active ContradictionNodes,
   │             recent Timeline state, recent Check-ins,
   │             active Investigations, recent Action outcomes,
   │             pending FieldworkAssignments, User corrections
   └── Output: structured evidence packet (JSON)

2. Domain Interpretation Pass
   ├── Input: evidence packet
   ├── Process: one structured LLM call with:
   │   - System prompt defining the Understanding Engine role
   │   - Evidence packet as context
   │   - Clear output schema
   └── Output: structured interpretation (JSON)

3. Objectivity/Referee Pass
   ├── Input: interpretation from step 2
   ├── Process: rule-based gates:
   │   - Evidence sufficiency check (enough evidence?)
   │   - Time spread check (not from one day?)
   │   - Source diversity check (not from one source?)
   │   - Contradiction check (does existing evidence contradict?)
   │   - User correction check (has user corrected this area?)
   │   - High-emotion state guard (don't make stable claims from emotional data)
   │   - Clinical/diagnostic language guard (no "you have X disorder")
   │   - Overclaim guard (don't present hypothesis as conclusion)
   └── Output: gated interpretation (some claims rejected, some confidence-adjusted)

4. Routing Pass
   ├── Input: gated interpretation
   ├── Process: determine where each output goes:
   │   - User Map (new/updated conclusions)
   │   - Investigations (new evidence for existing threads)
   │   - Model Updates (changes worth recording)
   │   - Actions/Experiments (new suggestions)
   │   - Fieldwork (new observation tasks)
   │   - Meta-Observer (internal quality findings)
   └── Output: routing decisions (JSON)

5. Persistence/Update Pass
   ├── Input: routing decisions
   ├── Process: write to appropriate tables:
   │   - Upsert UserMapConclusion records
   │   - Update Investigation records
   │   - Create ModelUpdate records
   │   - Create/update Action/Experiment records
   │   - Create FieldworkAssignment records
   │   - Create MetaObserverFinding records (internal only)
   └── Output: persisted state changes

6. User-Facing Summary Pass
   ├── Input: persisted state changes
   ├── Process: generate user-facing summaries:
   │   - "Your model updated: [conclusion] strengthened"
   │   - "Investigation progressed: [finding]"
   │   - "New experiment suggested: [action]"
   │   - "Fieldwork prompt: watch for [signal]"
   └── Output: user-facing summaries (for Today, Timeline, notifications)
```

### What is hidden

- Raw LLM outputs (only structured, gated interpretations are persisted)
- Meta-Observer findings (internal only by default)
- Confidence scores below threshold
- Rejected interpretations (logged but not persisted)
- Evidence packet details (not shown to user — only conclusions)

### What is persisted

- UserMapConclusion records (with evidence provenance)
- Investigation updates
- ModelUpdate records
- Action/Experiment records
- FieldworkAssignment records
- MetaObserverFinding records (internal)

### What is rejected

- Interpretations that fail objectivity gates
- Claims with insufficient evidence (<2 sources, <3 day spread)
- Claims contradicted by existing evidence without resolution
- Clinical/diagnostic language
- High-emotion statements treated as stable identity claims

### What is user-facing

- User Map conclusions (with confidence indicators)
- Investigation status and findings
- Model Updates (what changed summaries)
- Actions/Experiments (suggestions and results)
- Fieldwork prompts
- All with evidence provenance links to Library/Receipts

### What is evaluated

- Deliberation quality (sampled — does the output match the evidence?)
- Objectivity gate accuracy (are we rejecting the right things?)
- User satisfaction (do users find conclusions accurate?)
- Model Update relevance (are updates meaningful to users?)

---

## 8. Objectivity / Safety Architecture

### What the system must prevent

| Risk | Prevention |
|------|-----------|
| **State/trait confusion** | Never treat a temporary emotional state as a stable personality trait. Require ≥3 occurrences across ≥7 days before any trait-level claim. |
| **Hypotheses becoming conclusions** | Clear status taxonomy: hypothesis → tentative → established. Never skip levels. Never present a hypothesis as a conclusion in user-facing language. |
| **Diagnosis language** | Blocklist for clinical/diagnostic terms (disorder, syndrome, diagnosis, condition, pathological, etc.). System prompt must explicitly forbid diagnostic framing. |
| **Overclaiming** | Confidence must match evidence. A claim with 2 receipts across 1 session cannot have confidence >0.3. Enforce via rule-based gate. |
| **High-emotion statements as stable identity claims** | Detect high-emotion language in source material. Flag any claim derived primarily from emotional content. Require non-emotional corroborating evidence. |
| **Generic advice** | All Actions/Experiments must be linked to specific evidence (pattern, tension, investigation). No generic "try meditation" without context. |
| **Fake confidence** | Confidence must be computable from evidence count, source diversity, time spread, and user correction rate. No manual confidence overrides. |
| **Fake progress** | Model Maturity Signals must be computed from real data. No hardcoded levels. No "73% complete" meters. |
| **Model updates that sound deeper than evidence supports** | User-facing summaries must match the evidence delta. If only one piece of evidence changed, the summary must reflect that. |

### Objectivity Gates

| Gate | Rule | Applies To |
|------|------|-----------|
| **Evidence sufficiency** | ≥2 evidence sources from ≥2 different source types | All User Map conclusions |
| **Time spread** | ≥3 days between first and last evidence | All User Map conclusions |
| **Source diversity** | ≥2 different source types (pattern, contradiction, journal, check-in, action outcome, fieldwork) | Established-level conclusions |
| **Contradiction check** | No active contradiction directly contradicts this claim. If contradiction exists, status must be "hypothesis" until resolved. | All claims |
| **User correction check** | If user has corrected this area, confidence is reduced by 50% until new corroborating evidence arrives. | All claims |
| **High-emotion state guard** | If >50% of evidence comes from high-emotion sessions, status cannot exceed "tentative." | All claims |
| **Clinical/diagnostic language guard** | Regex blocklist + LLM output filter. Any output containing blocked terms is rejected. | All user-facing output |
| **User-facing language guard** | No absolute statements ("you are," "you always," "you never"). Use "tends to," "often," "sometimes," "in these conditions." | All user-facing output |
| **Overclaim guard** | Confidence cap based on evidence: ≤0.3 for 2 sources, ≤0.5 for 3-5 sources, ≤0.7 for 6-10 sources, ≤0.85 for 10+ sources. | User Map conclusions |
| **Investigation resolution guard** | An investigation cannot resolve until: (1) ≥3 evidence sources, (2) ≥2 competing theories considered, (3) fieldwork or experiment completed, (4) no active contradiction blocks resolution. | Investigations |

### Safety Architecture Diagram

```
LLM Output
    │
    ▼
Clinical/Diagnostic Language Guard ──── Rejected (logged)
    │
    ▼
User-Facing Language Guard ──── Rewritten (softer language)
    │
    ▼
Evidence Sufficiency Gate ──── Rejected (confidence too low)
    │
    ▼
Time Spread Gate ──── Rejected (too recent)
    │
    ▼
Source Diversity Gate ──── Status capped (can't be "established")
    │
    ▼
Contradiction Check ──── Status capped (can't resolve contradiction)
    │
    ▼
User Correction Check ──── Confidence reduced
    │
    ▼
High-Emotion State Guard ──── Status capped (can't exceed "tentative")
    │
    ▼
Overclaim Guard ──── Confidence capped
    │
    ▼
Persisted Output
```

---

## 9. User-Facing Surface Architecture

### Today

**Current state:** Dashboard route (`/`). Likely shows recent activity, quick actions.

**Under the Understanding Engine:**

| Element | What It Shows | Data Source |
|---------|--------------|-------------|
| Model Updates | "Your model updated: [conclusion] strengthened/weakened" — last 3-5 updates | ModelUpdate (userFacingSummary) |
| Active Investigations | "You have [N] active investigations" — linked to detail | Investigation (status=open) |
| Fieldwork Prompts | "Watch for: [signal]" — highest priority incomplete assignment | FieldworkAssignment (status=active) |
| Actions/Experiments | "Try: [action]" — highest priority suggested action | Action/Experiment (status=suggested) |
| "What Changed" Summary | One-sentence summary of the most significant model update today | ModelUpdate (most recent, non-internal) |

### User Map

**New surface** — a route like `/user-map` or a section within Today.

| Section | What It Shows | Data Source |
|---------|--------------|-------------|
| Conclusions | List of UserMapConclusion records, grouped by category | UserMapConclusion |
| Confidence Indicators | Visual indicator of confidence (low/medium/high) per conclusion | UserMapConclusion.confidence |
| Evidence Provenance | "Based on [N] patterns, [N] tensions, [N] observations" — links to detail | UserMapConclusion.evidenceSummary |
| Related Investigations | "Being explored in [N] investigations" — links | UserMapConclusion.relatedInvestigationIds |
| Related Actions | "Tested in [N] actions/experiments" — links | Action/Experiment feedbackLoop |
| Model Update History | "This conclusion has changed [N] times" — timeline of updates | ModelUpdate (filtered by affectedObjectId) |
| Receipts | Links to Library for full evidence review | PatternClaimEvidence, ContradictionEvidence, etc. |
| User Correction | "Does this seem accurate?" — feedback prompt | UserMapConclusion.userCorrection |

### Investigations

**New surface** — a route like `/investigations` or a mode within Contradictions.

| Element | What It Shows | Data Source |
|---------|--------------|-------------|
| Investigation List | Active investigations, sorted by priority/recency | Investigation (status≠resolved) |
| Investigation Detail | Organizing question, competing theories, evidence for/against, evidence needed | Investigation |
| Related Patterns | Patterns that inform this investigation | Investigation.relatedPatternClaimIds |
| Related Tensions | Tensions that seeded this investigation | Investigation.relatedContradictionNodeIds |
| Related Fieldwork | Active fieldwork assignments for this investigation | FieldworkAssignment (linked) |
| Related Actions/Experiments | Experiments testing this investigation's hypotheses | Action/Experiment (linked) |
| Timeline | Investigation events in chronological order | ModelUpdate + Timeline (filtered) |
| Resolution | When resolved: summary, linked User Map conclusion | Investigation.resolutionSummary |

### Explore

**Current state:** Chat surface with explore mode. System prompt governs behavior.

**Under the Understanding Engine:**

| Mode | What It Does | Data Available |
|------|-------------|---------------|
| **Normal Explore** | Current behavior — open-ended exploration | All existing data |
| **Release Mode** | Emotional processing — safe space to express, no model updates from emotional content alone | Current state (from Check-in), no pattern derivation triggered |
| **Understand Mode** | Investigation conversation — explore a specific investigation with the model's full context | Investigation detail, related User Map conclusions, related patterns/tensions |
| **Move Mode** | Action/experiment planning — design and commit to an experiment | Action/Experiment templates, investigation hypotheses, fieldwork assignments |

**Safety constraints per mode:**

| Mode | Pattern Derivation | Model Updates | User Map Updates | Emotional Guard |
|------|-------------------|---------------|-----------------|----------------|
| Normal | Yes | Yes | Yes | Standard |
| Release | **No** | **No** | **No** | **Enhanced** — no stable claims from emotional content |
| Understand | No (manual) | Yes (if investigation progresses) | Yes (if conclusion changes) | Standard |
| Move | No | Yes (if action outcome recorded) | Yes (if experiment resolves something) | Standard |

### Actions / Experiments

**Current state:** Actions route (`/actions`). Template-based actions in stabilize/build buckets.

**Under the Understanding Engine:**

| Element | What It Shows | Data Source |
|---------|--------------|-------------|
| Existing Actions | Current template-based actions (unchanged) | SurfacedAction |
| Model-Derived Actions | Actions generated from User Map conclusions | Action/Experiment (source=model_derived) |
| Experiments | Hypothesis-testing actions with feedback loop | Action/Experiment (type=experiment) |
| Tested Moves | Actions with outcome recorded, conditions noted | Action/Experiment (status=completed) |
| Feedback Results | "This helped / didn't help" — with model update context | Action/Experiment.outcome + feedbackLoop |
| Conditions | "Works when: [condition]. Fails when: [condition]" | Action/Experiment.conditions |

### Timeline

**Current state:** Timeline route (`/timeline`). Aggregates check-ins, sessions, journal entries.

**Under the Understanding Engine:**

| Addition | What It Shows | Data Source |
|----------|--------------|-------------|
| Model Update Events | "Model updated: [conclusion] strengthened" — inline in timeline | ModelUpdate |
| Investigation Events | "Investigation progressed: [finding]" — inline | Investigation status changes |
| Fieldwork Events | "Fieldwork completed: [observation]" — inline | FieldworkAssignment completions |
| Action Outcome Events | "Experiment result: [outcome]" — inline | Action/Experiment outcome recordings |
| State Switch Context | Timeline now shows what model updates coincided with state changes | QuickCheckIn + ModelUpdate |

### Library / Receipts

**Current state:** Library route (`/library`). Aggregates receipts from patterns, contradictions, actions, references.

**Under the Understanding Engine:**

| Addition | What It Shows | Data Source |
|----------|--------------|-------------|
| User Map Receipts | Evidence behind User Map conclusions | UserMapConclusion.evidenceSummary → linked receipts |
| Investigation Receipts | Evidence collected during investigations | Investigation → linked PatternClaimEvidence, ContradictionEvidence, FieldworkAssignment |
| Model Update Receipts | Evidence that drove a model update | ModelUpdate.evidenceBasis |
| Correction History | User corrections and their impact | UserMapConclusion.userCorrection + related ModelUpdates |

### Check-ins

**Current state:** Check-ins route (`/check-ins`). State/event check-ins with tags and notes.

**Under the Understanding Engine:**

| Addition | What It Shows | Data Source |
|----------|--------------|-------------|
| Fieldwork Capture | "Watch for: [signal]" — integrated into check-in flow | FieldworkAssignment (status=active) |
| State Switch Prompts | "You seem [state] — what changed?" — after state transitions | QuickCheckIn history |
| Emotional Processing Context | Current state feeds into Explore mode selection | QuickCheckIn → Explore mode routing |

### Mobile

**Principle:** Mobile remains backend-driven. All new Understanding Engine endpoints serve both web and mobile from the same backend.

| Mobile Screen | New Data Available | Implementation |
|--------------|-------------------|----------------|
| Timeline | Model Update events, Investigation events, Fieldwork events | New API endpoint fields, no mobile-side computation |
| Pattern Detail | Links to Investigations, User Map conclusions | New API response fields |
| Tension Detail | Links to Investigations, User Map conclusions | New API response fields |
| New: User Map (mobile) | Conclusions list, confidence indicators | New API endpoint, thin client display |
| New: Investigations (mobile) | Active investigations, detail | New API endpoint, thin client display |

---

## 10. Full Update Build Order

### Foundation Layer

**What gets built:** New database models (UserMapConclusion, Investigation, ModelUpdate, FieldworkAssignment, MetaObserverFinding), basic CRUD APIs, evidence routing from existing models.

**Why it comes first:** Without storage, nothing else works. The Understanding Engine needs somewhere to write its outputs.

**What depends on it:** Everything else.

**What should not be built before it:** Any UI surface, any agent deliberation, any advanced intelligence.

### Connection Layer

**What gets built:** Understanding Engine synthesis pass (evidence packet builder → interpretation → objectivity gates → routing → persistence → summary). Integration with existing derivation pipeline (PatternClaim lifecycle triggers User Map updates). Integration with existing contradiction system (ContradictionNode status changes trigger Investigation updates). Integration with existing action system (SurfacedAction outcomes trigger Model Updates).

**Why it comes second:** The connections between systems are what make the Understanding Engine valuable. Without them, the new models are just empty tables.

**What depends on it:** Surface layer, advanced intelligence layer.

**What should not be built before it:** Any user-facing Understanding Engine features. The engine must work before it can be displayed.

### Surface Layer

**What gets built:** User Map surface, Investigations surface, Model Update cards on Today, Fieldwork prompts on Check-ins, Explore mode expansion (Release/Understand/Move), Actions/Experiments evolution, Timeline integration.

**Why it comes third:** Surfaces display intelligence. They should not be built until the intelligence exists to display.

**What depends on it:** Mobile parity layer.

**What should not be built before it:** Complex visualizations, notifications, advanced UI interactions.

### Advanced Intelligence Layer

**What gets built:** Generative Self-Model (causal chains), Meta-Observer (live data analysis + user correction analysis + coverage analysis), Model Maturity Signals, Deliberative Agent Brain (multi-pass deliberation).

**Why it comes fourth:** These features require stable foundation and connection layers to build upon. They also require real user data to calibrate.

**What depends on it:** Nothing in the foundation/connection/surface layers.

**What should not be built before it:** Nothing — this is the final intelligence layer.

### Mobile Parity Layer

**What gets built:** Mobile User Map screen, mobile Investigations screen, mobile Model Update display, mobile Fieldwork prompts, mobile Explore mode support.

**Why it comes last:** Mobile is a thin client. New backend endpoints must be stable before mobile can consume them. Mobile should not reimplement any intelligence logic.

**What depends on it:** Surface layer (backend endpoints must exist first).

**What should not be built before it:** Mobile-specific intelligence logic. Mobile must never reimplement backend reasoning.

---

## 11. What Should Be Built First

### First Implementation Slice (Foundation + Connection)

1. **UserMapConclusion model + CRUD API**
   - Prisma model with fields defined in Section 5
   - Basic CRUD endpoints (`GET /api/user-map`, `POST /api/user-map/synthesize`)
   - Evidence routing from PatternClaim, ContradictionNode, ProfileArtifact

2. **Investigation model + CRUD API**
   - Prisma model with fields defined in Section 5
   - Basic CRUD endpoints (`GET /api/investigations`, `POST /api/investigations`, `PATCH /api/investigations/[id]`)
   - Seed from ContradictionNode (auto-create investigation when tension is detected)

3. **ModelUpdate event layer**
   - Prisma model with fields defined in Section 5
   - Event emission from: UserMapConclusion changes, Investigation status changes, Action outcome recordings, User corrections
   - No user-facing display yet — just persistence

4. **FieldworkAssignment model + CRUD API**
   - Prisma model with fields defined in Section 5
   - Basic CRUD endpoints (`GET /api/fieldwork`, `POST /api/fieldwork`, `PATCH /api/fieldwork/[id]`)
   - Seed from Investigation (auto-create fieldwork when evidence is needed)

5. **Action/Experiment feedback extension**
   - Extend SurfacedAction with: type (action|experiment), hypothesis, linkedInvestigationId, linkedFieldworkAssignmentId, feedbackLoop
   - Outcome recording triggers ModelUpdate creation

6. **Evidence routing from existing data**
   - Build the evidence packet builder that collects from PatternClaim, ContradictionNode, ProfileArtifact, Timeline, Action outcomes
   - This is the input layer for all Understanding Engine synthesis

7. **Conservative User Map synthesis (v1)**
   - One structured LLM call per derivation run
   - Input: evidence packet
   - Output: UserMapConclusion candidates
   - Objectivity gates applied
   - Persisted to UserMapConclusion table

### What This Enables

After the first slice:
- User Map exists with real data (synthesized from existing patterns/tensions/evidence)
- Investigations exist (seeded from contradictions)
- Model Updates are recorded (but not yet displayed)
- Fieldwork can be assigned (but not yet prompted)
- Actions have feedback loops (outcomes update the model)

The system is now ready for the Surface Layer (Section 10, third layer).

---

## 12. What Should Wait Until Foundations Exist

### Build Later in the Update Sequence

1. **Full multi-agent autonomous system** — Wait until the single-pass deliberation (Section 7) is stable and we understand its limitations. Multi-agent adds complexity that may not be needed.

2. **Advanced graph visualization** — Wait until User Map has enough conclusions to visualize. A graph of 3 nodes is not useful. A graph of 30 nodes is.

3. **Full model maturity level system** — Wait until we have enough data to define meaningful, evidence-backed levels. Premature levels will be wrong and hard to change.

4. **Full Meta-Observer UI** — Wait until Meta-Observer findings are reliable enough to show to users (or decide they should remain internal). Premature UI creates expectations.

5. **Automatic deep causal modeling everywhere** — Wait until the conservative GenerativeSelfModelEntry (Section 5) proves useful. Deep causal modeling is expensive and may not add value.

6. **Full mobile redesign** — Wait until backend models and APIs are stable. Mobile redesign before backend stability creates rework.

7. **User-facing academic concept graph** — Wait until we understand what users actually find useful. Academic concepts (causal chains, evidence landscapes) may not resonate.

8. **Complex notification system** — Wait until Model Updates prove valuable enough to notify about. Premature notifications create noise.

---

## 13. UI / Product Surface Map Requirements

### What Step 2.5 Must Design Before Implementation

#### Navigation Changes

- Where does the User Map live? New route (`/user-map`)? Section within Today? Tab in the global navigation?
- Where do Investigations live? New route (`/investigations`)? Mode within Contradictions? Section within User Map?
- How does the user navigate between: Today → User Map → Investigations → Explore → Actions?
- How does the global navigation change? New items? Reorganized sections?

#### User Map Surface Structure

- List view vs. detail view vs. both?
- How are conclusions grouped? By category? By confidence? By recency?
- How is confidence displayed? Visual indicator? Text label? Both?
- How does the user see evidence provenance? Inline links? Expandable sections? Modal?
- How does the user correct a conclusion? Inline feedback? Dedicated form?
- How does the user see model update history for a conclusion? Timeline view? List?

#### Investigation List/Detail

- List view: cards? Table? How sorted? What metadata shown?
- Detail view: sections for organizing question, competing theories, evidence, fieldwork, actions?
- How does the user add evidence to an investigation?
- How does the user resolve an investigation? What does resolution look like?
- How does resolution connect to User Map?

#### Model Update Cards

- Where do they appear? Today feed? Timeline? Both?
- Card design: what information? Update type, affected object, before/after, evidence basis?
- How many shown? Most recent N? All from today?
- What happens when clicked? Navigate to affected object?

#### Fieldwork Prompts

- Where do they appear? Today? Check-ins? Both?
- How does the user complete a fieldwork assignment? Inline? In check-in flow? In Explore?
- What does completion look like? Observation capture? Evidence return?

#### Explore Mode Switch: Release / Understand / Move

- How does the user switch modes? Dropdown? Tabs? Buttons?
- What visual feedback indicates which mode is active?
- What happens to the conversation when switching modes? Context preserved? Reset?
- Release mode: what safety indicators are shown? Disclaimers?
- Understand mode: what investigation context is shown? Sidebar? Inline?
- Move mode: what action/experiment templates are shown?

#### Actions vs Experiments Language

- How does the UI distinguish actions from experiments?
- What language is used? "Try this" vs "Test this hypothesis"?
- How are experiment results displayed? Outcome + model update context?
- How are tested moves displayed? Conditions where they work/fail?

#### Today Changes

- What sections are added? Model Updates? Active Investigations? Fieldwork Prompts?
- What is the layout? Cards? Feed? Dashboard widgets?
- How does "what changed" get summarized? Single sentence? Bullet list?

#### Timeline Changes

- How are Model Update events displayed? Inline? Badge? Card?
- How are Investigation events displayed?
- How are Fieldwork completions displayed?
- How does the user filter timeline events? By type? By date range?

#### Library/Receipt Changes

- How are User Map receipts displayed? Grouped by conclusion?
- How are Investigation receipts displayed?
- How does the user browse evidence by source type? By date? By conclusion?

#### Mobile Parity Plan

- Which new surfaces get mobile versions first? User Map? Investigations?
- What is the mobile navigation structure? Tab bar? Drawer?
- How does mobile handle Explore mode switching? Same as web? Simplified?
- What mobile-specific constraints apply? Screen size? Offline? Push notifications?

---

## 14. Execution Planning Inputs

### Required Schema Decisions (Before Step 3)

1. **UserMapConclusion** — exact field list, JSON field schemas, indexing strategy, versioning approach (soft delete + supersededById vs. hard delete)
2. **Investigation** — exact field list, competing theories JSON schema, status enum values, resolution flow
3. **ModelUpdate** — exact field list, updateType enum values, affectedObjectType enum, internalOnly flag usage
4. **FieldworkAssignment** — exact field list, status enum, linking strategy (direct FK vs. polymorphic)
5. **Action/Experiment extension** — extend SurfacedAction vs. new model? If extend, which fields are additive?
6. **MetaObserverFinding** — exact field list, findingType enum, severity enum, internalOnly default

### Required APIs (Before Step 3)

1. `GET /api/user-map` — list conclusions, filter by category/status/confidence
2. `GET /api/user-map/[id]` — conclusion detail with evidence provenance
3. `POST /api/user-map/synthesize` — trigger synthesis pass
4. `PATCH /api/user-map/[id]/correct` — user correction endpoint
5. `GET /api/investigations` — list investigations, filter by status/source
6. `GET /api/investigations/[id]` — investigation detail with related objects
7. `POST /api/investigations` — create investigation (manual or from seed)
8. `PATCH /api/investigations/[id]` — update investigation status, add evidence
9. `GET /api/model-updates` — list model updates, filter by type/affected object
10. `GET /api/fieldwork` — list fieldwork assignments, filter by status
11. `POST /api/fieldwork` — create fieldwork assignment
12. `PATCH /api/fieldwork/[id]` — complete fieldwork, record observation
13. `PATCH /api/actions/[id]/outcome` — record action outcome with feedback loop
14. `GET /api/meta-observer/findings` — list Meta-Observer findings (internal)

### Required UI Decisions (Before Step 3)

1. Navigation structure — where do User Map, Investigations, Model Updates live?
2. User Map surface — list/detail layout, confidence display, evidence provenance display
3. Investigation surface — list/detail layout, competing theories display
4. Model Update display — card design, placement (Today/Timeline/both)
5. Fieldwork prompt display — placement (Today/Check-ins/both), completion flow
6. Explore mode switch — UI pattern for Release/Understand/Move
7. Actions/Experiments language — UI terminology and distinction
8. Mobile parity — which surfaces get mobile versions first

### Migration Risks

| Risk | Mitigation |
|------|-----------|
| New models have no data | Seed from existing data (PatternClaim → UserMapConclusion, ContradictionNode → Investigation). Don't require users to start from zero. |
| Existing APIs change shape | All new Understanding Engine endpoints are additive. Existing APIs remain unchanged. No breaking changes. |
| Performance impact of synthesis | Synthesis runs on derivation trigger (same cadence as current pattern detection). Not on every page load. |
| User confusion from new surfaces | Progressive disclosure. User Map appears when there are conclusions to show. Investigations appear when there are seeds. |
| Mobile API client needs updates | Mobile consumes new endpoints via the same API client pattern. No mobile-side intelligence logic needed. |

### Test Strategy

| Layer | What to Test | How |
|-------|-------------|-----|
| **Objectivity gates** | Each gate correctly accepts/rejects based on evidence | Unit tests with synthetic evidence packets |
| **Evidence routing** | Evidence from PatternClaim/Contradiction/etc. correctly feeds User Map synthesis | Integration tests with real data shapes |
| **Synthesis pass** | LLM call produces valid structured output | Integration tests with mock LLM + real evidence packets |
| **Model Update generation** | Correct ModelUpdate records created for each change type | Integration tests |
| **API endpoints** | CRUD operations work correctly | API integration tests |
| **User-facing language** | No clinical/diagnostic terms in output | Automated regex tests on all user-facing output |
| **Regression** | Existing pattern detection, contradiction detection, action generation still work | Existing eval pipeline |

### Validation Criteria

| Criterion | How to Measure | Target |
|-----------|---------------|--------|
| User Map conclusions are evidence-backed | % of conclusions with ≥2 evidence sources | 100% |
| User Map conclusions are accurate | User correction rate (accurate / total) | ≥80% |
| Investigations are actionable | % of investigations that reach resolution | ≥50% within 30 days |
| Model Updates are meaningful | User engagement with update display | TBD from usage data |
| Fieldwork assignments are completed | % of assignments completed | ≥40% |
| Objectivity gates are effective | % of rejected claims that would have been incorrect | ≥90% |
| No clinical/diagnostic language | Automated scan of all user-facing output | 0 violations |

### Safe Rollout Order

1. **Backend models + APIs** — no user-facing changes. Data accumulates silently.
2. **Internal synthesis** — Understanding Engine runs but outputs are only logged, not displayed.
3. **User Map surface (beta)** — visible to a subset of users. Feedback collected.
4. **Investigations surface (beta)** — visible to a subset of users. Feedback collected.
5. **Model Updates on Today** — visible to all users. Monitored for engagement.
6. **Fieldwork prompts** — visible to all users. Monitored for completion rate.
7. **Explore mode expansion** — Release/Understand/Move modes. Monitored for safety.
8. **Actions/Experiments evolution** — experiment type + feedback loop. Monitored for outcome quality.
9. **Meta-Observer (internal)** — shadow mode findings reviewed by development team.
10. **Mobile parity** — new surfaces on mobile. Monitored for performance.

### What Implementation Prompts Will Need

Each implementation prompt in Step 3 will need:

1. **Schema definition** — exact Prisma model fields, enums, relations, indexes
2. **API route definition** — exact route path, methods, input validation, output shape
3. **Library module definition** — exact function signatures, input/output types, error handling
4. **Test cases** — unit tests for gates, integration tests for routes, regression tests for existing systems
5. **Migration plan** — no-data-loss migration, rollback strategy
6. **UI component spec** — if surface layer: component hierarchy, data flow, loading/empty/error states
7. **Safety checklist** — which objectivity gates apply, what language guards are needed
8. **Rollout check** — is this safe to deploy independently? What depends on it?

