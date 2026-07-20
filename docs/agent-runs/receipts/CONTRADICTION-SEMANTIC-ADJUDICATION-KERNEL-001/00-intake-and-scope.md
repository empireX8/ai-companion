# 00 — Intake and scope

**Slice:** CEQR-001 — Model-assisted semantic adjudication kernel foundation
**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Branch:** `desktop-intelligence-kernel-contradiction-adjudication-001`
**Baseline:** staging @ `516f47f`
**Date:** 2026-07-20

## Purpose

Implement only:

- minimum reusable Orvek Intelligence Kernel input/output foundation;
- provider-agnostic model-runner boundary;
- structured model-assisted contradiction adjudication;
- deterministic validation of the model result;
- bounded Objectivity Referee interface;
- contract-complete focused tests.

ContradictionNode is the first proof object.

## Current boundary (traced before edit)

| Fact | Status |
|------|--------|
| Legacy markers and token overlap may nominate possible material only | Confirmed in `lib/contradiction-detection.ts` |
| Legacy runtime remains untouched | Required; verified by structural tests |
| CEQR-001 creates no database object | Required |
| CEQR-001 returns an adjudication result only | Implemented |
| Later slices decide nomination, selection, persistence, migration | Out of scope |

## Forbidden (honoured)

- No Prisma schema / migration changes
- No Kay DB mutation
- No accept/reject of candidates; no decision POST
- No change to existing 25 ContradictionNode candidates
- No wiring into `app/api/message/route.ts`, import, or materialisation
- No CEQR-002…005
- No full multi-object router / multi-agent / Intelligence Library
- No live provider calls in automated tests
- No hard-coded provider in domain contract
- No commit / push

## Production readiness

**NO**
