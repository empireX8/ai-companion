# 14 Result For Kay — Canonical hard-swap

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`
Branch / worktree: `desktop-reference-authority-inspector-restoration-001`
Authority: `docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md`
Prior architecture audit: `11-hard-swap-architecture-audit.md`

## Verdict

**FAIL — CANONICAL HARD SWAP INCOMPLETE**

Do **not** treat this as visual READY, production acceptance, or merge readiness.

No commit, push, PR, or merge was made.

---

## Why this pass existed

Kay’s architectural decision: production must stop rendering a parallel page system that merely shares chrome. There must be three layers:

1. **Cold reference authority** — immutable frozen route `/dev/orvek-v0-reference` → `components/orvek-v0-reference-frozen/**`
2. **Canonical live-capable presentation** — exact copy of frozen presentation with an explicit data/action seam → `components/orvek-v0-canonical/**`
3. **Providers** — fixture (must match cold) and live (existing auth/APIs/actions mapped into the same contract)

Production must render **canonical pages + live provider**. Parallel `components/orvek-v0/pages/*` must become inactive.

---

## What landed

### Layer 1 — Cold authority

| Item | Status |
|------|--------|
| `/dev/orvek-v0-reference` | Remains cold mount via `FrozenReferenceWorkbench` |
| `components/orvek-v0-reference-frozen/**` | Not edited in this hard-swap pass (package remains comparison authority) |
| Safety patch before work | `/tmp/desktop-reference-authority-before-canonical-runtime.patch` |

### Layer 2 — Canonical presentation

| Path | Role |
|------|------|
| `components/orvek-v0-canonical/workbench.tsx` | Same shell family as frozen (`OrvekShellLayout` + TopBar / Sidebar / EvidencePanel / Overlays) |
| `components/orvek-v0-canonical/pages/{today,map,timeline,decisions,explore}.tsx` | Reference-derived pages; composition via `useCanonicalData()` |
| `components/orvek-v0-canonical/canonical-contract.ts` | Explicit composition + object contract |
| `components/orvek-v0-canonical/canonical-data-context.tsx` | Provider context |

Presentation intent: preserve Today / Map / Decisions / Explore / Timeline / Inspector paths, section order, Back, tabs, scroll, report overlays, and visual hierarchy from the frozen reference — not redesign.

### Layer 3 — Providers

| Provider | Mount | Notes |
|----------|-------|-------|
| Fixture | `/dev/orvek-v0-canonical-reference` → `createCanonicalFixtureRuntimeData()` | Reads frozen fixture identities (`d1`, `rep-weekly`, NOW rows, movements, map categories, etc.) without modifying frozen package |
| Live | `OrvekWorkbenchShell` → `buildCanonicalLiveRuntimeData(dataApi)` | Maps hybrid `OrvekDataApi` into the same contract; sets `canonicalRuntime: true` |

### Production presentation swap

`components/orvek-workbench/OrvekWorkbenchShell.tsx` now mounts:

- `DurableActionsRefreshProvider` (preserved)
- `OrvekPageHandlersProvider` (preserved)
- `CanonicalWorkbench` + live runtime + `enableProductionBridge`

It no longer mounts `components/orvek-v0/workbench.tsx` / `components/orvek-v0/pages/*` as the active visual root.

### Quarantine (inactive, not deleted)

Documented in `12-canonical-hard-swap-quarantine.md`:

- `components/orvek-v0/pages/*`
- `components/orvek-v0/workbench.tsx` as a separate visual root
- Production ModelUpdate compose branch when `data.canonicalRuntime === true` (gated in `components/orvek-v0-authority/evidence-panel.tsx`)

### Live capabilities intentionally kept outside presentation

- `useOrvekHybridWorkbenchDataApi`
- Auth / ownership / hybrid fetch
- Durable actions refresh
- Explore send handlers (wired into canonical FreeExplore when live)
- `ProductionInspectorBridge` + `InspectorProvider` when live

### Structural gates that passed (source / composition)

| Test | What it proves |
|------|----------------|
| `lib/__tests__/canonical-hard-swap-path-equivalence.test.ts` | Shell → canonical; cold vs fixture routes separate; parallel pages inactive |
| `lib/__tests__/canonical-fixture-composition-gate.test.ts` | Fixture IDs / composition match frozen hardcodes |
| Updated desktop hard-swap / quarantine / shell / explore-tab / free-explore mount tests | Retargeted to canonical root |

`npx tsc --noEmit` was clean for this pass’s canonical files at last check.

---

## Why READY is refused

READY required **all** of:

1. cold authority untouched
2. canonical reference-derived runtime created
3. fixture provider **matching** the cold authority
4. live provider connected
5. production using the canonical page system
6. parallel production presentation inactive
7. live production capabilities preserved
8. equivalent paths

Items 1–2 and 4–6 are substantially in place at the **architecture / wiring** level.

**Item 3 is incomplete for READY:** matching was proven structurally (fixture composition IDs), **not** by the required Step 4 visual path gate:

> Compare cold `/dev/orvek-v0-reference` vs fixture `/dev/orvek-v0-canonical-reference` at 1440×900 across Today, selected objects, linked objects, Back, Evidence / Context, Model Movement, report overlay, Map, Decisions, Experiment, Explore, Timeline.

No paired screenshots / DOM path proof for that fixture-vs-cold gate were produced in this pass. Kay’s rule: do not proceed from fixture stage to live as “done,” and do not claim READY because the app builds or component names match.

**Item 7 is partial:** Free Explore send/draft handlers are wired into canonical Explore; a full audit that every durable / correction / decisions / map control from the old parallel pages still fires correctly through the live provider was **not** completed.

**Item 8 is partial:** path-equivalence is asserted at the page-family / mount / store-nav level, not by end-to-end interaction proof on both surfaces.

Additional honesty gaps:

- Full `bash scripts/verify-mindlab.sh` is **not** claimed green; many older vitest files still assert against inactive `components/orvek-v0/pages/*` and were not all retargeted.
- Live provider maps hybrid adapters into the canonical contract; it is **not** proven that every live slot preserves typed reference-depth relationships (vs flattened packets).
- Live Today narrative/meta fields are provider-supplied (fixture keeps exact frozen copy); empty/loading honesty exists, but live composition depth is not visually proven.

---

## Exact review inputs for Kay

| Doc | Purpose |
|-----|---------|
| This file (`14-result-for-kay-canonical-hard-swap.md`) | Verdict + what landed / what blocks |
| `12-canonical-hard-swap-quarantine.md` | Inactive parallel presentation inventory |
| `13-canonical-hard-swap-incomplete.md` | Short incomplete-gates summary |
| `11-hard-swap-architecture-audit.md` | Why parallel presentation blocked earlier |
| `docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md` | Controlling desktop UI authority |

### Routes to open

| Route | Role |
|-------|------|
| `/dev/orvek-v0-reference` | Cold authority (immutable) |
| `/dev/orvek-v0-canonical-reference` | Canonical + fixture (must match cold before live is accepted) |
| `/` (authenticated production shell) | Canonical + live provider |

### Key code

| Path | Role |
|------|------|
| `components/orvek-workbench/OrvekWorkbenchShell.tsx` | Production root swap |
| `components/orvek-v0-canonical/**` | Canonical presentation |
| `components/orvek-v0-canonical/fixture-provider.ts` | Fixture seam |
| `components/orvek-v0-canonical/live-provider.ts` | Live seam |
| `components/orvek-v0-reference-frozen/**` | Cold package (do not edit) |
| `components/orvek-v0/pages/*` | Inactive parallel presentation |

---

## What is not claimed

- Visual parity of fixture canonical vs cold authority
- Visual parity of production vs cold authority
- Complete live action / durable-control parity with the old parallel pages
- Full repo verification green
- Merge / PR readiness

---

## Next exact step

1. Start the app and run **Step 4 only**: 1440×900 path comparison of
   `/dev/orvek-v0-reference` ↔ `/dev/orvek-v0-canonical-reference`
   for Today → objects → linked → Back → Evidence/Movement → report overlay → Map → Decisions → Explore → Timeline.
2. Capture paired screenshots into this campaign’s `screenshots/` (or a new `screenshots/canonical-fixture-gate/` folder) and write a short pass/fail matrix.
3. Only if that fixture gate passes: audit live provider depth + durable/Explore controls, then re-run targeted verification.
4. Only then may an agent return `READY FOR KAY CANONICAL HARD-SWAP REVIEW`.

Until Step 4 is proven, the correct standing verdict remains:

**FAIL — CANONICAL HARD SWAP INCOMPLETE**
