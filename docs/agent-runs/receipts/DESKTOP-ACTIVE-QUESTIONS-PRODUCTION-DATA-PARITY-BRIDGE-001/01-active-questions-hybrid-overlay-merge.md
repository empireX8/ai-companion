# 01 Active Questions Hybrid Overlay Merge

## Slice summary

Hybrid overlay merge only for Active Questions production data. Readiness gate controls merge; no root fetch, no Questions tab changes.

## What was added

### `lib/orvek-v0/production/hybrid-workbench-api.ts`

- `mergeActiveQuestionsOverlay()` merges Explore Active Questions fields only when `shouldMergeActiveQuestionsProductionApi()` passes:
  - `exploreQuestionIds`
  - `exploreQuestionSelectedId`
  - `activeQuestionsIsLoading`
  - `getObject` / `getObjects` aliases for active-question and linked receipts
  - `emptyCopyBySlot.exploreQuestionsEmptyList`
- `buildHybridWorkbenchDataApi()` extended with seventh argument `activeQuestionsApi?: OrvekDataApi`
- Uses `normalizeActiveQuestionsProductionDataApi()` before merge (strips `displayContract`, dedupes rows)
- Does **not** merge Investigations, Fieldwork Bridge, Explore chat, or global `displayContract`

### `lib/__tests__/hybrid-workbench-api.test.ts`

Added coverage for ready merge, unsafe/thin fallback, no `displayContract` leak, dedupe, linked aliases, wrong-slot no merge, Investigations/chat untouched, Today/Map/Timeline/Decisions/Experiment parity, hook not wired.

## Explicit non-goals (this slice)

- Root Active Questions fetch **not implemented**
- `Questions` tab rendering **unchanged**
- Fieldwork Bridge **untouched**
- Investigations tab **untouched**
- Free Explore chat **untouched**
- Today, Map, Timeline, Decisions bridges **unchanged**
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
| Active Questions (Explore tab) | Merge path exists; not user-visible until hook fetch + tab alignment |
| Investigations / chat | Still reference/mock |

## Production readiness

**Not production-ready yet.** Hybrid merge exists but root hook does not fetch active-questions data and Questions tab does not consume merged lists yet.

## Product-owner visual check

**Not required for this slice** (no user-visible runtime change until bounded fetch lands).

**Required at implementation** when Slice C (bounded fetch) + Slice D (Questions tab alignment) land.

## Recommended next slice

**Slice C — bounded `GET /api/active-questions` fetch in `useOrvekHybridWorkbenchDataApi`**

- Fetch active-questions items in root hybrid hook
- Pass `buildActiveQuestionsProductionDataApi(items)` as seventh argument to `buildHybridWorkbenchDataApi()`
- Keep Investigations and chat on reference/mock

Then **Slice D — minimal `Questions` tab alignment** to consume merged `exploreQuestionIds` when gate passes.
