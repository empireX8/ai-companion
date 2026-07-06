# 01 Investigations Presentation Readiness Gate

## Slice summary

Investigations presentation normalization and readiness gate only. Maps safe `ExploreInvestigationItem` rows into reference-compatible `type: "investigation"` objects when enriched thread detail exists. No hybrid merge, hook fetch, or tab changes.

## What was added

### `lib/orvek-v0/production/investigations-presentation.ts`

- Text normalization, raw/JSON blob rejection, bullet normalization
- `exploreInvestigationItemToInvestigationObject()` — bridge-eligible rows only (`resolved` / `abandoned`; rejects Active Questions-owned statuses)
- `isInvestigationsRowPresentationReady()` — requires meaningful title, whyItMatters, **and** hypotheses or missingEvidence richness (list-only rows fail)
- `isInvestigationsPresentationReady()` / `shouldMergeInvestigationsProductionApi()`
- `normalizeInvestigationsProductionDataApi()` — strips `displayContract`, dedupes ids
- `resolveInvestigationsOpenSelectionId()`, linked object aliases

### `lib/orvek-v0/production/investigations-api.ts`

- `buildInvestigationsProductionDataApi(items, { enrichments, linkedAliases })`
- Sets `exploreInvestigationIds`, `exploreInvestigationSelectedId`, `investigationsIsLoading: false`
- Uses `withProductionContract` for builder tests; normalization strips contract before merge gate

### `lib/orvek-v0/data-provider.tsx`

- `exploreInvestigationSelectedId?: string | null`
- `investigationsIsLoading?: boolean`

### `lib/__tests__/investigations-presentation-readiness.test.ts`

Coverage for normalization, readiness pass/fail, overlap rejection, JSON leak rejection, thin list-only rejection, linked alias safety, parity/quarantine, no hybrid hook wiring.

## Bridge source policy

| Source | Status |
|--------|--------|
| `GET /api/explore/investigations` + `fetchExploreInvestigationItems()` | **Intended bridge source** |
| Raw `GET /api/investigations` | **Not used** |
| `/api/active-questions` | Active Questions only; overlap excluded at list + item eligibility layers |

## Overlap policy preserved

- `isInvestigationItemBridgeEligible()` rejects Active Questions-owned statuses (`open`, `gathering_evidence`, `testing`, `resolving`, `reopened`)
- Only complementary explore statuses (`resolved`, `abandoned`) may enter Investigations production builder

## Explicit non-goals (this slice)

- Hybrid `mergeInvestigationsOverlay` **not implemented**
- Root hook fetch **not implemented**
- Investigations tab **unchanged** (reference `inv-*` + `isProductionDisplay`)
- Active Questions, Fieldwork Bridge, Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**

## Production readiness

**Not production-ready yet.** Gate exists but no hybrid overlay or tab consumes merged data.

## Product-owner visual check

**Not required for this slice** — no UI or provider merge behavior changed.

**Required** when hybrid merge + tab alignment land.

## Recommended next slice

**Slice C — Investigations hybrid overlay merge**

- `mergeInvestigationsOverlay()` in `hybrid-workbench-api.ts` (8th argument after active questions)
- Gated by `shouldMergeInvestigationsProductionApi()` + `normalizeInvestigationsProductionDataApi()`
- No global `displayContract`; reference fallback when gate fails
- Tests in `hybrid-workbench-api.test.ts`
