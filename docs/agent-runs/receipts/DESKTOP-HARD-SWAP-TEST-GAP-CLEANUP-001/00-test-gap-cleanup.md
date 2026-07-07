# Desktop Hard-Swap Test Gap Cleanup — Receipt

**Slice:** `DESKTOP-HARD-SWAP-TEST-GAP-CLEANUP-001`  
**Branch:** `desktop-hard-swap-test-gap-cleanup-001`  
**Baseline commit:** `8d1c4ed` (staging — PR #98 regression sweep landed)  
**Date:** 2026-07-06  
**Classification:** **PASS**

**Production-ready: NO**

---

## Summary

Closed the two documented test gaps from PR #98 regression sweep. One narrow defensive production hardening in hybrid merge; Map workbench test updated for hard-swap architecture. All targeted guard suites green (183/183).

---

## Documented failures

### 1. `lib/__tests__/hybrid-workbench-api.test.ts`

**Symptom:** `does not merge fake grounding/movement/live-detection fields as production chat overlay` expected `exploreGrounding: []` but received mock `EXPLORE_GROUNDING` ids from `baseApi`.

**Root cause:** When `freeExploreChatApi` was provided but rejected by `shouldMergeFreeExploreChatProductionApi`, `buildHybridWorkbenchDataApi` returned unmodified `baseApi` (early return or post-merge skip). `createMockOrvekDataApi()` includes reference `exploreGrounding` / `exploreMovement`, which could surface in root Explore if a rejected overlay was wired.

**Fix:**

- **Production (defensive hardening):** Added `stripRejectedFreeExploreChatMockBleed()` in `lib/orvek-v0/production/hybrid-workbench-api.ts`.
  - When `freeExploreChatApi` is passed but merge is rejected, clear `exploreGrounding`, `exploreMovement`, `exploreLiveDetectionCopy`, and `exploreMessages` instead of falling back to mock reference fields.
  - Applies on early-return path and when other overlays (e.g. Map) merge successfully.
- **Tests:** Updated fallback expectations in `hybrid-workbench-api.test.ts` and `free-explore-chat-presentation-readiness.test.ts` to match the honesty contract. Added focused test: `strips mock explore bleed when a rejected chat overlay is paired with other ready merges`.

**Why product code changed:** Defensive hardening only — prevents malformed/rejected chat overlays from reintroducing mock grounding or conversation movement in root live Free Explore. Does not change successful merge path or reference route behavior.

---

### 2. `lib/__tests__/your-map-workbench.test.ts`

**Symptom:** `renders master-detail layout on /your-map` expected `buildMapProductionDataApi` inside quarantined `OrvekMapPage`.

**Root cause:** Hard swap moved active Map production bridge to `useOrvekHybridWorkbenchDataApi` via `OrvekWorkbenchShell`. `OrvekMapPage` remains a quarantined route-first container (`OrvekV0PageShell`), not the active root integration point.

**Fix (test-only):**

- Renamed primary test to `renders master-detail layout through the active hybrid workbench path`.
- Assert Map bridge in `useOrvekHybridWorkbenchDataApi` (`buildMapProductionDataApi`, fetches, readiness flags).
- Assert `OrvekWorkbenchShell` uses hybrid hook and does **not** mount `OrvekMapPage`.
- Preserve quarantine: `/your-map` route still exists with `OrvekMapPage` + `OrvekV0PageShell`.
- Updated `loads conclusions` test to assert `fetchYourMapConclusions` in hybrid hook.

---

## Product code changed?

| Area | Changed? |
|------|----------|
| `lib/orvek-v0/production/hybrid-workbench-api.ts` | **Yes** — defensive strip on rejected chat overlay |
| Tests | **Yes** — hybrid, presentation-readiness, your-map-workbench |
| Receipt | **Yes** — this file |

---

## Changed files

- `lib/orvek-v0/production/hybrid-workbench-api.ts`
- `lib/__tests__/hybrid-workbench-api.test.ts`
- `lib/__tests__/free-explore-chat-presentation-readiness.test.ts`
- `lib/__tests__/your-map-workbench.test.ts`
- `docs/agent-runs/receipts/DESKTOP-HARD-SWAP-TEST-GAP-CLEANUP-001/00-test-gap-cleanup.md`

---

## Checks run

```bash
npx tsc --noEmit                                          PASS
bash scripts/check-trust-language.sh                      PASS
bash scripts/check-legacy-surfaces.sh                     PASS
git diff --check                                          PASS
npx vitest run \
  lib/__tests__/hybrid-workbench-api.test.ts              PASS (64 tests)
  lib/__tests__/your-map-workbench.test.ts                PASS (11 tests)
  lib/__tests__/desktop-hard-swap-regression-sweep.test.ts PASS (10 tests)
  lib/__tests__/shell-quarantine.test.ts                  PASS (3 tests)
  lib/__tests__/orvek-v0-inversion.test.ts                PASS (7 tests)
  lib/__tests__/free-explore-post-send-side-effect-audit.test.ts PASS (9 tests)
  lib/__tests__/free-explore-chat-send-draft-stream.test.ts PASS (17 tests)
  lib/__tests__/free-explore-chat-tab-alignment.test.ts   PASS (18 tests)
  lib/__tests__/free-explore-chat-presentation-readiness.test.ts PASS (21 tests)
  lib/__tests__/map-production-api.test.ts                PASS (included in run)
  lib/__tests__/map-presentation-readiness.test.ts        PASS (10 tests)
```

**Total:** 183/183 PASS  
**Remaining failures:** none

---

## Runtime / visual check before commit?

**Recommended** — narrow production merge change affects rejected-overlay edge path only. PO should spot-check root Free Explore send + Grounded In honesty still hold (expected unchanged on confirmed runtime path).

---

## Recommended commit command (only if PO runtime passes)

```bash
git add \
  lib/orvek-v0/production/hybrid-workbench-api.ts \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/free-explore-chat-presentation-readiness.test.ts \
  lib/__tests__/your-map-workbench.test.ts \
  docs/agent-runs/receipts/DESKTOP-HARD-SWAP-TEST-GAP-CLEANUP-001/00-test-gap-cleanup.md

git commit -m "$(cat <<'EOF'
Harden rejected Free Explore overlay fallback and align Map bridge tests.

Strip mock explore grounding/movement when chat overlay fails merge, and update your-map workbench tests to assert the active hybrid workbench path.
EOF
)"
```

**Not committed** per instructions.

---

**Production-ready: NO**
