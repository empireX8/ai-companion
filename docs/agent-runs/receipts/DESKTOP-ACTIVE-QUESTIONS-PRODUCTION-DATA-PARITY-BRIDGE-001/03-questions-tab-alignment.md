# 03 Questions Tab Alignment

## Slice summary

Minimal Active Questions tab alignment in `components/orvek-v0/pages/explore.tsx`. The Questions tab consumes readiness-gated `exploreQuestionIds` and `exploreQuestionSelectedId` from the hybrid provider, with reference `aq-*` fallback when production data is absent, loading, or fails the presentation gate.

## What changed

### `components/orvek-v0/pages/explore.tsx` — `Questions()` only

- `hasLiveQuestions` when merged `exploreQuestionIds` has length (FieldworkBridge precedent; not `isProductionDisplay`)
- Syncs selection from `exploreQuestionSelectedId` when live data is present
- `resolveActiveQuestionsOpenSelectionId()` for list clicks, related-object chips, and “See evidence” inspector opens
- Reference fallback: hardcoded `aq-1`…`aq-4`, supporting/conflicting copy, and mock receipt counts when gate fails
- Deferred action buttons disabled when live production questions are shown

### `lib/__tests__/active-questions-tab-alignment.test.ts`

New coverage for tab wiring, hybrid provider path, readiness fallback, inspector selection, parity preservation, and quarantine.

### Test updates

- `active-questions-hybrid-fetch.test.ts` — Questions tab now consumes gated ids
- `fieldwork-bridge-alignment.test.ts` — Active Questions fallback + `hasLiveQuestions` assertion

## Explicit non-goals (this slice)

- Fieldwork Bridge **untouched**
- Investigations tab **untouched**
- Free Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**
- No `/active-questions` route navigation
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Readiness behavior

| Condition | Questions tab behavior |
|-----------|------------------------|
| Ready production merge (`exploreQuestionIds.length > 0`) | Live question list + provider objects |
| Loading (`activeQuestionsIsLoading`) | Reference `aq-*` mock (hybrid gate withholds ids) |
| Empty / unsafe / thin production | Reference `aq-*` mock |
| Fetch failure | Reference `aq-*` mock |

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Experiment / Fieldwork Bridge | Unchanged |
| Investigations / chat | Still reference/mock |

## Production readiness

**Not production-ready yet.** Tab can show live questions when fetch + gate pass, but supporting/conflicting resolution fields and deferred actions remain partial; product-owner visual check required before commit.

## Product-owner visual check

**Required before commit.**

Verify in desktop Explore → Active Questions:

1. With no production data (or gate fail): reference `aq-*` layout unchanged
2. With ready production data: live titles/status render; list/detail layout matches reference
3. Question click opens Inspector on correct object (including linked inspector targets)
4. Fieldwork Bridge, Investigations, Free Explore unchanged
5. No navigation to `/active-questions`

## Recommended next slice

**Slice E — Active Questions empty/deferred copy + evidence affordances**

- Wire production empty-copy slots when live list is empty after merge
- Evidence panel lookup for live active-question inspector targets
- Revisit deferred “Explore this / Propose fieldwork / Mark resolved” when contracts exist
