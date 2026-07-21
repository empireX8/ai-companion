# 00 — Intake and bounded scope

**Task:** CONTRADICTION-DUPLICATE-PREVENTION-001
**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Campaign slice:** CEQR-007
**Branch:** `desktop-contradiction-duplicate-prevention-001`
**Worktree:** `/Users/user/ai-companion-worktrees/desktop-contradiction-duplicate-prevention-001`
**Baseline HEAD:** `f2ad32d7c8310d88eccbe16cf770d7c34e3806c4`
**Date:** 2026-07-21

## Purpose

Prove that repeated valid repaired-persistence invocations for the same authoritative contradiction resolve to **one** durable `ContradictionNode`, using database-enforced exact ordered dual-side span identity.

## Exact identity (authority)

`userId + sideASourceSpanId + sideBSourceSpanId` (ordered Side A / Side B roles)

## Explicit non-identity / non-goals

- Fuzzy / title / proposition-text matching
- Marker families / token overlap / similarity
- Legacy contradiction detection
- Side-B-only sibling suppression
- Reversed-side equivalence
- `sourceMessageId` as identity
- Live route / message-send / import / provider wiring
- Re-evaluation or mutation of the existing 25 Kay contradiction nodes
- CEQR-008 / CEQR-009 dual-source presentation
- ModelUpdate / ContradictionEvidence writes

## Allowed surface

- `prisma/schema.prisma` (compound unique only)
- `prisma/migrations/20260721140000_add_contradiction_exact_dual_side_unique/`
- `lib/contradiction-repaired-persistence.ts`
- `lib/__tests__/contradiction-repaired-persistence.test.ts`
- `lib/__tests__/contradiction-duplicate-prevention-schema.test.ts`
- this receipt directory

## Production readiness

**NO**
