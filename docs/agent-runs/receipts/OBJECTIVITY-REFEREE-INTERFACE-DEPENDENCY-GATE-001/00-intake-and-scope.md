# 00 — Intake and scope

**Task:** OBJECTIVITY-REFEREE-INTERFACE-DEPENDENCY-GATE-001
**This is NOT CEQR-005.**
**Baseline:** staging @ `e608750`
**Gate classification:** PASS_WITH_NARROW_PATCH

## Landed prerequisites

- CEQR-001 — provider-agnostic Intelligence Kernel and contradiction adjudicator
- CEQR-002 — marker-only creation quarantine
- CEQR-003 — qualifier/context preservation and semantic consistency gates
- CEQR-004 — same-session zero-or-one semantic selection

## Purpose

Determine whether the shared Objectivity Referee interface is sufficiently explicit, fail-closed, versioned, inspectable and tested to satisfy the CEQR-005 dependency gate for `objectivity_referee_interface`.

## Decision summary

The TypeScript interface alone was **not** sufficient. A narrow patch added:

- dedicated interface version;
- execution state distinct from outcome;
- outcome-specific deterministic validation;
- fail-closed safe execution wrapper;
- continuation policy (`refereeAllowsContinuation` — not persistence);
- full inspectable `ObjectivityRefereeResult` on adjudication output;
- contract tests covering the required matrix.

## Explicit non-goals

- CEQR-005 migration
- Live/shared AI referee prompt or provider
- Candidate materialisation
- Schema / migrations
- Natural-entry proof
- Mutation of existing 25 candidates

## Standing invariants

- Production readiness remains **NO**
- Durable persistence remains separately blocked
- Existing 25 candidates unchanged
