# 00 Investigations Public List Contract

## Slice summary

Bounded public list contract for Explore Investigations: `GET /api/explore/investigations` + `fetchExploreInvestigationItems()` in `lib/investigations.ts`. Overlap with Active Questions enforced at query level. No presentation gate, hybrid merge, hook fetch, or tab changes.

## What was added

### `lib/investigation-public-visibility.ts`

- `EXPLORE_INVESTIGATION_VISIBLE_STATUSES` — complementary statuses (`resolved`, `abandoned`) derived by excluding Active Questions statuses
- `buildPublicExploreInvestigationWhere()` — `user_visible` + lifecycle allowlist + `status: { notIn: ACTIVE_QUESTION_VISIBLE_STATUSES }`

### `lib/investigations.ts`

- `ExploreInvestigationItem` safe transport type
- `EXPLORE_INVESTIGATIONS_ENDPOINT` (`/api/explore/investigations`)
- `toExploreInvestigationItem()`, `dedupeExploreInvestigationItems()`
- `normalizeExploreInvestigationItemsPayload()` — transport-only shape tolerance
- `fetchExploreInvestigationItems()` — returns `[]` on failure

### `app/api/explore/investigations/route.ts`

- Authenticated list route returning `{ items: [...] }`
- Prisma `select` limited to safe scalar fields (no JSON blobs)
- Row mapper + dedupe; fail-closed visibility/lifecycle/overlap guards

### `lib/__tests__/explore-investigations-route.test.ts`

Route contract, overlap exclusion, JSON leak guards, dedupe, fetch helper transport, parity/quarantine source checks.

### `lib/__tests__/investigation-public-visibility.test.ts`

Explore Investigations where-clause coverage.

## Overlap policy

| Surface | Owns |
|---------|------|
| Active Questions (`/api/active-questions`) | `open`, `gathering_evidence`, `testing`, `resolving`, `reopened` under public visibility/lifecycle guard |
| Explore Investigations (`/api/explore/investigations`) | Complementary statuses only (`resolved`, `abandoned`) under same visibility/lifecycle guard |

Raw `GET /api/investigations` is **not** used for the Explore tab bridge.

## Explicit non-goals (this slice)

- Presentation readiness gate **not implemented**
- Hybrid merge **not implemented**
- Root hook fetch **not implemented**
- Investigations tab **unchanged** (still reference `inv-*` + `isProductionDisplay`)
- Active Questions, Fieldwork Bridge, Explore chat **untouched**
- Today, Map, Timeline, Decisions, Experiment bridges **unchanged**
- `/api/active-questions` and `/api/investigations` engine routes **unchanged**

## Parity preserved

| Surface | Status |
|---------|--------|
| Active Questions | Unchanged |
| Fieldwork Bridge | Unchanged |
| Explore chat | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |

## Production readiness

**Not production-ready yet.** Safe list contract exists; presentation gate, hybrid overlay, hook wiring, and tab alignment remain.

## Product-owner visual check

**Not required for this slice** — no UI or provider behavior changed.

**Required** when Investigations tab alignment lands.

## Recommended next slice

**Slice B — Investigations presentation readiness gate**

- `investigations-presentation.ts` — normalize text, map future detail fields, `shouldMergeInvestigationsProductionApi()`
- `buildInvestigationsProductionDataApi()` — register `type: "investigation"` objects (no hybrid/tab yet)
- Tests mirroring `active-questions-presentation-readiness.test.ts`
