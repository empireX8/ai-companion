# 08 — Shared Inspector presentation (CEQR-009 Path B)

## Route

`app/api/inspector/contradictions/[id]/route.ts`

- Selects `sideASourceSpanId` / `sideBSourceSpanId`
- Attaches `dualSource` via shared projection
- Status allowlist unchanged: `open | explored | snoozed | resolved | accepted_tradeoff | archived_tension`
- `candidate` remains excluded (404)

## Types

`InspectorContradictionProjection.dualSource` required in `lib/inspector-object-api.ts`.

## UI

`SelectedObjectEvidencePanel` ContradictionEvidencePanel + RelatedSignalSection render `ContradictionDualSourceView`.

Durable correction / decision / fieldwork controls unchanged.
