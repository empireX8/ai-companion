# 00 — Intake and boundaries

**Campaign:** WAVE 1.1 — CONTRADICTIONNODE TO CANONICAL MAP ACTIVE-CONFLICTS LIVE PROJECTION
**Branch:** `desktop-contradiction-map-conflict-projection-001`
**Baseline:** staging @ `e3b79ed`
**Mode:** implementation (read-path only) — no Kay DB mutation

---

## Purpose

Implement the missing read-path translation:

open ContradictionNode → authenticated production read → Map adapter → canonical Map **Active conflicts** → selectable Orvek object → Inspector `contradiction_node`.

This is the prerequisite for Wave 2.1 (human accept of one genuine candidate). Wave 2.1 is **out of scope**.

---

## Controlling audit

- `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/`
- Especially: `08`, `10`, `12`, `13`, `14`, `15`

---

## Non-negotiable boundaries

| Rule | Status |
|------|--------|
| Do not mutate Kay’s database | REQUIRED |
| Do not accept/reject candidates | REQUIRED |
| Do not change candidate status | REQUIRED |
| Do not create ModelUpdate / UELs | REQUIRED |
| Do not run production data seeds | REQUIRED |
| Do not create/edit Prisma migrations | REQUIRED |
| Do not change schema unless blocker proven | REQUIRED |
| Do not remove synthetic/reference data | REQUIRED |
| Do not globally replace composition Map with live Map | REQUIRED |
| Do not repair Goals / ProfileArtifact / Timeline / uploader / dead buttons | REQUIRED |
| Do not start Wave 2.1 | REQUIRED |
| Do not commit / push / PR / merge | REQUIRED |
| Production readiness remains NO | REQUIRED |
| npm audit fix out of scope | REQUIRED |

---

## Account gate (read-only)

Must remain:

- pending total **53**
- ReferenceItem pending **28**
- ContradictionNode pending **25**
- chicken-burger ReferenceItem **active**
- PatternClaims **7**
- ModelUpdates **1**
- no candidate status changes
- no new UELs
- no database mutation

---

## Allowed work

- Authenticated user-scoped read for open ContradictionNodes (reuse or smallest GET)
- MapMapDataInput + adapter + production map-api projection
- Composition-safe **conflicts-only** merge exception
- Provider wiring on hybrid/live Map path
- Focused tests + non-persistent dev fixture for presentation/selection
- Receipts under this directory

---

## Forbidden work

- Candidate accept/reject
- Schema/migrations
- Global mock removal
- Fabricating evidence, movement, certainty, or UserMapConclusion identity
- Using quarantined `components/orvek-v0/pages/map.tsx` as the mounted surface
