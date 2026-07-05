# 02 Decisions Hybrid Overlay Merge

## Implemented

- Extended `lib/orvek-v0/production/hybrid-workbench-api.ts`:
  - added `mergeDecisionsOverlay()` for `decisionListGroups`, `decisionsSelectedId`, `decisionsHeaderStats`, `decisionsIsLoading`, `getObject`/`getObjects`, and Decisions empty copy
  - `buildHybridWorkbenchDataApi()` accepts optional fifth `decisionsApi` argument
  - merge runs only when `shouldMergeDecisionsProductionApi()` passes
  - normalized overlay applied via `normalizeDecisionsProductionDataApi()` on merge
  - no global `displayContract` set on hybrid API

## Preserved expectations

- Root Decisions fetch **not implemented** (`useOrvekHybridWorkbenchDataApi` unchanged).
- Production Decisions **not visible** in root workbench (hook does not pass `decisionsApi` yet).
- `DecisionsPage` unchanged.
- Today hybrid merge unchanged.
- Map hybrid merge unchanged.
- Timeline hybrid merge unchanged.
- `createMockOrvekDataApi` remains baseline for unwired surfaces.
- Old production shell remains quarantined.

## Verification

Commands run:

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run` (hybrid + decisions presentation + Today/Map/Timeline parity suite) — PASS

## Status

- Hybrid Decisions overlay merge added.
- Readiness gate controls merge.
- Unsafe Decisions production data falls back to reference/mock Decisions.
- **Not production-ready yet.**

## Product-owner visual check

**Not required for this slice** — root Decisions runtime unchanged; hook does not fetch or pass Decisions overlay yet.

## Next slice

1. Bounded Decisions fetch in `useOrvekHybridWorkbenchDataApi` (`fetchActionsPageData`, unified list, no bucket tabs at root).
2. Inspector/receipt target resolution on `DecisionsPage` if needed (`resolveDecisionsOpenSelectionId`).
3. Product-owner visual check on root Decisions before commit.
