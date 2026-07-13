# Two-Week Campaign Forecast

## Verdict

**Two-week full reference parity: NOT CREDIBLE YET.**

This is based on:

- **0 of 45** recorded states wholly LIVE;
- **0 of 35** Inspector type/subtype units at production-backed PASS;
- **15 of 45** recorded states explicitly FALLBACK;
- **3 of 45** recorded states using MOCK/local-only behavior;
- one narrow deterministic evidence-depth runtime path, not a normal end-user path;
- two failing targeted contract tests on the clean baseline;
- unresolved architecture decisions around the canonical Inspector, correction, reports, grounding and fieldwork results.

The visual target can remain nearly identical while these numbers do not improve.

## Forecast denominator

“Done” means each of the 45 recorded states has:

1. a known production provider;
2. no unlabelled fallback/mock fields;
3. reference-depth Inspector hydration;
4. executing or honestly deferred actions;
5. meaningful tests;
6. runtime evidence for authenticated paths.

## Scenarios

| Scenario | Conditions | Credible two-week outcome |
|---|---|---|
| Best case | Canonical Inspector chosen on day 1; no schema work; existing APIs sufficient; 5–6 isolated lanes; rapid runtime access; no merge collisions | **35–40 of 45** states reach LIVE or explicitly honest deferred parity; Inspector **20–26 of 35** PASS; remaining gaps are grounding/corrections/reports |
| Expected | Architecture decisions take 2–3 days; lanes collide in hybrid hook/Inspector; runtime fixtures needed; no new persistence allowed | **20–28 of 45** states materially improve; Inspector **10–16 of 35** PASS; visual parity remains, full parity incomplete |
| Worst case | Inspector integration exposes unsupported types; authenticated testing blocked; movement/report/correction require storage or product design | **10–15 of 45** states improve; core app remains MIXED; two weeks becomes another partial bridge cycle |

These are throughput ranges, not completion claims. A state counts only when its whole reference contract passes.

## What must be true for two weeks to work

1. Kay chooses the canonical Inspector and fallback policy immediately.
2. No new schema is needed for the accepted parity target, or schema work is explicitly approved and isolated.
3. Authenticated local runtime access is available to each integration lane.
4. Existing movement, report, correction and fieldwork data prove sufficient after code inspection.
5. Work is split by shared capability, not by individual visible field.
6. Each lane receives exact files, allowed changes, forbidden changes and tests.
7. The reference route is pinned so active work cannot move the target.
8. Daily integration validates provenance totals, not screenshot similarity.

## Parallel lanes

### Lane 1 — Inspector assault

Mount/bridge the canonical production Inspector path while retaining truthful handling for all 35 coverage units.

### Lane 2 — Evidence graph

Expand real receipt/context/related-object closure using existing stored relationships. Never invent graph edges.

### Lane 3 — Movement and reports

Hydrate before/after and provider-backed report objects if current storage supports them. Stop if persistence/design is missing.

### Lane 4 — Explore

Wire session bridge, post-send refresh and honest review/movement; separately define grounding and Ask in Explore contract.

### Lane 5 — Surface interactions

Decisions writes, Map selection-aware detail, Timeline filters and existing fieldwork reads.

### Lane 6 — Reference/runtime verification

Pin reference mode, maintain state inventory, run authenticated fixture checks and track provenance denominator.

## Critical blockers that make two weeks unrealistic

- Canonical Inspector decision deferred beyond day 1.
- Need for new correction/report/fieldwork-result persistence.
- No authenticated runtime access.
- Live movement lacks recoverable before/after data.
- Explore grounding requires new AI generation rather than adapting stored links.
- Report generation must be designed from scratch.
- Broad edits to `useOrvekHybridWorkbenchDataApi.ts`, `store.tsx` or Inspector files collide across lanes.
- Reference target continues mutating with shared components.
- Teams count fallback-backed rendering as completed parity.

## Recommended campaign objective

Use two weeks to establish **credible operational parity foundations**, not to claim complete desktop parity:

1. canonical Inspector active;
2. fallback provenance observable;
3. evidence graph and movement contracts proven across representative object families;
4. existing Decisions/Map/Timeline/Explore wiring gaps closed;
5. remaining product-design gaps measured explicitly.

Reforecast full parity after day 4 using updated 45-state and 35-coverage denominators.
