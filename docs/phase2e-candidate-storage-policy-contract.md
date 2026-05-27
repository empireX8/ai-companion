# MindLab Phase 2E - Candidate Storage Policy Contract

**Status:** CONTRACT CREATED / READY FOR CLOSEOUT AUDIT  
**Date:** 2026-05-27  
**Scope:** Docs-only storage/lifecycle policy bridge. No code, tests, schema, route, or runtime behavior changes.

## 1. Purpose

This contract defines the Phase 2E storage/lifecycle policy bridge between:
- the current no-write dark-run chain (`evidence packet -> no-write orchestrator -> evaluation harness -> internal no-write route`)
- any future durable candidate write path
- the later schema migration decision

Contract boundary:
- Candidate storage is not active for generalized Phase 2 dark-engine outputs.
- This contract does not authorize durable writes.
- Schema migration is likely needed later, but not in this pass.

## 2. Current Storage Map

### UserMapConclusion
- Has `status`.
- Has `visibility`.
- Has supersession links.
- Closest current fit for internal candidates.
- Existing dark-engine candidate persistence writes here.
- Current status values are not a full shared candidate lifecycle.

### Investigation
- Has workflow `status`.
- No `visibility` field.
- No candidate lifecycle field.
- Not safe for automated dark-engine candidate storage yet.

### ModelUpdate
- Has `visibility` including `candidate`.
- Has `updateType`.
- No explicit candidate lifecycle status field.
- Candidate semantics are incomplete without lifecycle/status.

### FieldworkAssignment
- Has execution `status`.
- No candidate lifecycle field.
- No visibility field.
- Should not be used as generalized dark-engine candidate storage yet.

### UnderstandingEvidenceLink
- Suitable for provenance linkage.
- Contains `summary`, `snippet`, `quote`, and `meta`.
- Lacks lifecycle and visibility/public-safety controls per row.
- Must not be treated as public-safe candidate storage by default.

### DerivationRun / DerivationArtifact
- Can represent diagnostics/artifact-level output.
- Payload is JSON and not typed candidate-object storage.
- Useful for diagnostics/history, not canonical candidate lifecycle.

## 3. Candidate Lifecycle Requirements

Canonical lifecycle states for future generalized candidate storage:
- `proposed`
- `held_for_more_evidence`
- `rejected`
- `promoted`
- `superseded`
- `expired`

| State | Meaning | User-visible | Durable model belief | Expected transitions | Gate/evidence movement requirements |
|---|---|---|---|---|---|
| `proposed` | Candidate hypothesis/proposal exists and is reviewable. | No (internal-only) | No | `held_for_more_evidence`, `rejected`, `promoted`, `expired`, `superseded` | Baseline objectivity/source-safety/provenance checks pass for proposal-level output. |
| `held_for_more_evidence` | Not rejected, but insufficient confidence for promotion. | No | No | `proposed`, `rejected`, `expired`, `superseded` | Conflict, weak spread, thin evidence, single-episode/high-emotion dominance, or unresolved uncertainty. |
| `rejected` | Candidate fails required conditions and should not be promoted. | No | No | `proposed` (only via new candidate cycle), `superseded` | Explicit rejection reason retained; unsafe overclaim and hard gate failures block promotion. |
| `promoted` | Candidate accepted through full gates into accepted object state. | Potentially later, via separate projection gate | Yes (target object state) | `superseded` | Full gate passage, meaningful delta where required, provenance/ownership integrity, and policy language constraints. |
| `superseded` | Candidate/object replaced by a newer candidate/object. | No by default | Not active belief if candidate-level; historical lineage retained | terminal or archival transitions | Provenance and lineage retention required; must not erase interpretation history. |
| `expired` | Candidate timed out without enough supporting evidence. | No | No | terminal or restart via new `proposed` candidate | Recency and staleness policy thresholds exceeded without promotion. |

Current-state constraint:
- No current schema fully represents this lifecycle across all candidate object families.
- Future schema must either add shared lifecycle fields, add a separate candidate object/table, or use a hybrid approach.

## 4. Storage Strategy Decision

Current decision:
- Do not migrate schema now.
- Do not expand durable candidate writes now.
- Use current no-write route plus evaluation harness for internal inspection only.
- Treat existing `UserMapConclusion` candidate persistence as legacy, narrow, and internal, not generalized Phase 2 completion.

Future likely decision:
- A schema migration is probably required before generalized candidate storage.
- Possible directions:
  1. separate candidate table/object
  2. shared lifecycle fields across target objects
  3. hybrid model

