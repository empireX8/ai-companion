# MindLab Understanding Engine — Step 3.6 Pre-Implementation Consolidation

**Date:** 2026-05-14  
**Inputs:**
- `docs/step2a-infrastructure-audit.md`
- `docs/step2b-architecture-application-map.md`
- `docs/step2c-product-surface-ui-map.md`
- `docs/step3-execution-map.md`
- Step 3.5 Full Planning Chain Review findings

## 1. Purpose

This document resolves remaining planning-chain ambiguity before implementation begins.

It is the consolidation contract for Phase 0 Contract Lock and Phase 1 schema/API prompts. Where Step 2B, Step 2C, and Step 3 differ in wording or detail, this document is the final source of truth for implementation kickoff.

This remains an additive MindLab intelligence update:

- Patterns stay
- Tensions/Contradictions stay
- Actions stay
- Timeline stays
- Receipts/Library stay
- Journal/Explore/Check-ins stay
- Mobile/web parity remains required

The Understanding Engine sits above and between existing systems. It does not replace them.

## 2. Final Source-of-Truth Decisions

The following decisions override ambiguity across prior planning docs.

1. **Explore mode naming (user-facing):** Use `Vent`, `Make sense`, `Decide`.
2. **Internal vs user-facing naming contract:** Internal object names remain technical; UI copy must use Step 2C language contract.
3. **Evidence-input inclusion list:** `ProfileArtifact` and `ReferenceItem` are included in Phase 2 evidence packet v1 with low-weight, bounded roles. They are not dropped.
4. **Advanced intelligence timing:** `GenerativeSelfModelEntry`, `ModelMaturitySignal`, and `MetaObserverFinding` are Phase 7 advanced objects. Early placeholder scaffolding is allowed only if behavior remains disabled.
5. **Fieldwork vs action distinction:** Fieldwork is observation (`Watch For`), not action execution (`Try This`/`Test This`).
6. **ModelUpdate meaning/gating:** User-facing “What Changed” requires meaningful model movement plus evidence links; no synthetic or decorative updates.
7. **Mobile rule:** All intelligence on mobile must be backend-derived. No local synthetic intelligence logic.

## 3. Explore Mode Normalization

### Final user-facing modes

- `Vent`
- `Make sense`
- `Decide`

`Release / Understand / Move` is superseded as user-facing language.

### Internal architecture mapping

- `Vent` = emotional unloading and stabilization posture
- `Make sense` = collaborative interpretation and investigation support
- `Decide` = next move planning (action/experiment/fieldwork support)

### Persistence contract by mode

| Mode | May Persist | May Not Persist |
|---|---|---|
| Vent | Minimal/private session evidence only, with safety logging as needed | Stable conclusions from the episode alone, direct identity claims, automatic model promotions |
| Make sense | Candidate investigation notes and candidate evidence links | Immediate ungated conclusions; single-episode certainty claims |
| Decide | Action/experiment plans, fieldwork plans, outcome placeholders | Immediate hard model claims without evidence/objectivity gating |

### Mode safety rules

- Vent content alone cannot create stable UserMapConclusion records.
- Make sense candidates require objectivity gates before promotion.
- Decide outputs can seed actions/fieldwork, but model conclusions still require evidence packet + gates.

## 4. Evidence Input Inclusion Contract

Phase 2 evidence packet v1 inclusion contract:

| Input source | Included in Phase 2 evidence packet v1? | Role | Limits / guardrails |
|---|---|---|---|
| PatternClaim | Yes | Primary behavioral signal stream | Never treated as full User Map by itself |
| PatternClaimEvidence | Yes | Quote-level support and provenance | Quote safety and provenance checks required |
| ContradictionNode | Yes | Primary tension and investigation seed signal | Do not auto-convert tension into conclusion without corroboration |
| ContradictionEvidence | Yes | Evidence for/against competing theories | Must remain linked to contradiction context |
| ProfileArtifact | Yes | Low-level extracted signal input | Never displayed as User Map itself; low-to-moderate weight only |
| EvidenceSpan | Yes | Fine-grain provenance anchor for receipts | Provenance-only role by default; not a synthesis object |
| ReferenceItem | Yes | Goals/preferences/constraints/value context | Context signal only; never treated as Investigation or User Map conclusion by itself |
| SurfacedAction | Yes | Action outcome feedback stream | Existing action semantics in Phase 3; experiment semantics start in Phase 4 |
| QuickCheckIn | Yes | State snapshots and switch signals | Single check-in cannot create supported conclusion alone |
| JournalEntry | Yes | Long-form reflection evidence | Requires corroboration for stable conclusions |
| Session | Yes | Conversation container, sequence and context | Container signal, not claim source by itself |
| Message | Yes | Atomic textual evidence units | Single-message limitations apply |
| Timeline aggregation | Yes | Temporal coherence, spread, and sequence context | Timeline is context, not causal proof by itself |
| Import pipeline outputs | Yes | Longitudinal historical context | Imported evidence quality/relevance gates apply |
| User corrections | Yes | High-priority calibration and dispute signal | Corrections reduce/cap confidence until re-corroborated |

