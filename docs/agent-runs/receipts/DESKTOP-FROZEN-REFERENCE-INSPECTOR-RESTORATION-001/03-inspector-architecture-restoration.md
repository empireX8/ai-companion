# 03 Inspector Architecture Restoration

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`

## Root Cause Verdict

The production ModelUpdate data was **not** genuinely absent, and the selected object was **not** the wrong identity.

The real architectural answer is:

- a ModelUpdate selection must stay anchored to the live canonical ModelUpdate id
- the shared Inspector must then build a composed read model from that id:
  - thin selected `OrvekObject`
  - canonical `modelUpdateId`
  - `/api/what-changed/[id]` detail payload
  - hydrated affected-object context
  - hydrated evidence links
  - hydrated movement report sections
  - cached back-trail continuity for linked navigation

That means the correct representation is **a composed Inspector read model containing both the ModelUpdate and the affected-object detail**, not the thin list row alone and not the affected object alone.

## Exact Production Trace

1. `lib/orvek-adapters/today.ts` stamps Today hero/movement/report intents with the live `modelUpdateId`.
2. `lib/orvek-v0/production/today-api.ts` builds the selected `OrvekObject` with `type: "model-update"` and `inspectorObjectId: update.id`.
3. `components/orvek-v0/production/ProductionInspectorBridge.tsx` selects `objectId: inspectorObjectId` and `modelUpdateId: inspectorObjectId` into Inspector state.
4. `components/orvek-v0-authority/evidence-panel.tsx` derives `selectedModelUpdateId = obj.inspectorObjectId ?? obj.id` for production ModelUpdate selections.
5. `useProductionModelUpdateInspector(...)` fetches:
   - `fetchInspectorModelUpdateDetail(modelUpdateId)`
   - `fetchInspectorEvidenceLinks(/api/what-changed/[id]/evidence)`
   - `loadAffectedObjectContext(detail.item)`
6. `loadAffectedObjectContext(...)` resolves the affected object through:
   - `fetchInspectorUserMapDetail(...)`
   - `fetchInspectorPatternClaim(...)`
   - `fetchInspectorContradiction(...)`
   - affected-object evidence endpoints where available
7. Movement/report hydration comes from `detail.report` plus `obj.canonicalReportId ?? obj.id` for the overlay identity.
8. `ProductionModelUpdateEvidenceDetail` and `ProductionModelUpdateMovementView` render the shared authority presentation.
9. A per-ModelUpdate cache inside `useProductionModelUpdateInspector(...)` preserves populated detail across linked receipt navigation and Back.

## A / B / C Comparison

Comparison states:

- `A`: `staging @ 1f8cb7c` before this campaign, using `WorkbenchInspector` and `SelectedObjectEvidencePanel`
- `B`: current uncommitted restoration branch, using shared authority `components/orvek-v0-authority/evidence-panel.tsx`
- `C`: confirmed frozen reference route at `/dev/orvek-v0-reference`

Matrix legend:

- `A` answers whether the value already existed in pre-campaign production capability
- `B` answers whether the current branch still has the value
- `C` answers whether the confirmed frozen reference expresses the same section
- `Shared authority input` answers whether the current shared authority panel receives the value
- `Rendered now` answers whether the current branch visibly renders the section
- `Classification` identifies the repair class, not a pre-repair failure snapshot

| Reference section | Required field(s) | Existing production source / API / helper | A | B | C | Shared authority input | Rendered now | Classification |
|---|---|---|---|---|---|---|---|---|
| Affected object | `detail.item.affectedObjectType`, `detail.item.affectedObjectId`, affected-object detail payload | `/api/what-changed/[id]`, `loadAffectedObjectContext(...)`, user-map/pattern/contradiction helpers | Yes via old Inspector fetch | Yes | Yes | Yes | Yes | `EXISTS_BEHIND_OLD_INSPECTOR_FETCH` |
| Source text | linked evidence excerpts / summaries | `/api/what-changed/[id]/evidence`, affected-object evidence endpoint, `projectInspectorEvidenceCard(...)` | Yes via old Inspector fetch | Yes | Yes | Yes | Yes | `EXISTS_BEHIND_OLD_INSPECTOR_FETCH` |
| Summary | `detail.item.userFacingSummary` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Why it matters | `detail.report.stronglySupportedClaims`, fallback `obj.movementRationale` | `/api/what-changed/[id]`, object graph | Yes via old movement read | Yes | Yes | Yes | Yes | `EXISTS_BEHIND_OLD_INSPECTOR_FETCH` |
| Why it resurfaced | `detail.report.loopPatternDetection`, fallback `obj.movementRationale` | `/api/what-changed/[id]`, object graph | Yes via old movement read | Yes | Yes | Yes | Yes | `EXISTS_BEHIND_OLD_INSPECTOR_FETCH` |
| Recorded metadata | `createdAt`, `updateTypeLabel`, `affectedObjectTypeLabel` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Evidence count | `detail.report.evidencePacketSummary.receiptCount` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Receipts | `obj.receiptIds`, report receipt refs | object graph, `collectUniqueReceiptRefs(detail.report)` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Relevant context | `obj.contextIds`, fallback resurfacing detail | object graph, `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Related objects | `obj.relatedIds` | object graph | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Supporting evidence | facts plus linked evidence cards | `detail.report.facts`, movement evidence links, affected-object evidence links | Yes via old Inspector fetch | Yes | Yes | Yes | Yes | `EXISTS_BEHIND_OLD_INSPECTOR_FETCH` |
| Conflicting evidence | `detail.report.speculations` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Confidence | affected-object confidence plus guardrail phrasing | affected-object detail helpers, `detail.report.overreachGuardrails` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Source diversity | `detail.report.evidencePacketSummary.sourceTypeCount`, affected-object stats | `/api/what-changed/[id]`, affected-object helpers | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Time spread | `detail.report.evidencePacketSummary.dateRangeLabel`, affected-object spread stats | `/api/what-changed/[id]`, affected-object helpers | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Before / after | `obj.before`, `obj.after`, `detail.report.modelMovement.before/after` | object graph enrichment, `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Movement rationale | `detail.report.stronglySupportedClaims`, `detail.report.inferences`, `obj.movementRationale` | `/api/what-changed/[id]`, object graph | Yes | Yes | Yes | Yes | Yes | `CONTRADICTORY_DATA` |
| Reality gate | `detail.report.realityGate` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `CONTRADICTORY_DATA` |
| Guardrails | `detail.report.overreachGuardrails` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Watch for next | `detail.report.fieldworkWatchFor` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Re-entry | `detail.report.reentryAction` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| What would change this | `detail.report.whatWouldChangeThisConclusion` | `/api/what-changed/[id]` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Report overlay identity | `obj.canonicalReportId ?? obj.id`, Today `report.reportId` | object graph enrichment, `resolveCanonicalMovementReportFromDepth(...)`, `openReport(...)` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |
| Durable controls | correction controls on ModelUpdate | `supportsDurableCorrection(obj)`, `DurableCorrectionControls` | Yes | Yes | Yes | Yes | Yes | `EXISTS_AND_RENDERED` |

## Shared Presentation Outcome

Production and reference now share one Inspector presentation instead of maintaining two separate visual implementations.

Shared Inspector presentation authority:

- `components/orvek-v0-authority/evidence-panel.tsx`

Compatibility/re-export path kept in place:

- `components/orvek-v0/evidence-panel.tsx`

Shared workbench shell restored in:

- `components/orvek-v0/workbench.tsx`
- `components/orvek-v0/top-bar.tsx`
- `components/orvek-v0/store.tsx`

## Root Cause Classification

The matrix above rules out both `WRONG_OBJECT_SELECTED` and `GENUINELY_ABSENT`.

The actual repair class was:

- primary: `EXISTS_BEHIND_OLD_INSPECTOR_FETCH`
- secondary: shared-authority continuity required a cached composed read model so linked receipt navigation and Back do not drop ModelUpdate detail
- separate live-data issue: `CONTRADICTORY_DATA`, recorded in `known-out-of-scope-intelligence-defect.md`

## Production Capabilities Preserved

Verified preserved capabilities:

- authenticated ownership and user scoping
- live selected-object identity
- evidence-link navigation
- affected-object resolution
- hydrated movement report detail
- Inspector back trail and linked-object return behavior
- durable correction controls
- durable decision-outcome controls
- durable fieldwork check-ins
- honest unsupported and unavailable states

Additional production plumbing restored or hardened:

- Today data hydration retry logic in `lib/orvek-v0/production/today-hydration.ts`
- live report resolution in `lib/orvek-adapters/today.ts`
- per-ModelUpdate shared-authority cache in `components/orvek-v0-authority/evidence-panel.tsx`
- per-user runtime fixture IDs in `lib/model-movement-runtime-fixture.ts`

## Remaining Acceptance Gate

Kay has already approved the frozen reference route as valid authority. Human production visual approval is still required before any claim stronger than `READY FOR KAY VISUAL REVIEW`.
