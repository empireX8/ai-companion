# 04 Investigations Tab Alignment

## Slice summary

Minimal Explore → Investigations tab alignment. Tab consumes `exploreInvestigationIds` and `exploreInvestigationSelectedId` when readiness-gated production data passes; otherwise stays on reference `inv-*` mock data.

## What changed

### `components/orvek-v0/pages/explore.tsx` — `Investigations()` only

- `hasLiveInvestigations = (exploreInvestigationIds?.length ?? 0) > 0` — **not** `isProductionDisplay`
- Reference fallback: `referenceInvestigationIds = ["inv-1", "inv-2", "inv-3"]`
- Selection sync via `exploreInvestigationSelectedId` + `useEffect`
- Inspector opens via `resolveInvestigationsOpenSelectionId()` for row and linked-object clicks
- Deferred action buttons disabled when live data is active
- List subtitle uses tags for live rows; evidence count for reference rows

### `lib/__tests__/investigations-tab-alignment.test.ts`

Covers live consumption, readiness fallback, thin/unsafe/empty/loading rejection, Active Questions overlap, inspector resolution, parity, shell quarantine, no `/investigations` navigation.

### Test updates

- `investigations-hybrid-fetch.test.ts`, `investigations-presentation-readiness.test.ts`, `explore-investigations-route.test.ts`, `hybrid-workbench-api.test.ts`, `active-questions-tab-alignment.test.ts`

## Bridge policy

| Rule | Status |
|------|--------|
| Production only when readiness gate passes | **Yes** |
| Unsafe/thin/failing → reference `inv-*` fallback | **Yes** |
| Active Questions overlap (`open`, `gathering_evidence`, etc.) rejected | **Yes** |
| Raw `/api/investigations` | **Not used** |
| `/investigations` route navigation | **Not introduced** |

## Explicit non-goals (this slice)

- Active Questions, Fieldwork Bridge, Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**
- No detail-enrichment API slice (hypotheses/missingEvidence still require enrichments for gate pass)
- Tab does not fetch directly — consumes provider only

## Parity preserved

| Surface | Status |
|---------|--------|
| Active Questions | Unchanged |
| Fieldwork Bridge | Unchanged |
| Explore chat | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |

## Production readiness

**Not production-ready yet.**

- Readiness gate is conservative; list-only fetched rows fail without enrichments
- Live Investigations appear only when enriched production data passes gate end-to-end
- Detail richness may still lag reference cards until enrichment slice lands

## Product-owner visual check

**Required before commit.**

Verify in Explore → Investigations tab:

1. Reference `inv-*` threads render when gate fails (default hybrid path today)
2. No duplicate Active Questions rows appear in Investigations
3. Thread list, detail card, linked chips, and inspector opens match reference layout
4. When enriched live data passes gate, live rows replace reference without layout drift

## Recommended next slice

**Slice F — Investigations detail enrichment**

- Safe detail projection for hypotheses, missingEvidence, relatedIds from stored evidence
- Or server-side enrichment on `/api/explore/investigations` list response when phase allows
- Goal: live thread cards reach reference richness without bypassing readiness gate
