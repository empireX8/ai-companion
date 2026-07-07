# Desktop Live Today Object Graph 001

**Branch:** `desktop-live-today-object-graph-001`  
**Baseline:** `86ef09f` (staging — PR #103 reference behaviour contract audit)  
**Production-ready:** NO

---

## Reference contract consulted

- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/01-today-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/02-inspector-report-evidence-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/04-live-data-replacement-rules.md`

---

## Mapping audit findings (reference vs live Today API)

| Affordance | Reference (accepted zip) | Live `buildTodayProductionDataApi` | Parity today |
|------------|--------------------------|-------------------------------------|--------------|
| Hero primary card | `d1` decision lead; See why → `mu-1` with before/after | Hero from intelligence/surfacing; `showSeeWhyMoved` when movement exists | **FAIL** — movement objects lack `before`/`after` |
| Evidence pointer (aside) | `r6`, `r5`, `r2` receipts → Inspector Evidence | Resurfaced receipt ids from surfacing cards; may parse inspector linkage | **PARTIAL** — inspectable when `sourceText` + `type: receipt` |
| Weekly report card | `rep-weekly` registered; `openReport` works | Report slot in view props; report object **not registered** in object graph | **FAIL** |
| Delta log movements | `REFERENCE_MOVEMENTS` with full before/after | `today.movements` rows; objects registered without before/after | **FAIL** |
| See why it moved | Opens Inspector movement tab with recorded delta | Sets movement id but object has summary only | **FAIL** |
| Primary actions | All `select("d1")` (accepted quirk) | Production deferred-action path exists but not activated at root | N/A (reference branch unchanged) |
| Hybrid merge | Previously merged all resurfaced receipt ids + live `today` view props | Now merges **parity-safe object map only**; reference `today` props not overlaid | **SAFE** |

---

## What live Today data currently lacks

1. **Before/after on movement/model-update objects** — blocks See why parity and delta log replacement.
2. **Registered report objects** for weekly report affordance (`rep-weekly` or live equivalent).
3. **Guaranteed inspectable evidence-pointer linkage** for every surfaced receipt id (empty/sparse receipts fail).
4. **Hero language parity** — raw update-type labels without reference narrative framing.
5. **Distinct primary-action wiring** — deferred until dedicated slice.

---

## Parity helpers / builders added

**New module:** `lib/orvek-v0/production/today-object-graph-parity.ts`

| Helper | Purpose |
|--------|---------|
| `hasRecordedBeforeAfterMovement` | Requires `before` or `after` on object |
| `isEvidencePointerInspectable` / `filterInspectableEvidencePointerIds` | Receipt with inspectable `sourceText` |
| `canUseLiveTodayEvidencePointerList` | All resurfaced ids must be inspectable |
| `canUseLiveTodaySeeWhyMoved` | Movement id resolves with before/after |
| `canUseLiveTodayHero` | Inspect target + See why parity when flagged |
| `canUseLiveTodayMovementRow` | Movement row parity for delta log |
| `hasOpenableReportObject` | Report type object with title |
| `assessLiveTodayObjectGraphParity` | Full assessment snapshot |
| `buildParitySafeTodayObjectMap` | Objects safe to merge without UI flip |
| `shouldMergeTodayObjectGraph` | Hybrid merge gate |
| `withTodayObjectGraphParity` | Attach assessment to merged API |

**Hybrid wiring:** `lib/orvek-v0/production/hybrid-workbench-api.ts`

- `mergeTodayOverlay` uses parity-safe object map only.
- Does **not** overlay live `today` view props onto hybrid API (reference Today branch stays stable).
- Attaches `todayObjectGraphParity` on merged API.
- No global `displayContract: "production"`.

**Type extension:** `OrvekDataApi.todayObjectGraphParity` in `lib/orvek-v0/data-provider.tsx`.

---

## UI changed

**NO** — Today page still gates on `isProductionDisplay(data)`; reference branch unchanged. No surface live-mode gating reintroduced.

---

## Tests / checks run

- `lib/__tests__/today-object-graph-parity.test.ts` (new)
- `lib/__tests__/hybrid-workbench-api.test.ts` (parity attachment assertion)
- `npx tsc --noEmit`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `git diff --check`
- `npx vitest run lib/__tests__/today-surface.test.ts lib/__tests__/today-reentry.test.ts lib/__tests__/inspector-surface-wiring.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/desktop-hard-swap-regression-sweep.test.ts lib/__tests__/free-explore-post-send-side-effect-audit.test.ts lib/__tests__/today-object-graph-parity.test.ts`

---

## Remaining risks

1. Live receipt merge still hydrates `getObject` for parity-safe receipts only — Inspector may show live receipt copy while Today aside remains reference-presented (intentional for this slice).
2. Hero/report/movement replacement slices still required before any Today UI branch flip.
3. `buildTodayProductionDataApi` still sets `showSeeWhyMoved: true` when movement exists without before/after — parity helpers block merge/UI use but production API shape remains optimistic until adapter slice.
4. PO runtime not re-run for this slice (no visual change expected).

---

## Production-ready: NO

Parity infrastructure only. Reference Today behaviour remains the product contract at root.
