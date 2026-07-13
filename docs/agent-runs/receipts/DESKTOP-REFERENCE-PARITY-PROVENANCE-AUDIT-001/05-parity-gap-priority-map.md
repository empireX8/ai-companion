# Parity Gap Priority Map

Scoring: 1 (low) to 5 (high). `Autonomy` is suitability for aggressive autonomous implementation; a low score means a product/architecture decision is required first.

| Rank | Gap | Class | Visible impact | Surfaces unlocked | Centrality | Risk | Reference certainty | Autonomy | Recommendation |
|---:|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Active Inspector is generic/reference while production Inspector is outside mounted tree | A_ADAPTER / B_HYDRATION | 5 | 5 | 5 | 5 | 5 | 2 | Architect first; then isolated integration experiment |
| 2 | Silent zip fallback masks missing live objects | A_ADAPTER | 5 | 5 | 5 | 4 | 5 | 3 | Add provenance observability/gates before broad swaps |
| 3 | No broad evidence/context graph closure | B_HYDRATION | 5 | 5 | 5 | 4 | 5 | 4 | Extend existing depth contracts without fabricated links |
| 4 | Live movement lacks before/after and affected-object depth | B_HYDRATION | 5 | 4 | 5 | 4 | 5 | 3 | Define stored/read contract; reuse existing data only |
| 5 | Reports are fixture objects and overlay bypasses provider | B_HYDRATION / C_WRITE_PATH | 4 | 4 | 4 | 4 | 5 | 3 | Provider-aware overlay after live report contract |
| 6 | Corrections are in-memory | C_WRITE_PATH / G_MISSING_UX_CAPABILITY | 4 | 5 | 5 | 5 | 4 | 1 | Product decision required; do not add ad hoc endpoints |
| 7 | Explore session movement/review bridge unwired | A_ADAPTER / D_INTERACTION | 4 | 2 | 3 | 3 | 5 | 5 | Strong autonomous candidate after contract check |
| 8 | Live Explore grounding is empty; Ask in Explore carries no context | E_AI_CONTRACT / D_INTERACTION | 5 | 3 | 4 | 5 | 4 | 1 | Define evidence-backed grounding contract first |
| 9 | Investigation rows cannot pass richness gate | B_HYDRATION | 4 | 2 | 3 | 3 | 5 | 4 | Enrich from real data or retain honest fallback |
| 10 | Decision outcome/update API is not called by active UI | C_WRITE_PATH / D_INTERACTION | 4 | 2 | 3 | 3 | 5 | 5 | Good bounded implementation lane |
| 11 | Fieldwork check-in/result is local state | C_WRITE_PATH / G_MISSING_UX_CAPABILITY | 4 | 3 | 3 | 5 | 4 | 2 | Define result-to-evidence semantics first |
| 12 | Map selection does not refetch detail on root changes | B_HYDRATION / D_INTERACTION | 3 | 2 | 3 | 3 | 5 | 5 | Good bounded implementation lane |
| 13 | Timeline filter labels and execution disagree | D_INTERACTION | 3 | 1 | 2 | 2 | 5 | 5 | Safe autonomous fix with behavior tests |
| 14 | Reference route is data-isolated but visually mutable | H_REFERENCE_AMBIGUITY / I_DEFERRED_HARDENING | 3 | 5 | 4 | 3 | 5 | 4 | Pin reference mode and visual checks |
| 15 | Secondary Explore question/investigation actions disabled | D_INTERACTION / C_WRITE_PATH | 3 | 2 | 2 | 4 | 4 | 2 | Implement only after write contracts |
| 16 | Surface visual differences | F_VISUAL | 2 | 1 | 1 | 2 | 5 | 5 | Last, after provenance/interaction parity |

## Highest-value autonomous packages

These can be bounded without inventing product intelligence:

1. Wire the Explore session ID and post-send refresh into existing review/movement reads, preserving honest empty states.
2. Wire Decisions outcome/update controls to the existing API with explicit loading/error states and no new schema.
3. Repair Timeline filter label/logic mismatch.
4. Make Map selection trigger existing detail/evidence fetches.
5. Add provenance-focused tests and developer diagnostics for fallback use.
6. Pin reference-mode behavior and visual regression checks.

## Work requiring Kay/architect decisions

1. Which Inspector stack becomes canonical.
2. Whether and how fallback remains visible in production.
3. Durable correction semantics.
4. How fieldwork results become evidence and movement.
5. Evidence-backed Explore grounding and Ask in Explore payload.
6. Report generation, storage and versioning.

## Work that should not be built yet

- New tables/columns for parity without a specific approved contract.
- Per-surface correction implementations.
- Static “live-looking” movement, grounding, report or investigation richness.
- A global production-display flip.
- Broad UI rewrites or visual polish that preserve fallback provenance.
- One branch per field; use capability-level slices with clear ownership.
