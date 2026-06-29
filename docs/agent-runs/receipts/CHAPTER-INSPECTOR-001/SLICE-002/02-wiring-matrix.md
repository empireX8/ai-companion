# Wiring Matrix — SLICE-002

**Date:** 2026-06-29

| Section / behavior | Route / API | Key fields | Component | Data status | Risk |
|--------------------|-------------|------------|-----------|-------------|------|
| Selected `model_update` object/context rendering | `GET /api/what-changed/[id]` | `item`, `report`, `affectedObjectType`, `affectedObjectId` | `ModelUpdateEvidencePanel` | exists | Boundary drift if movement-only sections are reused |
| Affected conclusion context | `GET /api/user-map/conclusions/[id]` via existing fetch helper | `summary`, conclusion fields, object context | `RelatedMapConclusionSection` + `SourceObjectSections` | exists | Direct conclusion behavior must stay intact |
| Supporting evidence merge | `GET /api/what-changed/[id]/evidence` + affected-object evidence endpoint | `sourceType`, `sourceId`, `objectTitle`, `createdAt` | `EvidenceLinksSection` | exists | Route leakage regression if selection control changes |
| Movement report change conditions | `GET /api/what-changed/[id]` | `report.whatWouldChangeThisConclusion` | `ModelMovementInspectorPanel` | exists | Must remain on Movement tab only |
| Direct object change conditions | Existing object projection data | `object.whatWouldChange` | `SourceObjectSections` | exists | Must remain visible for direct object evidence views |

---

## Data-path proof plan

| Check | Command / query | Expected |
|-------|-----------------|----------|
| Golden movement route stays wired | `npx vitest run lib/__tests__/inspector-surface-wiring.test.ts lib/__tests__/inspector-evidence-presentation.test.ts` | PASS |
| Legacy inspector navigation guard remains | `npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-legacy-inspector-routes.ts` | PASS |
| Closeout receipt shape is valid | `npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-agent-closeout.ts docs/agent-runs/receipts/CHAPTER-INSPECTOR-001/SLICE-002/06-closeout-receipt.md` | PASS |

---

## Reuse map

| Existing component | Reuse for |
|--------------------|-----------|
| `SourceObjectSections` | Keep direct object Evidence / Context sections intact while allowing a `model_update` boundary override |
| `ModelMovementInspectorPanel` | Preserve the canonical epistemic report, including “What Would Change This Conclusion” |
| `InspectorEvidenceSelectionControl` | Preserve in-inspector evidence and receipt navigation |

---

## Out of matrix (explicitly not wired this slice)

- Movement readability redesign (`SLICE-003`)
- Visual polish (`SLICE-004`)
- Inspector history / back stack
- New routes, schema, or non-Inspector surface changes

**Implementation may start:** yes
