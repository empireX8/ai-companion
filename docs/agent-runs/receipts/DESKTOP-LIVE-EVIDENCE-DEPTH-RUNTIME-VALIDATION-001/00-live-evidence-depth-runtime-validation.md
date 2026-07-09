# Desktop Live Evidence Depth Runtime Validation 001

**Branch:** `desktop-live-evidence-depth-runtime-validation-001`  
**Baseline:** `ad9238a` (staging — PR #122 publish route wiring)  
**Authoritative receipts consulted:** #116–#122, `DESKTOP-LIVE-EVIDENCE-DEPTH-PUBLISH-ROUTE-WIRING-001`  
**UI changed:** NO  
**Product code changed:** YES (validation helper only)  
**Schema/migration changed:** NO  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Validation scope

Service-level DI validation of the live evidence depth pipeline across:

1. Authoring/persistence (#121 + #119 + #120)
2. Publish/materialization (#122 + #118 + #115)
3. Read/linkage (#116 `readSurfacedEvidencePointersForUser`)
4. Today depth gate (#117 `applySurfacedEvidenceDepthGate`)

**Not exercised in this branch:**

- Live Clerk auth on `GET /api/today/evidence-pointers`
- Real Prisma DB / browser Today UI
- Manual visual confirmation

Route handler source was inspected; service path mirrors route body via `fetchEvidencePointersGraphService` → `readSurfacedEvidencePointersForUser`.

---

## Product code changed

| File | Purpose |
|------|---------|
| `lib/live-evidence-depth-runtime-validation.ts` | **NEW** — validation-only composition helpers (not imported by routes/UI) |

No UI, gate semantics, inspector, or reference route behavior changed.

---

## End-to-end path proven (service-level DI)

### Valid `pattern_claim` pipeline

1. `persistEvidenceDepthAuthoringInputsForSource` stores `EvidencePointerSurfacingRationale` + UEL `meta.graphSlot`
2. `publishModelUpdateCandidate` publishes + `maybeMaterializeEvidenceDepthForPublishedModelUpdate` materializes `SurfacedEvidencePointer`
3. `fetchEvidencePointersGraphService` returns `inspectorDepthListReady: true` with pointer + related object
4. `applyTodayEvidenceDepthGateFromReadGraph` replaces `todayResurfacedIds` with stored pointer id (not `r6/r5/r2`)

### Valid `contradiction_node` pipeline

Same through materialization + read/linkage (`receipt-tension-node-1` depth-safe).

---

## Blockers proven fail-closed

| Blocker | Publish succeeds | Pointer created | Today fallback |
|---------|------------------|-----------------|----------------|
| Missing stored rationale | YES | NO | `r6/r5/r2` |
| Generic rationale | YES (materialize skipped) | NO | `r6/r5/r2` |
| Movement-copy rationale | YES (materialize skipped) | NO | `r6/r5/r2` |
| Rationale equals sourceText | YES (materialize skipped) | NO | `r6/r5/r2` |
| Missing graphSlot links | YES (materialize skipped) | NO | `r6/r5/r2` |
| Private/ineligible link targets | YES (materialize skipped) | NO | `r6/r5/r2` |
| Thin/unsafe stored pointer (generic whyItMatters) | N/A | stored but rejected at read | `r6/r5/r2` |
| Linked target hydration failure | N/A | stored but rejected at read | `r6/r5/r2` |

Duplicate materialization upserts same pointer (no duplicate rows).

---

## Today fallback behavior verified

- Depth-ready stored overlay → `todayResurfacedIds` = stored pointer ids
- No overlay / unsafe read graph → `todayResurfacedIds` = `r6`, `r5`, `r2`
- Thin live `receipt-0-thin-live` never substituted

---

## `/dev/orvek-v0-reference` verified

- Route remains mock-only (`data-testid="orvek-v0-reference-route"`)
- No `/api/today/evidence-pointers` fetch in reference page
- Hybrid workbench hook fetches production endpoint; Today page does not
- `createMockOrvekDataApi()` still serves `r6` fallback receipts

---

## User-bound read verified

`fetchEvidencePointersGraphService` returns empty depth-safe ids for `user-2` when pointer belongs to `user-1`.

---

## Remaining gaps

1. **No executable local runtime fixture** — no seed script / dev command to create authored candidate + publish + curl evidence-pointers against live DB.
2. **Route integration** — auth + Prisma not exercised in tests.
3. **No production caller** passes `evidenceDepthAuthoring` on candidate create yet.
4. **Browser Today UI** — gate behavior proven at data-api layer only.

---

## Checks / tests run

```bash
npx prisma validate
npx tsc --noEmit
npm run build
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
git diff --check
npx vitest run \
  lib/__tests__/live-evidence-depth-runtime-validation.test.ts \
  lib/__tests__/live-evidence-depth-publish-route-wiring.test.ts \
  lib/__tests__/live-evidence-depth-authoring-path.test.ts \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-rationale-source.test.ts \
  lib/__tests__/live-evidence-depth-graphslot-link-source.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts
```

**Result:** PASS — 142 tests across listed suites; all verification checks pass.

---

## Suggested manual runtime path (not executed)

When a fixture branch lands:

```bash
# 1. Create internal model-update candidate with evidenceDepthAuthoring payload
# 2. POST /api/internal/model-updates/candidates/{id}/publish
# 3. GET /api/today/evidence-pointers (authenticated)
# 4. Confirm depthSafePointerIds + pointerObjects + linkedObjects
# 5. Open production Today — stored pointer ids only when inspectorDepthListReady
```

---

## Next branch recommendation

**`desktop-live-evidence-depth-runtime-fixture-001`**

Purpose: add a safe local dev seed/script (or documented internal-review path) to exercise publish → evidence-pointers → Today gate against a real DB without UI changes.

If fixture passes in a follow-up branch:

**`desktop-live-evidence-depth-closeout-audit-001`**

---

## Classification

| Item | Value |
|------|-------|
| **PASS/FAIL** | **PASS** |
| Product code changed | YES (validation helper only) |
| UI changed | NO |
| Validation type | **Service-level DI** (not live route/auth/db) |
| Runtime/visual required | **NO** |
| Commit recommendation | Ready for review; do not commit until Kay approves slice |
