# 00 — Intake and scope

**Slice:** CEQR-002 — Marker-only creation quarantine
**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Receipt campaign id:** CONTRADICTION-MARKER-ONLY-QUARANTINE-001
**Branch:** `desktop-contradiction-marker-only-quarantine-001`
**Baseline:** staging @ `03802eb` (CEQR-001 landed)
**Date:** 2026-07-20

## Controlling facts

- CEQR-001 is landed at staging `03802eb` (model-assisted semantic adjudication kernel foundation).
- CEQR-002 does **not** wire the CEQR-001 adjudicator into live chat or import.
- Markers remain nomination hints only.
- Token overlap remains nomination / relevance / dedupe information only.
- Marker-only creation is quarantined.
- Semantic runtime adjudication is not wired.
- Existing 25 candidates remain unchanged.
- CEQR-003 and CEQR-004 are not implemented.
- CEQR-005 remains blocked (depends on CEQR-002–004 + referee interface).
- Production readiness: **NO**.

## Product truth

Orvek is an evidence-backed personal understanding engine (`capture → reveal → understand`).
AI determines what the evidence may mean. Deterministic code validates provenance, schema, and persistence permissions.

## Scope

### Allowed

- `lib/contradiction-detection.ts`
- `lib/import-chatgpt.ts`
- `lib/__tests__/contradiction-detection.test.ts`
- `lib/__tests__/import-chatgpt.test.ts`
- Narrowly justified test updates where prior expectations encoded marker-only creation (`import-archive`, `contradiction-backfill`)
- This receipt directory

### Forbidden (unchanged)

- `app/api/message/route.ts`
- `lib/contradiction-materialization.ts`
- `lib/contradiction-adjudicator.ts`
- `lib/orvek-intelligence-kernel/**`
- Prisma schema / migrations
- Candidate review actions
- Map / Inspector / UI
- Existing CEQR-001 receipts
- Kay DB mutation

## Goal

Quarantine every legacy path that could create or materially update a `ContradictionNode` solely from rhetorical markers, goal/constraint keywords, token overlap, textual similarity, behavioral-admission regex, or the mere existence of a goal/constraint reference.

Safe current result: abstention / quarantine — not forced candidate creation.