## 5. Evidence Linking Strategy Recommendation

### Options considered

- Generic polymorphic link table
- Explicit join tables
- Hybrid approach

### Recommendation

Use a **hybrid approach** for Phase 1A/1B:

- one generic `UnderstandingEvidenceLink`-style table for flexible v1 cross-object linking
- strict typed enums for source/target/link role
- strict validation helpers and tests to prevent invalid links
- targeted explicit join tables only later, if high-volume paths require optimization

### Required v1 fields

- `id`
- `userId`
- `targetType`
- `targetId`
- `sourceType`
- `sourceId`
- `role` (supports, contradicts, context, correction, outcome, etc.)
- `summary` (optional short rationale)
- `snippet` or `quote` metadata (optional)
- `weight` (optional)
- `confidenceContribution` (optional)
- `createdAt`

### Required indexes

- `(userId, targetType, targetId)`
- `(userId, sourceType, sourceId)`
- `(userId, targetType, role)`
- `(userId, createdAt)`
- unique constraint for dedupe on `(userId, targetType, targetId, sourceType, sourceId, role)`

### Risks and mitigation

| Risk | Mitigation |
|---|---|
| Garbage polymorphic links | typed enums + validation helpers + integration tests |
| Link explosion and query slowdown | early indexing + pagination + selective reads |
| Ambiguous semantics | constrained `role` enum and lint/test checks |
| Future inflexibility | hybrid path keeps room for later explicit joins |

## 6. Numeric / Concrete Objectivity Threshold Draft

These are **initial conservative implementation thresholds** for Phase 2 dark-run. They are not final scientific truths and must be tuned after dark-run evaluation.

### UserMapConclusion thresholds

- Minimum evidence count to persist as `emerging`: `>=2`
- Minimum source diversity for `emerging`: `>=2 source types`
- Minimum time spread for `emerging`: none required, but confidence cap applies
- Minimum evidence count for `supported`: `>=4`
- Minimum source diversity for `supported`: `>=2 source types`
- Minimum time spread for `supported`: `>=7 days`

### Confidence and status caps

- 2 evidence items: confidence cap `<=0.30`
- 3–5 evidence items: confidence cap `<=0.50`
- 6–10 evidence items: confidence cap `<=0.70`
- 10+ evidence items: confidence cap `<=0.85`

### ModelUpdate meaningfulness threshold

A candidate update is meaningful if one of these is true:

- status transition (`hypothesis` -> `tentative` -> `emerging` -> `supported`, `supported` -> `disputed`, etc.)
- confidence delta magnitude `>=0.08`
- net-new evidence-backed link established between previously unlinked objects
- investigation state movement (`gathering evidence` -> `testing`, `testing` -> `resolving`, `resolving` -> `resolved`)
- action/fieldwork outcome creates a model-affecting delta (not just activity logging)

### Fieldwork assignment thresholds

Assign Fieldwork when any of these are true:

- investigation has explicit evidence-needed gap
- conclusion remains `emerging` for `>=14 days` with low source diversity
- contradiction remains active with unresolved disambiguation signals
- repeated action outcome uncertainty (`unclear`) indicates missing observational signal

### Investigation resolution thresholds

Resolve only when all are true:

- total evidence count `>=3`
- source diversity `>=2 source types`
- at least `2 competing theories` were evaluated
- at least `1 fieldwork completion` or `1 experiment outcome` is linked
- no blocking active contradiction at higher escalation for the same question

### High-emotion guard rule

- If dominant new evidence comes from high-emotion context (Vent-mode episode or acute state cluster), cap conclusion at `emerging` and block identity-level language until corroborated by non-acute evidence.

### Single-episode limitation rule

- No single session/check-in/journal episode can independently produce `supported` status or a user-facing identity-level ModelUpdate.

## 7. ModelUpdate / What Changed Gating Contract

A ModelUpdate is user-facing only if all of the following are true:

- meaningful delta exists
- linked evidence exists and is inspectable
- affected object is real and persisted
- change is not metadata churn
- language/objectivity gates pass
- update is not synthetic “insight-of-the-day” behavior

### Acceptable user-facing update types

- conclusion strengthened
- conclusion weakened
- conclusion disputed/revised
- investigation progressed
- investigation resolved
- strategy adjusted from repeated action outcomes
- fieldwork clarified state switch or mechanism

### Hidden/internal-only update cases

- derivation run started/completed without meaningful user-facing delta
- timestamp/order/index churn
- backend maintenance changes
- low-evidence speculative suggestions below gating threshold
- intermediate candidate merges during dark-run

### Anti-random-feed contract

- “What Changed” cards may be absent when no meaningful movement exists.
- Empty state is preferred over fabricated novelty.
- No synthetic daily insight card.

## 8. Fieldwork / Watch For Contract

