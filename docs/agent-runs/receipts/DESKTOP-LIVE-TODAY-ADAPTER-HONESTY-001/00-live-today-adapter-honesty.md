# Desktop Live Today Adapter Honesty 001

**Branch:** `desktop-live-today-adapter-honesty-001`  
**Baseline:** `b03939a` (staging — PR #106 live Today movement/report parity)  
**Production-ready:** NO

---

## Reference / parity contracts consulted

- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/01-today-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/02-inspector-report-evidence-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/04-live-data-replacement-rules.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-OBJECT-GRAPH-001/00-live-today-object-graph.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-EVIDENCE-POINTER-PARITY-001/00-live-today-evidence-pointer-parity.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-MOVEMENT-REPORT-PARITY-001/00-live-today-movement-report-parity.md`

---

## Adapter honesty findings

| Layer | Before honesty | After honesty |
|-------|----------------|---------------|
| `mapTodayDataToV0Props` | Raw mapping (unchanged) | Still emits optimistic props for adapter regression |
| `buildTodayProductionDataApi` | Passed raw `today` + full `todayResurfacedIds` | Applies parity honesty before return |
| Hybrid root | Does not overlay `today` view props | Unchanged |

---

## Unsafe affordance props found (pre-honesty)

| Prop | Optimistic behaviour | Risk |
|------|---------------------|------|
| `hero.showSeeWhyMoved` | `true` when intelligence update exists, without before/after on object | Future UI could show See why with no Inspector delta |
| `report.reportId` | `"rep-weekly"` when intelligence updates exist, without live report object | Report CTA opens reference/mock overlay |
| `report.primaryMovement` | Movement metadata without recorded delta | Implies explainable movement |
| `primaryActions[].reportId` | `"rep-weekly"` on Continue chip | Hidden report CTA via workbench routing |
| `todayResurfacedIds` | All receipt ids from surfacing cards | Non-inspectable receipts counted as evidence pointers |
| `hero.linkedReceipts` | Raw meta/count strings | Implies inspectable evidence when receipts fail parity |
| `today.movements` | All movement rows from intelligence feed | Delta log rows without before/after |

---

## Props / helpers tightened

**New module:** `lib/orvek-v0/production/today-adapter-honesty.ts`

| Helper | Purpose |
|--------|---------|
| `shouldExposeSeeWhyMoved` | Gate on `resolveLiveMovementTarget` / parity movement checks |
| `shouldExposeLiveReport` | Gate on `canUseLiveTodayReport` (live object only) |
| `shouldExposeEvidencePointerAffordance` | Gate on inspectable receipt list |
| `normalizeTodayResurfacedIdsForParity` | Filter to parity-safe receipt ids |
| `normalizeTodayAffordancesForParity` | Sanitize hero/report/movements/receipts/primaryActions |
| `withTodayAdapterHonesty` | Applied at end of `buildTodayProductionDataApi` |

**Honesty rules applied:**

- `showSeeWhyMoved: false` unless movement has parity-safe before+after
- `report: null` unless openable live report object exists
- Strip `reportId` from primary actions / hero when report not parity-safe
- `report.primaryMovement: null` unless movement target is parity-safe
- Filter `movements` to parity-safe rows only
- Filter `todayResurfacedIds` and `receipts` to inspectable evidence pointers
- `hero.linkedReceipts: "—"` when no inspectable evidence pointers

**Wired in:** `lib/orvek-v0/production/today-api.ts` → `withTodayAdapterHonesty(withProductionContract(...))`

---

## UI changed

**NO** — Reference Today branch unchanged at root. Honesty affects production API view props only (not overlaid by hybrid).

---

## Tests / checks run

- `lib/__tests__/today-adapter-honesty.test.ts` (new — 8 tests)
- Updated: `today-production-api.test.ts`, `today-object-graph-parity.test.ts`, `today-movement-report-parity.test.ts`
- Existing parity / hybrid / regression suites
- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- Vitest (8+ files, 131+ tests) — PASS

---

## Remaining risks

1. `mapTodayDataToV0Props` still emits optimistic props — only production API path is honest; direct adapter callers must not bypass `buildTodayProductionDataApi`.
2. Hero may remain `heroReady` in parity assessment when inspect target exists but See why is withheld — intentional; future hero UI slice must respect both gates.
3. Surfacing-card receipts with kind-derived provenance may pass evidence parity even when body is sparse — object-level checks still apply.

---

## Production-ready: NO

Adapter honesty prevents optimistic affordance props on the production Today API path. Reference Today UX and live UI flip remain deferred.
