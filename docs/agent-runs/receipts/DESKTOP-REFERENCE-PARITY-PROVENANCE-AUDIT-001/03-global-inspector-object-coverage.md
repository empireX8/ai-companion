# Global Inspector Object Coverage

## Result

Coverage denominator: **35 type/subtype units**.

| PASS | PARTIAL | FAIL | UNPROVEN |
|---:|---:|---:|---:|
| **0** | **28** | **1** | **6** |

`PASS` requires production-backed selected-object routing, reference-depth EC, truthful MM, navigable graph links and executing actions. Rich fixture presentation alone is not a pass.

## Active architecture

The active root mounts `components/orvek-v0/evidence-panel.tsx` inside `Workbench`. It reads the hybrid provider graph and falls back to zip fixtures.

The more production-specific `SelectedObjectEvidencePanel` / `ModelMovementInspectorPanel` stack is built, but its `ProductionInspectorBridge` is mounted only inside route shells discarded by `OrvekWorkbenchShell`. Therefore its capabilities are not counted as active-runtime coverage.

Shared current evidence:

- Selection: `components/orvek-v0/store.tsx`.
- Provider-first then zip fallback: `lib/orvek-v0/data-provider.tsx`.
- Active detail and movement: `components/orvek-v0/evidence-panel.tsx`.
- Dormant bridge: `components/orvek-v0/production/ProductionInspectorBridge.tsx`.
- Report overlay zip bypass: `components/orvek-v0/overlays.tsx`.
- Live receipt depth gate: `lib/orvek-v0/production/evidence-inspector-depth-parity.ts`.

## Object coverage

