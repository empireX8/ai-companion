# 00 Active Questions Presentation Readiness Gate

## Slice summary

Safety infrastructure for a future root Explore Active Questions production parity bridge. Normalization and readiness gating only — no root fetch, no hybrid merge wiring, no Questions tab changes.

## What was added

### `lib/orvek-v0/production/active-questions-presentation.ts`

- Title / organizing-question normalization with length caps and raw-text rejection
- Investigation status → reference display mapping (`open`, `active`, `resolving`, `reopened`)
- Reference tag mapping (`Active Question`, status chip)
- Optional-field honesty: `whyItMatters`, `supporting`, `conflicting` only when meaningful
- Linked object alias builder for inspector-selectable targets
- `isActiveQuestionsPresentationReady()` stream gate
- `shouldMergeActiveQuestionsProductionApi()` gate (normalizes before checking)
- `normalizeActiveQuestionsProductionDataApi()` strips `displayContract` and quarantined `explore` view props
- Duplicate active-question row dedupe
- `resolveActiveQuestionsOpenSelectionId()` for future inspector companion
- `activeQuestionItemToActiveQuestionObject()` projection helper

### `lib/orvek-v0/production/active-questions-api.ts`

- `buildActiveQuestionsProductionDataApi()` maps `ActiveQuestionItem[]` → active-question `OrvekObject` graph + `exploreQuestionIds`
- Registers optional linked object aliases when selectable
- Does **not** set `exploreInvestigationIds` or fieldwork ids

### `lib/orvek-v0/data-provider.tsx`

- Added optional `exploreQuestionSelectedId`, `activeQuestionsIsLoading`

### `lib/__tests__/active-questions-presentation-readiness.test.ts`

Covers normalization, readiness pass/fail, displayContract leak, alias registration, dedupe, hybrid reference fallback, Fieldwork parity, no root fetch wiring, Investigations/chat untouched, shell quarantine.

## Explicit non-goals (this slice)

- Root Active Questions fetch **not implemented**
- Production Active Questions **not visible** in root workbench yet
- No `mergeActiveQuestionsOverlay()` in `hybrid-workbench-api.ts`
- `Questions` tab rendering **unchanged**
- Fieldwork Bridge **untouched**
- Investigations tab **untouched**
- Free Explore chat **untouched**
- No changes to Today, Map, Timeline, or Decisions bridges
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Fieldwork Bridge | Unchanged (still bridged) |
| Active Questions (Explore tab) | Still reference `aq-*` lists |
| Investigations / chat | Still reference/mock |

## Production readiness

**Not production-ready yet.** Gate and normalization exist; hybrid merge + bounded fetch + Questions tab alignment are required before root Active Questions can show live data.

## Product-owner visual check

**Not required for this slice** (no user-visible runtime change).

**Required at implementation** when hybrid merge + bounded fetch + Questions tab alignment land.

## Recommended next slice

**Slice B — hybrid overlay merge only (no hook fetch)**

- Add `mergeActiveQuestionsOverlay()` to `hybrid-workbench-api.ts`
- Wire seventh argument or named overlay slot behind `shouldMergeActiveQuestionsProductionApi()`
- Tests: hybrid merge preserves reference Questions when gate fails; Fieldwork/Investigations/chat untouched

Then **Slice C — bounded `GET /api/active-questions` fetch in `useOrvekHybridWorkbenchDataApi`**.

Then **Slice D — minimal `Questions` tab alignment** to consume merged `exploreQuestionIds` when gate passes.
