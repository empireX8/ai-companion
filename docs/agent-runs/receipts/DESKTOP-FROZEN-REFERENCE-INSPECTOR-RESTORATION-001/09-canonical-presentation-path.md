# 09 — Canonical ModelUpdate presentation path

## Architecture

```
live production sources
  → production hydration (useProductionModelUpdateInspector)
  → composeProductionModelUpdateCanonicalViewModel
  → canonical OrvekObject + satellites
  → shared ObjectDetail / MovementView
```

Frozen reference is unchanged as data authority; both routes render the same
`components/orvek-v0-authority/evidence-panel.tsx` presentation functions.

## Capability migration (fork → shared path)

| Capability | Enters shared path via |
|---|---|
| Authenticated selected-object identity | `selectedId` + `inspectorObjectId`; compose title via `resolveModelUpdateDisplayTitle` |
| Composed MU + affected-object data | `loadAffectedObjectContext` → compose `relatedIds` / satellites |
| Live receipt quotes | Evidence links → `receiptIds` + receipt satellites (`sourceText`) |
| Supporting / conflicting | Truthful report `facts` / `speculations` → `supporting` / `conflicting` (no procedural packet copy) |
| Related-object navigation | `relatedIds` + sticky overlay satellites → `LinkedRow` / `pushSelection` |
| Back stack + scroll | `store.pushSelection` / `goBack` + `pendingInspectorScrollTop` |
| Correction controls | Shared `ObjectDetail` durable/local correction block |
| Ask in Explore | Shared `ObjectDetail` Explore button |
| Live movement-report identity | `canonicalReportId` → `MovementView` `openReport(reportId)` |
| Report overlay | Shared workbench `reportId` overlay |
| Loading / unavailable / error | Skeleton / `ModelUpdateUnavailableState` only while hydrating or truly missing |
| Ownership / provenance | Live detail ownership preserved in fetchers; overlay does not invent claims |

## Removed from active path

- `ProductionModelUpdateEvidenceDetail`
- `ProductionModelUpdateMovementView`

Production-specific code remains in adapters, fetchers, auth, and action handlers only.
