# 31 — Canonical data contracts implemented (Today composition + report)

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`
Root-cause map: `30-root-cause-canonical-data-contract-map.md`

## Contracts added

| Contract | Storage | Query | Consumer |
|----------|---------|-------|----------|
| **A. Canonical Today Composition** | `CanonicalTodayComposition` (userId unique, versioned JSON payload) | `GET /api/canonical-today-composition` | Hybrid → `buildTodayProductionDataApi({ canonicalWorkbench })` → live provider |
| **B. Model Movement Entry** | Fields inside composition `movements[]` (previous/updated/explanation/receipts/rank/destination) + densograph `objects[]` | Same API | Composition path builds `today.movements` without `pickTodayHeroItem` |
| **C. Model Movement Report** | `CanonicalModelMovementReport` (title, meta, sections, related ids) | Same API (`report`) | Report title/meta from stored report — not hardcoded “What Changed” when composition present |
| **D. Ordered relationships** | Ordered arrays in composition payload | Same | NOW / movements / resurfaced / primary actions |

## Path

`production persistence → /api/canonical-today-composition → hybrid hydration → live provider → unchanged canonical presentation`

## Seed / cleanup

- `lib/exact-fixture-round-trip-seed.ts` — `seedExactFixtureRoundTrip` / `cleanupExactFixtureRoundTrip`
- Gated by `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1` + local DB safety

## Real-account boundary

Normal accounts without a composition row keep the existing inferred Today path. Automatic generation of composition for ordinary accounts is **not yet generated** (separate campaign).

| Capability | Status |
|------------|--------|
| Today composition representable + round-trip seedable | working (this change) |
| Report title/meta/sections first-class | working (this change) |
| Movement entry exact texts via composition | working (this change) |
| Ordered NOW / resurfaced / movements | working (this change) |
| Automatic composition generation for normal accounts | not yet generated |
| Map / Timeline / Explore densograph composition payloads | persisted objects in Today composition densograph; dedicated page composition payloads not yet first-class |
| Decision densograph options/pros/cons via SurfacedAction alone | thinner than fixture — objects projected in composition densograph for Inspector |

## Verification

Re-run: `scripts/step10-exact-fixture-round-trip.playwright.ts`

**Gate result:** `EXACT ROUND-TRIP PASSED — PRODUCTION CAN REPRESENT CANONICAL CONTRACT` (Today exact mismatches: 0).
