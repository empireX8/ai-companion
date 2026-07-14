# 00 — Intake and existing write map

**Run:** DESKTOP-DURABLE-ACTIONS-ASSAULT-001
**Baseline:** staging @ eb5b0fa
**Date:** 2026-07-14

## Action families and existing storage

| Family | UI control | Storage model | Write route | Read path | Ownership |
|---|---|---|---|---|---|
| Corrections | Map + Inspector `DurableCorrectionControls` | `UserMapConclusion.lastUserCorrection*` | `PATCH /api/user-map/conclusions/[id]` | `GET /api/user-map/conclusions`, detail GET | `auth()` + `userId` on row |
| Decision outcomes | Decisions + Inspector `DurableDecisionOutcomeControls` | `SurfacedAction.status` + `note` | `PATCH /api/actions/[id]` | `GET /api/actions` via hybrid decisions API | `updateSurfacedActionState` user scope |
| Fieldwork check-ins | Explore Fieldwork Bridge + Inspector `DurableFieldworkCheckInControls` | `FieldworkAssignment.observationNote` | `PATCH /api/fieldwork/[id]` | `GET /api/watch-for`, `GET /api/fieldwork/[id]` | `auth()` + `userId` on row |

## Pre-change gaps (session-only / incomplete)

- Map correction chips were reference-only or optimistic without server confirmation.
- Decision outcome UI did not call production PATCH.
- Fieldwork Bridge had no durable check-in write.
- Inspector did not always refresh after writes.
- Map list/detail did not propagate correction fields on reload.

## Implementation approach

Reuse existing Prisma models (no schema migration). Added shared client contract (`lib/durable-user-actions-contract.ts`), production UI controls, hybrid refresh context, list/detail correction field propagation, map/watch-for fetch retry, page-auth Playwright stabilization, and marker-scoped fixtures.

## Final campaign status

**FULLY VERIFIED** — see `08-final-result-for-kay.md`. Playwright **5/5**; fixture remaining counts **0/0/0**.
