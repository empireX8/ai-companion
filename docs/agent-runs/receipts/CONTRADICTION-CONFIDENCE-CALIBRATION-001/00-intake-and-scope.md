# 00 — Intake and scope

**Task:** CONTRADICTION-CONFIDENCE-CALIBRATION-001
**Campaign slice:** CEQR-006 — Confidence calibration
**Branch:** `desktop-contradiction-confidence-calibration-001`
**Worktree:** `/Users/user/ai-companion-worktrees/desktop-contradiction-confidence-calibration-001`
**Baseline HEAD:** `4883a59`
**Date:** 2026-07-21

## Landed prerequisites

- CEQR-001 through CEQR-005 are landed.
- Objectivity Referee interface dependency is satisfied.
- Dual-side lineage contract exists and is non-persisting.
- This task is CEQR-006 only.

## Purpose

Implement one bounded, pure, deterministic, and versioned confidence policy for repaired contradiction proposals.

The policy converts validated signals into a persistence-facing confidence **recommendation**:

- model-reported numeric confidence in `[0,1]`
- semantic adjudication state
- deterministic adjudication validation
- validated Objectivity Referee execution state
- validated referee outcome
- optional / required referee-adjusted confidence
- (downstream gates already validate dual-side lineage; this module does not re-validate spans)

## Explicit non-goals (this slice)

- Not empirical or statistical calibration
- Not a probability estimate of contradiction truth
- No production model calls
- No production Objectivity Referee implementation
- No provider / route / message-send / import materialisation wiring
- No candidate creation or ContradictionNode persistence
- No EvidenceSpan persistence
- No schema changes or migrations
- No database writes
- No re-evaluation or mutation of the existing 25 legacy candidates
- No UI / Import review / Inspector / Map changes
- No CEQR-007 / CEQR-008 / CEQR-009 / CEQR-010
- Production readiness remains **NO**

## Allowed surface

- `lib/contradiction-confidence-calibration.ts` (new)
- `lib/__tests__/contradiction-confidence-calibration.test.ts` (new)
- this receipt directory

## Forbidden surface (untouched)

- Prisma schema / migrations
- `lib/contradiction-materialization.ts`
- production detection → materialisation wiring
- routes and providers
- existing candidate rows and account intelligence objects

## Language discipline

Use only:

- model-reported confidence
- effective confidence
- confidence policy
- policy-calibrated confidence band
- storage-band recommendation
- candidate confidence floor
- deterministic confidence recommendation
- not a probability estimate

Do **not** claim Bayesian posterior, observed model accuracy, scientific calibration, or verified truth probability.
