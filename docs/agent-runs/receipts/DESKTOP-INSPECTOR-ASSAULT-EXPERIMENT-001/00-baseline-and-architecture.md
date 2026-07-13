# Baseline and Architecture

## Checkpoint 0 — PASS

- Branch: `desktop-inspector-assault-experiment-001`
- `HEAD`: `91933acaa1dd0a6d35b77281e06a16aab30dd80c`
- Local `staging`: `91933acaa1dd0a6d35b77281e06a16aab30dd80c`
- Initial tree: clean at experiment start; experiment changes remain uncommitted
- Expected baseline `staging @ 91933ac`: confirmed

After locked dependencies were installed, **seven Vitest failures across five files** reproduced on clean staging:

1. `free-explore-chat-hybrid-fetch.test.ts` (1) — documented stale
2. `orvek-ux-integration.test.ts` (1) — documented stale
3. `evidence-pointer-surfacing-rationale-schema.test.ts` (2) — schema/migration drift
4. `explore-composer-wireup.test.ts` (1) — explore composer wiring
5. `surfaced-evidence-pointer-schema.test.ts` (2) — schema/migration drift

**None** of these failures was introduced by the Inspector assault experiment. Not repaired in this slice.

An additional selector-list assertion failed during the experiment while embedded-only types temporarily widened the public-safe selector list; the implementation was repaired by keeping the six public-safe selector types separate from embedded workbench selection types.

## Baseline architecture

The active workbench mounted `components/orvek-v0/evidence-panel.tsx` through `components/orvek-v0/workbench.tsx`.

The production stack was:

- `components/inspector/WorkbenchInspector.tsx`
- `components/inspector/InspectorPanelRouter.tsx`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/inspector/panels/ModelMovementInspectorPanel.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`

It was inactive because `OrvekWorkbenchShell` discarded the route-shell children that mounted `OrvekV0PageShell` and its bridge.

## Closeout tab architecture

Dual tab-state risk identified by independent verifier is **resolved** via a deliberate one-way contract:

| Store | Role |
|---|---|
| Workbench `inspectorTab` + `inspectorTabExplicit` | User tab intent; set by `setInspectorTab` / `select(id, tab?)` |
| `InspectorContext.tab` | Inspector display state; synced from workbench on same-selection tab changes; set on `selectObject` / `pushObject` / `goBack` |
| Bridge signature | **Excludes tab** — selection refresh dedupe cannot reset user-chosen tab |
| `resolveBridgedInspectorTab` | Object-type default on new selection unless `inspectorTabExplicit` |

Implemented in: `lib/inspector-tab-contract.ts`, `components/orvek-v0/useProductionInspectorTab.ts`, `components/orvek-v0/store.tsx`, `ProductionInspectorBridge.tsx`.

## Representative selections

| Family | ID | Proof level in this experiment |
|---|---|---|
| Depth-safe live receipt | `receipt-pattern-dev-live-evidence-depth-claim` | **Authenticated HTTP + behavior composition** |
| Live map conclusion | `dev-live-evidence-depth-conclusion` | **Authenticated HTTP + behavior composition** |
| Live model update | `cmrjd6ntp0002qlq3n6hbkh4c` | **Authenticated HTTP + behavior composition** |
| Live active question | `inv-resolved-1` | Code/test only — **not** HTTP- or browser-replayed |
| Reference-only decision | `d1` | Code/test only — **not** HTTP- or browser-replayed |
| Reference-only report | `rep-weekly` | Code/test only — **not** HTTP- or browser-replayed |
| Missing selection | `missing-inspector-selection` | Code/test only — **not** HTTP- or browser-replayed |

Only **three** of seven representative selections received authenticated runtime replay. Do **not** claim all seven were runtime-proven.

## Coverage evidence layers

| Layer | What it proves |
|---|---|
| **Behavior-level** | Tab contract, navigation state (`pushObject`/`goBack`), provenance composition, bridge dedupe without tab |
| **Source-string** | Panel wiring, deferred action labels, mount gates — guards only; not sufficient alone for tab/navigation |
| **Authenticated HTTP** | Receipt, conclusion, model-update live hydration paths |
| **Browser click-through** | **Not recorded** — fixture rows not visible in workbench UI during Playwright session |
