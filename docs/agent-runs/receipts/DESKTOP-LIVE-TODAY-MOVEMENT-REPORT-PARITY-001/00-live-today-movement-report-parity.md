# Desktop Live Today Movement Report Parity 001

**Branch:** `desktop-live-today-movement-report-parity-001`  
**Baseline:** `112accb` (staging — PR #105 live Today evidence pointer parity)  
**Production-ready:** NO

---

## Reference contract consulted

- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/01-today-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/02-inspector-report-evidence-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/04-live-data-replacement-rules.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-OBJECT-GRAPH-001/00-live-today-object-graph.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-EVIDENCE-POINTER-PARITY-001/00-live-today-evidence-pointer-parity.md`

---

## Movement / report mapping findings

| Affordance | Reference (accepted) | Live `buildTodayProductionDataApi` | Parity today |
|------------|----------------------|-------------------------------------|--------------|
| Hero **See why it moved** | `seeWhy("mu-1")` → Inspector movement tab with **both** before/after | Hero sets `showSeeWhyMoved` when intelligence update exists; object registered **without** before/after | **FAIL** — blocked |
| Delta log **See why** | `REFERENCE_MOVEMENTS` with Previously/Updated columns | `today.movements` rows with `previous: null`; objects lack delta | **FAIL** — blocked |
| Movement id alone | Insufficient | Intelligence update id registered as model-update title/summary only | **BLOCKED** |
| Selected vs global movement | Selected object delta separate from global recent list | Live hero movement id can differ from global `mu-*` fixtures | **GUARDED** — `mustNotSubstituteGlobalMovementForSelectedObject` |
| Aside **Weekly Model Movement report** | `openReport("rep-weekly")` with full report overlay | View props set `reportId: "rep-weekly"` but report object **not registered** on live API | **FAIL** — blocked; reference path remains at root UI |
| Report slot/copy only | Insufficient | Adapter emits report slot when intelligence updates exist | **BLOCKED** without openable live report object |

---

## Parity helpers / builders added or tightened

**New module:** `lib/orvek-v0/production/today-movement-report-parity.ts`

| Helper | Purpose |
|--------|---------|
| `LiveMovementTarget` | `{ objectId, inspectorTab: "movement", before, after, provenanceLabel }` |
| `LiveReportTarget` | `{ reportId, openable: true, title, provenanceLabel }` |
| `hasRecordedBeforeAfterMovement` | **Tightened** — requires **both** before and after |
| `hasInspectableMovementDelta` | Movement object with complete delta |
| `canUseLiveTodaySeeWhyMoved` | See why parity gate |
| `canUseLiveTodayMovementRow` | Delta log row parity |
| `resolveLiveMovementTarget` / `resolveSelectedObjectMovementTarget` | Inspector movement tab targets |
| `getParitySafeMovementTargets` / `buildParitySafeMovementObjects` | Hybrid-safe movement merge |
| `mustNotSubstituteGlobalMovementForSelectedObject` | Prevents global recent movement substituting selected-object delta |
| `hasMeaningfulReportContent` / `hasOpenableReportObject` | Report must have title + summary/reportSummary |
| `canUseLiveTodayReport` / `resolveLiveReportTarget` | Live report open gate (live API object only) |
| `isReferenceReportSlotWithoutLiveObject` | Blocks `rep-weekly` slot when live API lacks registered report |
| `buildParitySafeReportObjects` | Hybrid-safe report merge |

**Updated:** `lib/orvek-v0/production/today-object-graph-parity.ts`

- Delegates movement/report logic to dedicated module.
- Adds `paritySafeMovementTargets` and `paritySafeReportTarget` to `LiveTodayGraphParity`.
- `buildParitySafeTodayObjectMap` composes evidence + movement + report parity-safe maps only.

**Evidence pointer parity (PR #105):** unchanged — separate module untouched.

---

## UI changed

**NO** — Reference Today branch preserved (`isProductionDisplay(data)`, `REFERENCE_MOVEMENTS`, `openReport("rep-weekly")` on reference path).

---

## Tests / checks run

- `lib/__tests__/today-movement-report-parity.test.ts` (new — 9 tests)
- Existing parity / hybrid / inspector / regression suites (unchanged behaviour for evidence pointers)
- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- Vitest (9 files) — PASS

---

## Remaining risks

1. Live adapter still sets `showSeeWhyMoved: true` and `reportId: "rep-weekly"` in view props — parity gates block unsafe merge/UI use until adapter slices normalize honesty.
2. Reference `rep-weekly` remains the accepted Today aside report at root; live report replacement requires a future slice with registered live report objects.
3. Partial movement records (before-only or after-only) remain blocked — stricter than previous OR gate; matches reference contract.

---

## Production-ready: NO

Movement/report parity infrastructure only. Reference Today movement and report affordances unchanged at root.
