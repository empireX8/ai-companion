# 02 — Overlay provenance and report identity

## Explicit provenance (not styling inference)

Module: `lib/model-movement-report-provenance.ts`

| State | Visible label | Attribute |
|---|---|---|
| Live authenticated ModelUpdate path | `LIVE MODEL UPDATE REPORT` | `data-report-provenance="live_model_update"` |
| Reference / sample | `REFERENCE / SAMPLE REPORT` | `data-report-provenance="reference_sample"` |

Overlay (`components/orvek-v0/overlays.tsx`) renders the provenance chip via `report-overlay-provenance`, and surfaces before / after / rationale / cited evidence / canonical ID.

Live report builder sets `reportProvenance: "live_model_update"` in `lib/model-movement-report-contract.ts`. Meaningful live report content now requires full readiness ingredients (provenance, rationale, evidence count, before/after).

## Single report identity

Canonical ModelUpdate ID is shared across:

- Today movement row / See Why / full-report control
- Timeline movement row
- Inspector Model Movement (`inspector-model-update-id`)
- Report overlay (`report-overlay-canonical-id`)
- `/api/what-changed/[id]` and `/api/what-changed/[id]/evidence`

Hybrid completion fix: when Today movement depth is ready, `mergeTodayOverlay` injects those ModelUpdate IDs into Timeline Today-lane groups (`injectLiveMovementIdsIntoTimelineGroups`) so hybrid does not keep showing reference `t1…t14` while full Timeline readiness merge is incomplete. TimelinePage uses `hasLiveTodayPresentation` (and non-empty live groups) instead of requiring a global `displayContract`.

## Behavior tests

- `lib/__tests__/model-movement-report-provenance.test.ts`
- `lib/__tests__/movement-report-completion-identity.test.ts`
- Playwright positive + reference journeys
