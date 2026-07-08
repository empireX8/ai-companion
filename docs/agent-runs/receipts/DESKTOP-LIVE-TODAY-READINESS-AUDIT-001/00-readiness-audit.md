# Desktop Live Today Readiness Audit 001

**Branch:** `desktop-live-today-readiness-audit-001`  
**Baseline:** `1e65435` (staging — PR #107 live Today adapter honesty)  
**Mode:** Audit / receipt only — no product code changes  
**UI changed:** NO  
**Production-ready:** NO

---

## Reference / parity contracts consulted

- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/01-today-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/02-inspector-report-evidence-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/04-live-data-replacement-rules.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-OBJECT-GRAPH-001/00-live-today-object-graph.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-EVIDENCE-POINTER-PARITY-001/00-live-today-evidence-pointer-parity.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-MOVEMENT-REPORT-PARITY-001/00-live-today-movement-report-parity.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-ADAPTER-HONESTY-001/00-live-today-adapter-honesty.md`

---

## Post-honesty stack summary (what exists today)

| Layer | Role |
|-------|------|
| `buildTodayProductionDataApi` | Builds live object graph + raw view props |
| `withTodayAdapterHonesty` (PR #107) | Strips unsafe affordance props before API return |
| Parity modules (#104–#106) | Assess merge safety; expose target metadata |
| `buildHybridWorkbenchDataApi` | Merges **parity-safe objects only**; does **not** overlay `today` view props |
| `components/orvek-v0/pages/today.tsx` | Root uses **reference branch** (`isProductionDisplay(data) === false`) |

---

## Readiness verdicts by area

### 1. Hero readiness

| Criterion | Post-honesty state | Verdict |
|-----------|-------------------|---------|
| Safe to show as replacement primary card | Intelligence-driven hero uses raw update labels (e.g. `Conclusion Added · Related map item`); narrative/copy below reference contract | **Blocked** for visual replacement |
| Safe selected object target | `inspectSelectId` resolves via `getObject` when intelligence/surfacing selection registered | **Partial** — object exists, Inspector opens, but not reference-quality framing |
| `showSeeWhyMoved` safety | Honesty sets `false` when movement lacks before+after (typical live snapshot) | **Safe** — no false See why CTA in production props |
| `heroReady` / `canUseLiveTodayHero` | `canUseLiveTodayHero` true when inspect target has title and `showSeeWhyMoved` is false; does **not** require language parity or evidence stat honesty | **Too broad** for future UI — use narrower gates |
| Primary hero actions | Production primary actions largely deferred (`disabled` when not reentry href) | **Blocked** for interactive hero parity |

**Overall hero verdict:** **Safe only for read-only display** of live summary text in a future slice — **not safe** to replace reference hero card. Do not use `heroReady` alone as a UI flip gate.

---

### 2. Evidence Pointer readiness

| Criterion | Post-honesty state | Verdict |
|-----------|-------------------|---------|
| `todayResurfacedIds` filtering | `normalizeTodayResurfacedIdsForParity` → inspectable receipt ids only | **Safe** in production API output |
| `today.receipts` filtering | Filtered to match safe resurfaced ids | **Safe** |
| Inspector Evidence tab resolution | Parity-safe receipts registered as `type: receipt` + `sourceText` + provenance; hybrid merges into `getObject` | **Safe** when ids pass parity (tests + hybrid merge confirm) |
| Misleading counts/copy | `hero.linkedReceipts` → `"—"` when `shouldExposeEvidencePointerAffordance` false | **Safe** after honesty |
| Root Today UI today | Reference branch uses `REFERENCE_RESURFACED` (`r6`, `r5`, `r2`); live list **not shown** at root | **Not consumed visually yet** — object graph hydration only |

**Overall evidence pointer verdict:** **Safe now** for a **narrow UI consumption slice** when:

- `shouldExposeEvidencePointerAffordance(productionTodayApi)` is true, and
- Every displayed row id ∈ `filterInspectableEvidencePointerIds`, and
- `resolveLiveEvidencePointerTarget` resolves for each row.

**Not safe** to swap when list empty or mixed non-inspectable receipts remain in raw adapter output (honesty already strips unsafe rows from production props).

---

### 3. See why it moved readiness

| Criterion | Post-honesty state | Verdict |
|-----------|-------------------|---------|
| `showSeeWhyMoved` exposure | Only when `resolveLiveMovementTarget` succeeds (before + after on model-update) | **Safe** gate in props |
| Typical live snapshot | `buildTodayProductionDataApi` registers intelligence updates **without** before/after → honesty → `showSeeWhyMoved: false` | **No live See why to consume** |
| Movement tab resolution | When target exists, `inspectorTab: "movement"` metadata available via parity helpers | **Safe** but **no current live data path** populates delta |
| Unsafe movement ids/titles | Stripped from movement-driven CTAs; movement rows removed from `today.movements` if not parity-safe | **Safe** |

**Overall See why verdict:** **Blocked** for UI consumption — gates work, but **no live movement objects with recorded delta** are registered today. Reference `mu-1` path remains the accepted behaviour at root.

---

### 4. Report CTA readiness

| Criterion | Post-honesty state | Verdict |
|-----------|-------------------|---------|
| Live report exposure | `report: null` when no openable live report object (typical intelligence snapshot) | **Safe** — no false live report slot |
| `rep-weekly` | Reference aside card uses `openReport("rep-weekly")` on **reference branch only** (`!isProduction`) | **Reference fallback only** — correct |
| Primary action report routing | `reportId` stripped from actions when report not parity-safe | **Safe** |
| Future live report CTA | Requires live `type: report` object with title + summary/reportSummary registered in production API | **Blocked** until report object registration slice |

**Overall report verdict:** **Blocked** for live UI consumption. Reference weekly report remains the accepted entry at root.

---

### 5. Delta log readiness

| Criterion | Post-honesty state | Verdict |
|-----------|-------------------|---------|
| Row filtering | `today.movements` filtered via `canUseLiveTodayMovementRow` | **Safe** gate |
| Before + after on rows | Live adapter sets `previous: null`; movement objects lack before/after → **empty movements array** after honesty | **No rows to consume** |
| Inspector Movement tab | Parity metadata exists when rows pass; none do in typical snapshots | **Blocked** |
| Reference delta log | `REFERENCE_MOVEMENTS` with full Previously/Updated copy at root | Unchanged — accepted |

**Overall delta log verdict:** **Blocked** for live UI consumption. Requires movement object registration with before/after before any delta-log swap.

---

### 6. Hybrid / root readiness

| Check | Status |
|-------|--------|
| Hybrid does not overlay live `today` view props | **Confirmed** — `mergeTodayOverlay` merges parity-safe objects + emptyCopy only |
| Global `displayContract: "production"` | **Not set** on hybrid root |
| `/dev/orvek-v0-reference` mock-only | **Confirmed** — no hybrid hook |
| Broad live gating (`isTodayLiveReady`, `surfaceReadiness`) | **Not reintroduced** |
| Reference Today UI at root | **Preserved** — `isProductionDisplay(data) === false` |

**Overall hybrid/root verdict:** **Safe** — infrastructure ready; visual consumption correctly deferred.

---

## What is safe now

1. **Parity-safe receipt object hydration** via hybrid `getObject` / `getObjects` (Evidence Inspector lookup when ids are parity-safe).
2. **Production API honesty** — unsafe affordance props stripped before any future production-branch read.
3. **Reference Today UX** at root — unchanged and still the product contract.
4. **Evidence pointer list props** on production API — safe to **plan** UI consumption when `shouldExposeEvidencePointerAffordance` is true.

---

## What is blocked

1. **Hero card replacement** — language/copy parity insufficient; primary actions deferred.
2. **See why it moved live consumption** — no live before/after movement objects.
3. **Live report CTA / aside report swap** — no openable live report objects registered.
4. **Delta log live consumption** — no parity-safe movement rows in typical snapshots.
5. **Global Today live flip** — `isProductionDisplay`, `heroReady`, or data presence alone.

---

## What would be unsafe to consume visually

| If UI flipped today… | Failure mode |
|---------------------|--------------|
| Hero from live intelligence update | Raw API labels; false confidence; deferred actions |
| See why from live movement id | Was pre-#107 failure; now props honest but **empty** — swapping reference would **remove** working See why |
| Report from live slot / `rep-weekly` id | Opens reference overlay or null — broken or misleading CTA |
| Delta log from live movements | Empty or movement without Previously/Updated columns |
| Evidence rows from unfiltered ids | Dead Inspector rows (prevented in props, but would regress if UI bypasses honesty) |
| `heroReady === true` as sole gate | Allows hero swap without language/evidence parity |

---

## Recommended next branch

### `desktop-live-today-evidence-pointer-ui-consumption-001`

**Why this branch (not hero/report/delta-log):** Evidence pointer is the only affordance where post-honesty production output **can** contain parity-safe, inspectable rows with real live surfacing data, and hybrid already merges matching objects into the provider graph.

| Item | Scope |
|------|-------|
| **Components likely touched** | `components/orvek-v0/pages/today.tsx` (aside Evidence pointer section only) |
| **Affordance allowed** | Swap aside **Evidence pointer** row list from `REFERENCE_RESURFACED` to live `todayResurfacedIds` **only when** gates pass |
| **Gates UI must check** | `shouldExposeEvidencePointerAffordance(data)` AND every row id passes `canUseLiveTodayEvidencePointer(data, id)` AND `resolveLiveEvidencePointerTarget` non-null; **not** `isProductionDisplay` alone; **not** `heroReady` |
| **Must not change** | Hero, delta log, report aside (reference), primary chips, global displayContract |
| **Runtime/visual check** | **Required** for that slice — PO must confirm click → Inspector Evidence tab with source text + provenance |
| **Rollback criteria** | Any dead row, non-clickable row styled as clickable, reference row regression, or Inspector Evidence tab empty for a displayed row → revert slice |

**Deferred (later branches):**

- `desktop-live-today-read-only-hero-consumption-001` — after copy normalization slice
- `desktop-live-today-report-consumption-001` — after live report object registration
- `desktop-live-today-delta-log-consumption-001` — after movement before/after registration in `today-api`

---

## Checks run

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS (no product diff)
- Vitest:
  - `lib/__tests__/today-adapter-honesty.test.ts` — PASS (8)
  - `lib/__tests__/today-production-api.test.ts` — PASS (7)
  - `lib/__tests__/today-object-graph-parity.test.ts` — PASS (7)
  - `lib/__tests__/today-evidence-pointer-parity.test.ts` — PASS (6)
  - `lib/__tests__/today-movement-report-parity.test.ts` — PASS (9)
  - `lib/__tests__/hybrid-workbench-api.test.ts` — PASS (64)
  - `lib/__tests__/desktop-hard-swap-regression-sweep.test.ts` — PASS (10)

**Total:** 111 tests passed

---

## Production-ready: NO

Safety/parity/honesty stack is in place. Visual consumption remains intentionally deferred. Only evidence pointer list is candidate for the next narrow UI slice, with explicit gates and PO runtime verification.
