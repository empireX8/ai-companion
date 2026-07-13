# Shared Capability and Dependency Map

## Architectural finding

The active desktop is not a collection of independent surface gaps. It is one hybrid runtime with shared blockers:

```text
authenticated APIs / DB
  -> production adapters
  -> per-surface readiness gates
  -> hybrid API over mock base
  -> shared v0 pages
  -> active generic EvidencePanel
  -> zip fallback / zip report overlay
```

Reference parity therefore depends first on fixing shared graph, selection, Inspector and write contracts. Parallel surface styling cannot bypass those dependencies.

## Shared foundations

| Foundation | Consumers | Current state | Hard dependency unlocked |
|---|---|---|---|
| Provider graph with explicit provenance | All surfaces, Inspector, reports | Provider-first plus silent zip fallback | Truthful LIVE vs FALLBACK rendering |
| Selected-object routing | Map, Decisions, Timeline, Explore, Today | Workbench store works; production bridge outside active tree | Production Inspector hydration |
| Evidence/context graph closure | Today pointers, Map, Explore grounding | One deterministic pointer proven; broad graph thin | Related/context navigation |
| Before/after movement record | Today, Timeline, Inspector, reports | Reference fixtures rich; live adapters often summary-only | “See why”, delta log, movement reports |
| Durable correction contract | Inspector across types | In-memory only | Correction UX and auditability |
| Durable outcome/check-in writes | Decisions, fieldwork, Today | APIs partly exist; active UI local/deferred | Recorded action parity |
| Live report object contract | Today, Decisions, Timeline, Inspector | No consumed production report object | Report overlay parity |
| Explore session bridge | Free Explore, movement/review strips | Session/messages real; bridge not set | Real conversation movement/review |
| Grounding/AI contract | Explore and Ask in Explore | Live grounding intentionally empty | Evidence-backed claims and handoffs |
| Reference quarantine | All visual comparisons | Mock-only data, shared mutable UI tree | Stable acceptance baseline |

## Hard dependency order

1. **Provenance-aware provider graph**
   - The active app must distinguish a missing live object from a deliberate reference fallback.
   - Without this, visual completeness masks gaps and invalidates parity metrics.
2. **Active Inspector integration**
   - Choose and mount one Inspector path.
   - Preserve all reference object types or add truthful unsupported states.
3. **Graph hydration contracts**
   - Evidence source, why-it-matters, context, related objects and nested resolution.
4. **Movement and report data contracts**
   - Stored before/after, affected object, cited evidence and report identity.
5. **Durable interactions**
   - Corrections, outcomes, fieldwork results/check-ins and context-carrying Ask in Explore.
6. **Surface-level adapters and visual deltas**
   - Only after shared contracts can each surface safely replace fallback presentation.

## Independent work packages after contracts are frozen

| Lane | Scope | Depends on | Can run with |
|---|---|---|---|
| A — Inspector shell/selection | Mount active production hydration without losing Orvek type coverage | Provider provenance decision | Reference quarantine |
| B — Evidence graph hydration | Extend real pointer/source graph and closure checks | Stable object contract | Movement storage |
| C — Movement/report | Before/after records, live report object and overlay provider lookup | Stable object IDs | Explore bridge |
| D — Decisions writes | Wire existing PATCH/outcome paths; truthful disabled states | Correction/outcome contract | Timeline filters |
| E — Explore bridge | Session ID, post-send refresh, review/movement strips | AI output contract | Decisions writes |
| F — Investigation enrichment | Hypotheses, missing evidence, linked objects | Investigation contract | Fieldwork bridge |
| G — Timeline filters/adapters | Correct filter labels and source-object mapping | Stable selection contract | Decisions writes |
| H — Reference integrity | Pin fixture/reference mode and visual baseline | None | All lanes |

## Work that is not truly parallel yet

| Proposed work | Why it must wait |
|---|---|
| Today hero/delta/report live swap | Needs movement, report and Inspector graph contracts |
| Map full live presentation | Needs active Inspector selection-aware detail hydration |
| Ask in Explore on every type | Needs context payload and grounding contract |
| Persistent correction buttons | Needs one shared correction lifecycle, not per-surface endpoints |
| Production report overlay | Needs report object/storage/provenance contract |
| Broad visual polish | Would optimize fallback presentation before provenance is resolved |

## Collision risks

1. `components/orvek-v0/evidence-panel.tsx`, `store.tsx`, `workbench.tsx` and `data-provider.tsx` are shared hotspots.
2. `useOrvekHybridWorkbenchDataApi.ts` is a merge hotspot for every surface lane.
3. `OrvekObject` field changes affect all adapters, fixtures and parity gates.
4. Mounting `ProductionInspectorBridge` can expose unsupported types and change selection tab defaults.
5. Replacing zip report lookup can break all reference report entry points at once.
6. Reference UI shares the same component tree; presentation edits mutate the target unless reference mode is pinned.

## True parallelism plan

After an architect freezes shared contracts:

- **Lane 1:** Inspector shell/selection integration in an isolated worktree.
- **Lane 2:** Evidence graph closure and depth-safe fixtures/services.
- **Lane 3:** Movement/report data model usage using existing storage only; no new persistence without explicit scope.
- **Lane 4:** Explore session bridge and honest review UI.
- **Lane 5:** Decisions write wiring plus Timeline filter repair.
- **Lane 6:** Reference quarantine and visual regression harness.

Each lane should own disjoint files where possible and merge behind contract tests. Surface-specific Map/Today/Explore presentation work should follow, not lead.

## Likely critical path

```text
provenance decision
 -> active Inspector architecture
 -> graph closure + movement/report contracts
 -> durable shared actions
 -> surface swaps
 -> visual parity pass
```

The critical path is not Map, Today or Explore individually. It is the shared Inspector and evidence/movement object graph.
