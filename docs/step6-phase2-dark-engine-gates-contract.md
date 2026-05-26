# MindLab Step 6 - Phase 2 Dark Engine + Gates Contract Lock

**Status:** CONTRACT LOCK (DOCS-ONLY) / READY FOR CLOSEOUT AUDIT
**Date:** 2026-05-26
**Scope:** Contract definition only. No production code, tests, schema, routes, synthesis runtime, or model-mutation writes.

## 1. Purpose

Phase 2 defines the Dark Engine + Gates contract for future implementation.

This contract locks:
- what the dark engine may read
- what evidence packets must contain
- what candidate outputs may be proposed
- what gates must pass before anything becomes durable or user-visible
- how random insight generation is blocked
- how fake model progress is blocked
- how candidate outputs remain separate from accepted model state

Phase 2 is not:
- UI work
- mobile work
- agents/lenses architecture
- Intelligence Library/domain retrieval
- default production live ranking activation
- automatic user-visible self-knowledge generation

## 2. Split Boundary With Policy Phase H

Phase relationship is **SPLIT BOUNDARY**:
- Policy Phase H remains the narrow policy appendix for action/fieldwork-feedback-derived `ModelUpdate` candidates.
- Phase 2 absorbs generic candidate mechanics:
  - candidate-vs-belief distinction
  - evidence thresholding
  - recency/conflict/meaningful-delta gating
  - lifecycle discipline
  - provenance retention
  - reversibility
  - cautious language rules
- Phase 2 must not generalize Phase H action-specific semantics beyond their domain:
  - `helped` / `didnt_help` semantics
  - action-format preference rejection rules
  - `surfaced_action`-linked fieldwork specifics
  - live action-ranking policy assumptions
  - unresolved Explore-reflection linkage rules

## 3. Evidence Packet Assembly

The Evidence Packet is the unit the dark engine reasons over.

Allowed source families:
- `JournalEntry`
- journal chat messages
- Explore chat messages
- `QuickCheckIn`
- `PatternClaim` and `PatternClaimEvidence`
- `ContradictionNode` / tension evidence
- `SurfacedAction` metadata
- `FieldworkAssignment` metadata and completed structured observations
- `ModelUpdate` history (once it exists)
- `UserMapConclusion` history (once populated)

Prohibited source use:
- no raw unsupported inference as proof
- no domain knowledge as proof of user-specific claims
- no isolated single-episode overreach
- no action outcome alone as user truth
- no thin feedback as durable model evidence

Each packet item must include:
- source kind
- source id
- timestamp
- surface/origin
- evidence role
- evidence strength
- recency signal
- repetition/spread signal
- contradiction/conflict markers
- whether raw text is available internally
- whether public-safe projection exists

## 4. Candidate Output Types

Phase 2 may propose candidate objects only:
- `UserMapConclusion` candidate
- `Investigation` candidate
- `ModelUpdate` candidate
- `FieldworkAssignment` candidate
- `UnderstandingEvidenceLink` candidate

Candidate contract by type:

| Candidate type | Purpose | Minimum evidence requirement | Reject when | Hold for more evidence when | Allowed user-safe language | Must remain internal-only |
|---|---|---|---|---|---|---|
| `UserMapConclusion` candidate | Propose understanding movement | repeated, cross-context, non-conflicted evidence | single-episode, stale/conflicted, unsafe overclaim | evidence trend exists but spread/recency is weak | "This may suggest..." | confidence internals, gate diagnostics |
| `Investigation` candidate | Capture uncertainty worth structured inquiry | plausible uncertainty signal with unresolved conflict/gap | duplicate noise, no real uncertainty | promising but under-specified theories | "This looks worth watching..." | unresolved theory scoring, internal gate reasons |
| `ModelUpdate` candidate | Propose model movement delta | meaningful delta + corroborated evidence + provenance | no-op restatement, thin feedback, unsafe language | early movement signal without robust corroboration | "There is early evidence..." | internal delta scores, promotion diagnostics |
| `FieldworkAssignment` candidate | Request concrete observation to reduce uncertainty | clear evidence gap and observable next question | vague/non-actionable prompt, no uncertainty target | specific question exists but prompt needs sharpening | "This may help clarify..." | assignment rationale internals, confidence internals |
| `UnderstandingEvidenceLink` candidate | Preserve provenance between source and target | clear source/target ownership + role clarity | ambiguous ownership, unclear role, unsafe source | ownership is likely but unresolved | "Linked evidence may support this..." | raw private text, non-public-safe evidence |

