# 00 — Intake and scope

**Slice:** CEQR-004 — SAME-SESSION ZERO-OR-ONE ELIGIBLE SELECTION
**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Receipt:** CONTRADICTION-SAME-SESSION-ZERO-OR-ONE-SELECTION-001
**Baseline:** staging @ `acf8956`

## Landed prerequisites

- CEQR-001 — provider-agnostic Orvek Intelligence Kernel foundation and contradiction adjudicator
- CEQR-002 — marker-only and token-overlap creation quarantine
- CEQR-003 — context and qualifier preservation with fail-closed semantic consistency gates

## Goal

Create the narrowest provider-agnostic selection boundary that can truthfully return:

- zero selected pairs; or
- exactly one semantically selected same-session pair;

while preserving the distinction between retrieval nomination, model semantic adjudication, zero-or-one pair selection, Objectivity Referee status, deterministic validation, and persistence authorisation.

## In scope

- Same-session ReferenceItem retrieval
- Exact source-unit assembly / source completeness fail-closed checks
- Model-assisted pair adjudication orchestration via landed `adjudicateContradiction`
- Zero-or-one semantic selection with ambiguity abstention
- Explicit persistence blocking (`persistable: false`, `persistenceAuthorised: false`, `persistenceDecision: null`)
- Live/import/backfill session-boundary wiring for the legacy detector query

## Out of scope / not done

- CEQR-005 migration / dual-side persisted lineage
- Durable ContradictionNode creation
- Mapping selected pairs into `DetectedContradiction`
- Calling `materializeContradictions` with selection results
- Shared AI Objectivity Referee implementation
- Production model invocation on every message
- Controlled natural-entry proof
- Reclassification of existing 25 candidates
- Schema / migration changes
- UI / Map / Inspector changes

## Standing invariants

- Existing 25 candidates remain unchanged
- Production readiness remains **NO**
- CEQR-005 remains blocked until the dependency gate is reviewed
- Semantic selection is distinct from persistence authorisation
