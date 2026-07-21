# 00 — Intake and scope

**Task:** CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001
**Campaign slice:** CEQR-005 — dual-side exact span lineage migration
**Branch:** `desktop-contradiction-dual-side-lineage-migration-001`
**Baseline:** staging @ `f14c5fd`
**Date:** 2026-07-21

## Landed prerequisites

- CEQR-001 through CEQR-004 are landed.
- Objectivity Referee interface dependency is satisfied.
- This task is CEQR-005.

## Purpose

Implement the bounded database schema and deterministic construction contract required for exact symmetric Side A and Side B contradiction lineage.

Representable shape after this slice:

- ContradictionNode → exact Side A EvidenceSpan → exact Side A Message → Side A Session
- ContradictionNode → exact Side B EvidenceSpan → exact Side B Message → Side B Session

## Explicit non-goals (this slice)

- No live contradiction persistence
- No candidate creation or update
- No materialisation wiring
- No migration application to Kay’s database
- No backfill of the existing 25 ContradictionNode candidates
- No CEQR-006 or later slices
- Production readiness remains **NO**

## Allowed surface

- `prisma/schema.prisma`
- one new Prisma migration directory
- `lib/contradiction-dual-side-lineage.ts`
- `lib/__tests__/contradiction-dual-side-lineage.test.ts`
- this receipt directory

## Narrow deviation

`app/api/contradiction/route.ts` and `app/api/contradiction/[id]/route.ts` — added `sideASourceSpanId` / `sideBSourceSpanId` to existing `CONTRADICTION_WITH_EVIDENCE` selects so Prisma select results remain assignable after the Design A scalar fields were added. No persistence wiring, no create/update, no materialisation.

## Forbidden surface (untouched)

- `lib/contradiction-materialization.ts`
- `lib/contradiction-detection.ts`
- `lib/contradiction-backfill.ts`
- import / message routes
- Map / Inspector UI
- production provider / live referee implementation
- existing CEQR receipt directories
- existing candidate data