All objects above are candidates, not automatically accepted durable state.

## 5. Gates

### Evidence Sufficiency Gate
Requires minimum evidence quantity, quality, and spread before promotion.

### Distinct Context Gate
Prevents one conversation/session/day from being treated as durable pattern evidence.

### Recency Gate
Distinguishes active movement from stale evidence.

### Conflict Gate
Detects contradictory evidence and lowers confidence, holds, or rejects.

### Meaningful Delta Gate
Blocks no-op restatements of already-known model state.

### Single-Episode Limitation Gate
Blocks durable stable self-claims from one intense event.

### High-Emotion Guard
High-emotion content may seed `Investigation` or `FieldworkAssignment`, not automatic durable conclusion.

### Objectivity / Overclaim Guard
Blocks language more certain than evidence allows.

### Source-Safety Gate
Blocks raw notes/raw evidence/private text/unsafe snippets from public projections.

### Phase H Compatibility Gate
If candidate derivation depends on action/fieldwork feedback, Phase H contract constraints must pass.

## 6. Candidate Lifecycle

Conceptual states (contract-only, no schema/enums in this pass):
- `proposed`
- `held_for_more_evidence`
- `rejected`
- `promoted`
- `superseded`
- `expired`

Lifecycle rules:
- candidates are reversible
- rejected candidates should preserve internal diagnostic reason later
- promoted candidates must preserve provenance
- supersession must not erase interpretation history

## 7. User Visibility Rules

Visibility policy:
- dark-engine output is internal by default
- user-visible output requires gate passage
- low-confidence output should become `Investigation` or `FieldworkAssignment`, not a durable conclusion
- candidate outputs must not be framed as "the model learned"
- avoid "you are" identity framing unless evidence is unusually strong and user-safe
- public/mobile projections must use safe summaries and IDs, never raw private evidence

Allowed language examples:
- "This may suggest..."
- "There is early evidence..."
- "This looks worth watching..."
- "This may be a candidate pattern, but it needs more evidence..."

Disallowed language examples:
- "The model learned..."
- "This proves..."
- "You are now..."
- "This pattern changed..." without sufficient model evidence
- "The system knows..." when object state is only candidate-level

## 8. Object Creation Rules

### `UserMapConclusion`
May be proposed when evidence is repeated, cross-context, and not better represented as an open question.

### `Investigation`
Preferred when evidence is interesting but uncertain, emotionally intense, conflicted, or under-specified.

### `ModelUpdate`
May be proposed only when there is meaningful delta from prior model state and enough evidence for model movement.

### `FieldworkAssignment`
May be proposed when the system needs additional observation and user-testable/watchable next steps.

### `UnderstandingEvidenceLink`
May be created later only when source/target ownership, provenance, and role are clear.

## 9. Rejection Reasons

Conceptual rejection reasons (contract vocabulary only):
- `insufficient_evidence`
- `single_episode`
- `stale_evidence`
- `conflicted_evidence`
- `no_meaningful_delta`
- `unsafe_overclaim`
- `source_not_public_safe`
- `action_feedback_too_thin`
- `better_as_investigation`
- `better_as_fieldwork`
- `duplicate_or_subsumed`
- `phase7_scope_creep`

No code enums are introduced in this pass.

## 10. Explicit Non-Goals

This contract does not:
- implement the dark engine runtime
- create schema
- add routes
- write candidates
- create `ModelUpdate` rows
- create `UserMapConclusion` rows
- create `Investigation` rows
- create `FieldworkAssignment` rows
- mutate `PatternClaim` rows
- expose raw evidence
- change mobile
- change UI
- activate default live ranking
- implement agents/lenses
- implement Intelligence Library/domain retrieval
- implement therapy/diagnosis behavior

## 11. Open Questions / Deferred Decisions

Intentionally unresolved in this pass:
- exact evidence thresholds per candidate type
- exact scoring/weighting model
- candidate storage schema
- review/approval workflow
- whether candidates need separate tables or can reuse existing objects/statuses
- how Explore reflection linkage becomes canonical
- how dark-run diagnostics are evaluated
- how much of Phase H becomes enforceable code versus referenced policy
- how Phase 2 outputs later appear in mobile/web safely

## 12. Recommended Next Step After Contract

Recommended sequence:
- run closeout audit for this contract
- do not start implementation until contract review passes
- after closeout, choose one next track:
  1. dark-engine packet assembly design audit
  2. candidate storage/schema audit
  3. dark-run evaluation harness design
  4. Phase 2 ledger closeout (if contract-only phase is considered sufficient)