Fieldwork must remain observation, not action.

### Hard constraints

- One active prompt at a time by default (exceptions require explicit prioritization rule)
- Prompt should be completable quickly (target under 20 seconds for quick capture path)
- Prompt must link to a specific investigation, User Map area, pattern, tension, or explicit uncertainty
- Prompt must carry a clear reason statement
- Prompt must not degrade into generic journaling homework

### Acceptance criteria for implementation prompts

- Fieldwork prompt includes `why this matters` text
- Completion path exists in Check-ins and can deep-link from Today/Investigation
- Completion writes observation linked to originating thread/object
- Fieldwork completion can affect investigation state only through gates
- UX copy uses `Watch For` language, not assignment/homework language

## 9. Copy / Naming Contract

Internal names are allowed in code/schema/docs, but user-facing UI copy must use the mapped names below.

| Internal | User-facing |
|---|---|
| UserMapConclusion | Your Map conclusion / Current Understanding item |
| User Map | Your Map |
| Master Theory | Current Understanding |
| Investigation | Active Question |
| ModelUpdate | What Changed |
| FieldworkAssignment | Watch For |
| Action / Experiment | Try This / Test This |
| Tested Move | What Worked |
| MetaObserverFinding | Confidence Check (internal only unless explicitly surfaced) |

Do not leak raw backend object names into UI copy.

## 10. Canonical Theory Traceability Matrix

Canonical stages mapped to current surfaces and phase support:

| Stage | Existing surfaces/systems | Understanding Engine additions | Supported by Phases 1/2/3 | Supported by later phases |
|---|---|---|---|---|
| Capture | Journal, Explore, Check-ins, Sessions/Messages, Imports | Evidence packet assembly across all streams | Phase 1 object storage + Phase 2 evidence packet + Phase 3 UI hooks | Phase 4 mode refinement, Phase 6 mobile parity |
| Reveal | Patterns, Tensions, Timeline, Receipts/Library | Cross-object links, initial User Map and Investigation visibility | Phase 2 dark synthesis + Phase 3 User Map/Investigations/Timeline layers | Phase 5 deeper receipts continuity |
| Understand | Patterns + contradictions + user context | UserMapConclusion synthesis, Investigation theory testing, ModelUpdate deltas | Phase 2 synthesis/gates + Phase 3 surface beta | Phase 7 advanced intelligence layers |
| Generate | Existing Actions (SurfacedAction) | Action/Experiment evolution, fieldwork planning, context-specific moves | Phase 3 uses existing actions in Today only | Phase 4 full Actions/Experiments and Explore-mode behavior |
| Preserve | Timeline, Library, receipts, derivation history | ModelUpdate history, correction loops, cross-surface provenance | Phase 1 persistence + Phase 3 update views | Phase 5 receipt deep-link continuity + Phase 6 mobile parity |

### Theory guardrails

- Understanding first, improvement second: enforced by dark-run and objectivity gates before broad UI rollout.
- User Map is synthesis, not dashboard inventory.
- Timeline remains epistemic infrastructure, not activity spam.
- Receipts remain trust/proof layer for all user-facing claims.

## 11. Phase 0 Contract Lock Inputs

Phase 0 should lock the following items after this consolidation:

1. **Schema contracts** for `UserMapConclusion`, `Investigation`, `ModelUpdate`, `FieldworkAssignment`, and action extension fields.
2. **Enum values and lifecycle transitions** for conclusions, investigations, updates, fieldwork, and action/experiment states.
3. **Evidence link contract** (hybrid approach, fields, indexes, validation requirements).
4. **API contracts** for new endpoints and additive response fields on existing endpoints.
5. **Objectivity thresholds** from Section 6 as initial dark-run values.
6. **Copy contract** from Section 9 (internal vs user-facing names).
7. **Mobile backend-derived contract** (no local intelligence synthesis).
8. **Phase boundaries**:
- Phase 3 Today uses existing action pipeline only.
- Phase 4 introduces full Actions/Experiments semantics.
- Phase 7 contains advanced intelligence behavior.

## 12. Phase 1A Readiness Verdict

### Readiness

**Yes, Phase 1A schema implementation is ready after this consolidation**, with one condition: Phase 0 must explicitly ratify the contracts above in a single lock artifact before coding begins.

### Remaining user/product decisions still needed

- Final UI copy tone examples for each mode/surface (contract exists, copy set still needs final writing pass).
- Whether any mobile surface gets intentionally reduced detail in first mobile drop for performance reasons.
- Exact escalation behavior when correction frequency is high for one area.

### First implementation prompt title

**Step 4 Prompt 1 — Understanding Engine Foundation Schema and Enum Contract (Phase 1A)**

### What Prompt 1 must explicitly forbid

- No UI route creation
- No surface redesign
- No engine synthesis logic
- No heuristic model-update feed generation
- No mobile-side intelligence logic
- No removal/rename of legacy models or surfaces
- No non-additive API breaking changes