Final schema choice is explicitly deferred in this pass.

## 5. Candidate Family Rules

### UserMapConclusion candidate
- Requires evidence spread, source safety, objectivity gates, and meaningful-delta discipline where applicable.
- Must remain internal until promotion.
- Must preserve provenance.
- Must support hold/reject/supersede/expire behavior.

### Investigation candidate
- Preferred when evidence is uncertain, conflicted, high-emotion, or single-episode dominated.
- Should not require the same certainty threshold as conclusion promotion.
- Needs explicit internal visibility controls before automated creation.

### ModelUpdate candidate
- Requires meaningful delta from existing model state.
- Must obey Phase H compatibility when action/fieldwork feedback is involved.
- Must not be created from thin feedback.
- Needs lifecycle support beyond `visibility=candidate`.

### FieldworkAssignment candidate
- Proposed when further observation is required.
- Must not auto-assign execution work without review or explicit trigger policy.
- Needs a candidate/proposed state distinct from execution states (`assigned`/`active`).

### UnderstandingEvidenceLink candidate/provenance
- Must enforce source/target ownership integrity.
- Raw `snippet` and `quote` remain internal-only unless future projection policy explicitly allows safe projection.
- Evidence links must not expose raw text by default.

## 6. Required Gates Before Durable Candidate Writes

Before any future durable candidate write path is enabled, all applicable gates must pass:
- no-write orchestrator output exists
- evaluation harness passes
- source-safety checks pass
- raw evidence leakage checks pass
- objectivity gates pass, or route output to hold/investigation behavior
- meaningful delta passes for conclusions/model updates where required
- conflict handling is explicit
- Phase H compatibility passes for `surfaced_action`/action-feedback dependent flows
- single-episode/high-emotion material does not become durable conclusion by default
- ownership and provenance checks pass

## 7. Existing Write Path Boundary

Current write-path boundary:
- `persistInternalUserMapConclusionCandidate` writes `UserMapConclusion` + `UnderstandingEvidenceLink` + derivation artifacts.
- This path is narrow/internal and must not be treated as generalized candidate storage.
- It must not be wired into the no-write route without a later gated persistence contract.
- Additive Phase 1B POST routes can write objects manually, but they are not dark-engine gated candidate flows.
- Future dark-engine writes must not bypass no-write, evaluation, and source-safety gates.

## 8. Public Visibility / Projection Rules

Visibility policy for candidate storage:
- Candidate storage is internal-only by default.
- Public/mobile projection requires a separate future projection gate.
- Raw evidence, snippets, quotes, notes, and private text must not be exposed.
- Do not use "model learned" language for candidate state.
- Candidate state must remain distinguishable from accepted model belief.

## 9. Schema Migration Decision Criteria

Before any schema migration, all of the following must be defined and accepted:
- lifecycle semantics are finalized
- target candidate families are finalized
- promotion/rejection/supersession workflow is defined
- reviewer/approval behavior is defined
- evidence-link raw/public-safe policy is defined
- public/mobile projection boundary is defined
- lifecycle transition test plan is defined
- rollback and supersession behavior is defined

## 10. Explicit Non-Goals

This pass does not:
- migrate schema
- add enums
- add tables
- add routes
- implement storage
- create candidates
- create ModelUpdates
- create UserMapConclusions
- create Investigations
- create FieldworkAssignments
- mutate PatternClaims
- alter `UnderstandingEvidenceLink` runtime behavior
- expose raw evidence
- add public/mobile UI
- schedule or automate dark-runs
- implement agents/lenses/Intelligence Library

## 11. Open Questions / Deferred Decisions

- Separate candidate table vs shared lifecycle fields vs hybrid approach.
- Whether `ModelUpdate` requires lifecycle status beyond `visibility`.
- Whether `Investigation` and `FieldworkAssignment` need visibility fields.
- How to represent held/rejected/expired consistently across families.
- How evidence links attach to unpromoted candidates.
- How raw `snippet`/`quote` should be governed for public safety.
- Reviewer approval workflow and authority boundaries.
- Promotion, supersession, and expiration mechanics.
- Whether `DerivationArtifact` remains diagnostics-only or becomes candidate staging.

## 12. Recommended Next Step

Recommended sequence:
- Run closeout audit of this contract.
- Then choose one next track:
  1. candidate lifecycle/schema design audit
  2. repair and narrow current `UserMapConclusion` candidate persistence behind harness gates
  3. keep storage deferred and move to scheduled no-write trigger design
  4. formal Phase 2 gap/closeout audit