| Type / subtype | Reference presentation | Live source / selected routing | EC / MM / navigation / actions | Provenance | Parity | Shared blocker |
|---|---|---|---|---|---|---|
| receipt | Source quote, why, context, relations, corrections | Stored pointer API can supply depth-safe objects; global inspector cannot select receipt | EC conditional; MM usually empty; active links work; correction in-memory | MIXED | PARTIAL | Depth gate + dormant production inspector |
| decision | Summary, options, context, outcome, receipts | Actions overlay creates decision rows; no global selectable type | EC mixes projection/fixtures; outcome/correction not durable | MIXED | PARTIAL | Write UI absent |
| report / Weekly Report | Full fixture overlay and cited objects | No production report emitter | Overlay ignores provider; no live MM report | FALLBACK | PARTIAL | Report overlay zip bypass |
| report / What Changed | Fixture overlay | No proven live report object | Same | FALLBACK | PARTIAL | Same |
| report / Decision Review | Fixture overlay | No proven live report object | Same | FALLBACK | PARTIAL | Same |
| report / Fieldwork Result | Fixture overlay | No proven live report object | Same | FALLBACK | PARTIAL | Same |
| report / Receipts Resurfaced | Fixture overlay | No proven live report object | Same | FALLBACK | PARTIAL | Same |
| report / Stress Test | Fixture overlay | No proven live report object | Same | FALLBACK | PARTIAL | Same |
| report / Import Source | Fixture overlay | Import rows exist; report object not proven | Same | FALLBACK | PARTIAL | Same |
| fieldwork | Purpose, signal, calibration, check-in | Watch-for/experiment projection can merge | EC partial; check-in local; MM absent | MIXED | PARTIAL | Durable result/check-in missing |
| map-object / claim | Rich receipts, support/conflict, context | User-map conclusion overlay | Active EC links work; global production detail dormant | MIXED | PARTIAL | Selection-aware hydration |
| map-object / conflict | Same, with conflict framing | User-map conclusion/disputed status | Same; correction local | MIXED | PARTIAL | Correction persistence |
| map-object / loop | Same, loop framing | User-map conclusion projection | Same | MIXED | PARTIAL | Graph closure |
| map-object / goal | No fixture uses this subtype; goals are top-level `model-goal` | Type exists only in declaration/mapping possibility | Runtime behavior not established | UNPROVEN | UNPROVEN | Unsupported subtype path |
| map-object / active-question | No fixture uses this subtype; questions are top-level | Preview rows lack inspector ID | Runtime behavior not established | UNPROVEN | UNPROVEN | Adapter/selection gap |
| map-object / model-update | No fixture uses this subtype; updates are top-level | Preview rows lack inspector ID | Runtime behavior not established | UNPROVEN | UNPROVEN | Adapter/selection gap |
| map-object / context | No fixture uses this subtype; contexts are top-level | Context rows use top-level type | Runtime behavior not established | UNPROVEN | UNPROVEN | Unsupported subtype path |
| context / context | Rich summary, receipts, support/conflict | Mind-context snapshot projection | Active EC works; edit/correction not durable | MIXED | PARTIAL | Natural edit path absent |
| model-goal / goal | Rich goal detail and relations | Goal-shaped user-map conclusion | EC projection; no durable goal editor | MIXED | PARTIAL | Write capability missing |
| active-question | Why open, evidence, relations | Active-question overlay can merge | EC partial; resolve/fieldwork actions disabled; MM absent | MIXED | PARTIAL | Actions/write path |
| model-update | Before/after and recent movement in fixtures | Today/timeline APIs supply updates | EC works; live before often absent; recent list fixed | MIXED | PARTIAL | Before/after hydration |
| investigation | Rich fixture hypotheses/missing evidence | Thin live list fails merge gate | Active production remains fallback; actions disabled | FALLBACK | FAIL | Enrichment gate cannot pass normal list |
| timeline-event / Model Update | Generic event plus related object | Model-layer API | Can select update; before-summary partial | MIXED | PARTIAL | MM hydration |
| timeline-event / Decision | Generic event | Semantic/action layer | Related source conditional; no event-specific panel | MIXED | PARTIAL | Source-object adapter |
| timeline-event / Report | Generic event | Activity rows; no report object | Overlay fallback | MIXED | PARTIAL | Live report object absent |
| timeline-event / Capture | Generic event | Activity API | Related object mapping conditional | MIXED | PARTIAL | Source-object hydration |
| timeline-event / Receipt resurfaced | Generic event | Activity/semantic projection | Receipt depth not guaranteed | MIXED | PARTIAL | Depth gate |
| timeline-event / Active Question updated | Generic event | Semantic active questions | Related question conditional | MIXED | PARTIAL | Inspector ID mapping |
| timeline-event / Fieldwork created | Generic event | Semantic watch-for | Fieldwork detail partial | MIXED | PARTIAL | Result/check-in write |
| timeline-event / Import | Generic event | Activity/import source | Report/import detail fallback | MIXED | PARTIAL | Source/report hydration |
| timeline-event / Decision reviewed | Generic event | Semantic action update | Linked claim only when present | MIXED | PARTIAL | Source-object adapter |
| timeline-event / Map update | Generic event | Model/user-map layers | Related conclusion conditional | MIXED | PARTIAL | Selection hydration |
| timeline-event / Receipt researched | Generic event | Activity layer | Receipt graph conditional | MIXED | PARTIAL | Depth gate |
| pattern_claim (production inspector type) | Reference claim appears as map-object | Live Inspector endpoint/panel exists | Production panel is outside active mounted tree | LIVE source, runtime UNPROVEN | UNPROVEN | Global inspector not mounted |
| contradiction_node (production inspector type) | Reference conflict appears as map-object | Live Inspector endpoint/panel exists | Production panel is outside active mounted tree | LIVE source, runtime UNPROVEN | UNPROVEN | Global inspector not mounted |

## Cross-cutting action status

| Action | Active behavior | Production status |
|---|---|---|
| Related/context row | `select(id)` in active EC | Executes when graph resolves |
| Correct the model | Writes React state only | MOCK; no durable correction |
| Ask in Explore | `setPage("explore")` only | Executes navigation; no object context transfer |
| Save fieldwork check-in | Local component state | MOCK |
| Add decision outcome | Local state in v0 page | MIXED/MOCK; PATCH API unwired |
| Open report | Sets `reportId`; overlay reads zip | FALLBACK |
| Open Model Movement report | Same | FALLBACK |
| Explore movement review | Live conversation shows honest empty state | Real review/movement bridge unwired |

## Global blockers

1. The production Inspector stack is not mounted in the active workbench.
2. Zip fallback can make missing live objects look complete.
3. Live receipt depth is proven for one deterministic fixture, not globally.
4. Production model updates usually lack before/after data.
5. Reports have no production object emitter consumed by the overlay.
6. Corrections, outcomes and check-ins shown in the reference are not durable from the active UI.
7. `Ask in Explore` does not carry selected-object context.
8. Several top-level Orvek types are not accepted by the production inspector selection contract.
