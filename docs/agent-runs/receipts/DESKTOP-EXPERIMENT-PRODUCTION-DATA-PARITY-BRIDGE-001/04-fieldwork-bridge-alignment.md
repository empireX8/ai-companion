# 04 Fieldwork Bridge Alignment

## Slice summary

Minimal `FieldworkBridge` alignment to consume readiness-gated `exploreFieldworkIds` / `exploreFieldworkSelectedId` from the hybrid provider while preserving reference layout and fallback behavior.

## What was added

### `components/orvek-v0/pages/explore.tsx` — `FieldworkBridge` only

- Detects live fieldwork via `exploreFieldworkIds?.length > 0` (hybrid merge output, not global `displayContract`)
- Syncs selection from `exploreFieldworkSelectedId`
- Renders selected fieldwork object through provider `getObject`
- Maps fieldwork object fields into the existing dl layout (Expected signal, What to observe, etc.)
- Multi-item watch prompt list when more than one ready row
- Inspector opens via `resolveExperimentOpenSelectionId()` for live fieldwork and linked context
- Reference fallback preserved: hardcoded copy, `f2` / `aq-2` buttons when no gated production rows

### `lib/__tests__/fieldwork-bridge-alignment.test.ts`

Covers ready merge consumption, unsafe/empty/loading fallback, safe selection, reference fallback, Investigations/Questions/chat untouched, no `/watch-for` navigation, shell quarantine.

### `lib/__tests__/experiment-hybrid-fetch.test.ts`

Updated FieldworkBridge assertion for alignment wiring.

## Explicit non-goals (this slice)

- Investigations tab **untouched**
- Active Questions tab **untouched**
- Free Explore chat **untouched**
- Today, Map, Timeline, Decisions bridges **unchanged**
- No `/watch-for` route navigation
- `createMockOrvekDataApi()` remains baseline for unwired surfaces

## Parity preserved

| Surface | Status |
|---------|--------|
| Today | Unchanged |
| Map | Unchanged |
| Timeline | Unchanged |
| Decisions | Unchanged |
| Investigations / Active Questions / chat | Still reference/mock |
| Fieldwork Bridge | Live when gated rows present; reference otherwise |

## Production readiness

**Not production-ready yet.** End-to-end live Fieldwork requires product-owner visual verification with real watch-for data in the workbench.

## Product-owner visual check

**Required before commit.**

Verify in the integrated workbench:

1. Explore → Fieldwork Bridge with **no** live watch-for data → reference copy + `f2` / `aq-2` buttons
2. With **ready** watch-for data → production rows render in reference layout; Open fieldwork opens inspector safely
3. With **unsafe/empty** fetch → reference fallback, no raw production leak
4. Investigations, Active Questions, Free Explore tabs unchanged

## Known risks

- Live fieldwork maps sparse watch-for rows (prompt/reason only) into reference field slots; optional rich fields show `—`
- Multi-item list is new UI only when `exploreFieldworkIds.length > 1`; single-item live view matches reference single-panel layout
- Linked context button replaces linked question label in live mode when related receipts exist

## Recommended next slice

**Closeout + commit** after product-owner visual check passes.

Then optional follow-ups:

- Investigations / Active Questions bridges (separate slices, not mixed)
- Empty-state polish when live list renders but detail fields are sparse
