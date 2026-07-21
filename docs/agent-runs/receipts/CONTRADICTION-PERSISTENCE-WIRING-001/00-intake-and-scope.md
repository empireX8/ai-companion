# 00 — Intake and bounded scope

**Task:** CONTRADICTION-PERSISTENCE-WIRING-001
**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Position:** Unnumbered persistence dependency slice after CEQR-006 and before CEQR-007
**Branch:** `desktop-contradiction-persistence-wiring-001`
**Worktree:** `/Users/user/ai-companion-worktrees/desktop-contradiction-persistence-wiring-001`
**Baseline HEAD:** `f21ade9`
**Date:** 2026-07-21

## Purpose

Build the narrow repaired persistence boundary that can:

1. consume an already validated CEQR-005 dual-side lineage result;
2. consume an already validated CEQR-006 confidence-policy result;
3. verify remaining persistence-specific invariants;
4. ensure or reuse exact Side A and Side B `EvidenceSpan` rows;
5. create exactly one repaired `ContradictionNode` candidate with both span FKs;
6. do all persistence atomically;
7. return an inspectable persistence result.

## Explicit non-goals

- CEQR-007 contradiction duplicate prevention
- Production route / message-send / import / provider / background-job wiring
- Live Objectivity Referee or production provider invocation
- Schema / migration changes
- Re-evaluation or mutation of the existing 25
- Map / Today / Inspector / Timeline / Explore / Experiment / Decisions changes
- ModelUpdate / Model Movement creation
- Invoking the writer against Kay’s existing account database

## Allowed surface

- `lib/contradiction-persistence-plan.ts` (new)
- `lib/contradiction-repaired-persistence.ts` (new)
- `lib/__tests__/contradiction-persistence-plan.test.ts` (new)
- `lib/__tests__/contradiction-repaired-persistence.test.ts` (new)
- this receipt directory

## Forbidden surface (untouched)

- Prisma schema / migrations
- Legacy `lib/contradiction-materialization.ts` behaviour (no silent reuse)
- Routes, providers, import execution
- Existing account intelligence objects

## Production readiness

**NO**
