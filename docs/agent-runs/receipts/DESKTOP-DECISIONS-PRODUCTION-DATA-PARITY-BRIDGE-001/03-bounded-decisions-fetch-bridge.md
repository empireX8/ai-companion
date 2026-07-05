# 03 Bounded Decisions Fetch Bridge

## Implemented

- Extended `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`:
  - fetches `fetchActionsPageData()` on mount
  - flattens `stabilizeNow` + `buildForward` into a unified list (no bucket tabs at root)
  - builds `buildDecisionsProductionDataApi(decisionsList)` with `decisionsIsLoading` while fetch is in flight
  - passes `decisionsApi` as fifth argument to `buildHybridWorkbenchDataApi()`
  - readiness-gated merge via existing `shouldMergeDecisionsProductionApi()` / `normalizeDecisionsProductionDataApi()`

- Minimal `components/orvek-v0/pages/decisions.tsx` updates:
  - receipt/context chip clicks use `resolveDecisionsOpenSelectionId()` for safe inspector targets
  - sidebar `openDecision()` preserves `select(id)` for reference + production row ids
  - header stats use `decisionsHeaderStats` when merged production groups are present (without `displayContract`)

## Behavior

- Production Decisions displays in root **only** when readiness gate passes after fetch.
- Unsafe, thin, empty, loading, or failing production data falls back to reference/mock (`LISTS` + zip objects).
- No global `displayContract` on hybrid API.
- No `/actions` bucket-tab layout or route-first navigation.

## Preserved expectations

- Today hybrid merge unchanged.
- Map hybrid merge unchanged.
- Timeline hybrid merge unchanged.
- `createMockOrvekDataApi` remains baseline for unwired surfaces.
- Old production shell remains quarantined.
- `V0DecisionsView` / `/actions` route not used at root.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- Vitest parity suite + `decisions-hybrid-fetch.test.ts` — PASS

## Status

- Bounded root Decisions fetch bridge implemented.
- **Not production-ready yet** — product-owner visual check required before commit.

## Product-owner visual check

**Required before commit.**

Checklist:

- [ ] Root Decisions keeps reference layout (entry module, 260px list + workspace, no stabilize/build tabs)
- [ ] With live data passing gate: sidebar groups populate; workspace shows honest fields only
- [ ] With empty/failed/loading fetch: reference mock Decisions (`d1` richness) appears
- [ ] Receipt chips open Inspector on linked claims when available
- [ ] No navigation to `/actions` from root interactions
- [ ] Today + Map + Timeline unchanged
- [ ] No old production shell chrome

## Known risks

- Production action rows are thinner than reference zip decisions (no options grid / decisionContext / projection) — workspace panels may be sparse when live data merges.
- Sparse accounts with few actions may fail readiness and correctly fall back to reference mock.
- Header stats now reflect live counts when merged; reference hardcoded counts only show on pure mock fallback.

## Next step

Product-owner visual check on root Decisions with live and empty accounts, then commit if clean.
