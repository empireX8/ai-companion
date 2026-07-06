# 02 Bounded Active Questions Fetch Hook

## Slice summary

Bounded `GET /api/active-questions` fetch in the root hybrid hook. Builds `activeQuestionsApi` and passes it as the seventh argument to `buildHybridWorkbenchDataApi`. Readiness gate still controls merge. Questions tab unchanged.

## What was added

### `lib/active-questions.ts`

- `fetchActiveQuestionItems()` — bounded fetch against `ACTIVE_QUESTIONS_ENDPOINT` (`/api/active-questions`), returns `[]` on failure

### `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`

- `activeQuestionItems` + `isLoadingActiveQuestions` state with mount effect calling `fetchActiveQuestionItems()`
- `activeQuestionsApi` built via `buildActiveQuestionsProductionDataApi(activeQuestionItems)` with `activeQuestionsIsLoading: isLoadingActiveQuestions`
- Passed as seventh argument: `buildHybridWorkbenchDataApi(baseApi, todayApi, mapApi, timelineApi, decisionsApi, experimentApi, activeQuestionsApi)`
- Merge still gated by `shouldMergeActiveQuestionsProductionApi()` inside hybrid builder

### `lib/__tests__/active-questions-hybrid-fetch.test.ts`

Covers hook wiring, seventh-argument pass-through, ready merge, unsafe/thin/empty/loading fallback, linked aliases, Questions tab unchanged, Experiment/Fieldwork parity, Investigations/chat untouched, shell quarantine.

### `lib/__tests__/hybrid-workbench-api.test.ts` / `active-questions-presentation-readiness.test.ts` / `experiment-hybrid-fetch.test.ts`

Updated hook wiring assertions (fetch now wired; 7-arg hybrid call).

## Explicit non-goals (this slice)

- `Questions` tab **not changed** — still reference `aq-*` lists via `isProductionDisplay`; does not read `exploreQuestionSelectedId`
- Production Active Questions **not user-visible** — hybrid API does not set global `displayContract`, so Questions tab stays on reference/mock
- Fieldwork Bridge **untouched**
- Investigations tab **untouched**
- Free Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**
- No `/active-questions` page navigation from workbench
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Experiment / Fieldwork Bridge | Unchanged |
| Active Questions (Explore tab) | Data fetched + gated merge in provider; UI still reference |
| Investigations / chat | Still reference/mock |

## Production readiness

**Not production-ready yet.** Active-questions data enters the hybrid provider behind the readiness gate, but Questions tab does not consume merged `exploreQuestionIds` yet.

## Product-owner visual check

**Not required for this slice** — Questions tab rendering unchanged; no visible production Active Questions switch.

**Required at implementation** when Slice D (Questions tab alignment) lands.

## Recommended next slice

**Slice D — minimal `Questions` tab alignment**

- Consume `exploreQuestionIds` / `exploreQuestionSelectedId` when readiness gate passes (Fieldwork precedent: merged id array presence, not `isProductionDisplay`)
- Wire inspector selection via `resolveActiveQuestionsOpenSelectionId()`
- Keep Investigations and chat on reference/mock
