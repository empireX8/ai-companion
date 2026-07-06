# 03 Bounded Investigations Fetch Hook

## Slice summary

Bounded `GET /api/explore/investigations` fetch in the root hybrid hook. Builds `investigationsApi` and passes it as the **8th argument** to `buildHybridWorkbenchDataApi`. Readiness gate still controls merge. Investigations tab unchanged.

## What was added

### `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`

- `exploreInvestigationItems` + `isLoadingInvestigations` state with mount effect calling `fetchExploreInvestigationItems()`
- `investigationsApi` built via `buildInvestigationsProductionDataApi(exploreInvestigationItems)` with `investigationsIsLoading: isLoadingInvestigations`
- Passed as eighth argument: `buildHybridWorkbenchDataApi(..., activeQuestionsApi, investigationsApi)`
- Merge still gated by `shouldMergeInvestigationsProductionApi()` inside hybrid builder

### `lib/__tests__/investigations-hybrid-fetch.test.ts`

Covers hook wiring, eighth-argument pass-through, ready merge (with enrichments), unsafe/thin/empty/loading fallback, Active Questions status rejection, fetch failure, malformed payload, tab unchanged, parity, shell quarantine.

### Test updates

- `hybrid-workbench-api.test.ts`, `investigations-presentation-readiness.test.ts`, `explore-investigations-route.test.ts`
- `active-questions-hybrid-fetch.test.ts`, `experiment-hybrid-fetch.test.ts` — 8-arg hybrid call regex

## Bridge source policy

| Source | Status |
|--------|--------|
| `fetchExploreInvestigationItems()` → `/api/explore/investigations` | **Used** |
| Raw `/api/investigations` | **Not used** |

## Explicit non-goals (this slice)

- Investigations tab **not changed** — still reference `inv-*` + `isProductionDisplay`; does not read `exploreInvestigationSelectedId`
- Production Investigations **not user-visible** — readiness gate requires enriched thread detail; list-only rows fail merge; tab does not consume `exploreInvestigationIds`
- Active Questions, Fieldwork Bridge, Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**

## Parity preserved

| Surface | Status |
|---------|--------|
| Active Questions | Unchanged |
| Fieldwork Bridge | Unchanged |
| Explore chat | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |

## Production readiness

**Not production-ready yet.** Data enters hybrid provider behind gate, but list-only rows fail readiness and tab does not consume merged ids.

## Product-owner visual check

**Not required for this slice** — Investigations tab rendering unchanged; no visible production Investigations switch.

**Required** when Slice E (Investigations tab alignment) lands.

## Recommended next slice

**Slice E — minimal Investigations tab alignment**

- Consume `exploreInvestigationIds` / `exploreInvestigationSelectedId` when readiness gate passes (`hasLiveInvestigations` pattern)
- Wire inspector selection via `resolveInvestigationsOpenSelectionId()`
- Keep reference `inv-*` fallback when gate fails
- Note: enriched hypotheses/missingEvidence may still require a future detail-enrichment slice for live thread cards to match reference richness
