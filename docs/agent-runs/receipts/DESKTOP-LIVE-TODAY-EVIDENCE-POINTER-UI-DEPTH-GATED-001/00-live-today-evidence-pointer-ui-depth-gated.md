# Desktop Live Today Evidence Pointer UI Depth Gated 001

**Branch:** `desktop-live-today-evidence-pointer-ui-depth-gated-001`  
**Baseline:** `a694f8d` (staging — PR #116 stored evidence pointer read/linkage projection)  
**Authoritative receipts consulted:** #110 inspector depth parity, #116 linkage implementation  
**UI changed:** YES (Today resurfaced aside content is now depth-gated)  
**Product code changed:** YES  
**Runtime/visual required:** YES  
**Production-ready:** NO

---

## Goal

Consume **stored, depth-safe** Evidence Pointer receipt objects in Today **only** when the stored pointer graph is explicitly depth-ready, without changing the accepted v0 click contract:

`Evidence Pointer row → select(pointer.id) → Inspector Evidence tab → rich ObjectDetail`

And without rendering thin live Today receipt rows as Evidence Pointers.

---

## Implementation summary

### 1) Strict depth gate applied at the hybrid data API layer

`TodayPage` (locked) renders resurfaced receipt rows from `todayResurfacedIds`. Since `components/orvek-v0/pages/today.tsx` must not change, this slice gates at the **data API**:

- When stored graph is depth-ready:
  - register `pointerObjects` + `linkedObjects` via `mergeSurfacedEvidenceDepthObjects`
  - set `todayResurfacedIds = depthSafePointerIds`
- Otherwise:
  - set `todayResurfacedIds = ["r6", "r5", "r2"]` (preserves accepted reference fallback rows; prevents thin live `V0TodayReceiptRow` from appearing)

This prevents any adapter trick or `receiptHref/detailHref` carryover from being treated as depth parity.

### 2) Stored graph fetch

`components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` fetches `GET /api/today/evidence-pointers` after the Today snapshot is loaded and retains the payload **only** when:

- `inspectorDepthListReady === true`, and
- `depthSafePointerIds.length > 0`

Everything else is discarded (fallback remains reference/mock behavior; production shows no resurfaced evidence pointers until stored ones exist).

### 3) Depth-gate helper

Added `lib/orvek-v0/production/today-evidence-pointer-depth-gate.ts`:

- `applySurfacedEvidenceDepthGate({ api, overlay })`:
  - merges objects into provider lookup under gate
  - overrides `todayResurfacedIds` under gate
  - otherwise forces `todayResurfacedIds: []`

---

## Proofs / constraints satisfied

- **Accepted click contract preserved**: Today still calls `select(r.id, "evidence")` in production; only the ids change when depth-ready.
- **Inspector behavior unchanged**: only `getObject(pointer.id)` availability changes via provider merge.
- **Reference route remains mock-only**: `/dev/orvek-v0-reference` mounts `<Workbench />` directly (no hybrid hook; no production fetch).
- **Thin live rows not used**: in production, thin `todayResurfacedIds` from `buildTodayProductionDataApi` are overridden to the **reference fallback ids** unless stored depth-safe overlay is ready.
- **No gate loosening**: `canUseLiveEvidenceInspectorDepthList` unchanged; overlay must already be depth-ready.
- **No fabricated rationale/links**: UI uses stored `pointerObjects` only; no inference from `receiptHref/detailHref`.

---

## Files changed

- **Modified**: `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
  - fetch stored depth-safe graph
  - apply depth gate to provider + `todayResurfacedIds`
- **Added**: `lib/orvek-v0/production/today-evidence-pointer-depth-gate.ts`
  - pure helper implementing strict override rules
- **Added**: `lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts`
  - verifies override rules and provider registration behavior

No changes to `components/orvek-v0/pages/today.tsx`.

---

## Checks / tests run

- `npx prisma validate` — PASS
- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- `npx vitest run` (key suites) — PASS:
  - `lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts`
  - `lib/__tests__/hybrid-workbench-api.test.ts`
  - `lib/__tests__/evidence-panel-provider-lookup.test.ts`
  - `lib/__tests__/today-object-graph-parity.test.ts`
  - `lib/__tests__/today-evidence-pointer-parity.test.ts`
  - `lib/__tests__/evidence-inspector-depth-parity.test.ts`
  - `lib/__tests__/live-evidence-depth-linkage.test.ts`
  - `lib/__tests__/today-adapter-honesty.test.ts`

---

## Runtime / visual check (required)

Before any commit, verify in the app UI:

1. **Today → Evidence Pointer aside**:
   - with no stored depth-safe pointers available, the resurfaced list should show the accepted **reference fallback rows** (`r6`, `r5`, `r2`) (not empty copy; not thin live receipts).
2. If you seed a depth-safe stored fixture (DB):
   - Today aside shows the stored pointer row(s)
   - clicking one calls `select(pointer.id)` and opens a rich Evidence tab with resolvable related/context targets.
3. `/dev/orvek-v0-reference` still shows reference ids (`r6`, `r5`, `r2`) and never depends on production endpoints.

### Visual check history

- **Initial visual check:** FAIL — fallback was blanked because `todayResurfacedIds` was set to `[]` when stored pointers were not ready.
- **Fix:** restored reference fallback ids for the non-ready case.

---

## Next branch recommendation

**`desktop-live-evidence-depth-write-hook-001`**

Wire the materializer into a real publish/surfacing hook so production data can actually create stored pointers (still depth-gated in UI).

---

## Commit recommendation

**DO NOT COMMIT** until product-owner runtime/visual check passes.

Suggested message once verified:

```
Depth-gate Today evidence pointer UI on stored graph readiness.

Fetches stored depth-safe pointers, merges them into provider lookup, and
overrides todayResurfacedIds only when inspectorDepthListReady is true.
Thin live receipts remain blocked.
```

---

*End of receipt.*

