# 10 — Result for Kay

## READY FOR WAVE 2.1 — CONTRADICTION MAP PROJECTION PASS

**Branch:** `desktop-contradiction-map-conflict-projection-001`
**Baseline:** staging @ `e3b79ed`
**Commit:** none (uncommitted; do not commit/push until Kay requests)

---

### What read path was added

- Reused authenticated `GET /api/contradiction?status=open`
- Client: `fetchMapOpenContradictions()` in `lib/map-open-contradictions.ts`
- Wired through hybrid Map provider into `MapMapDataInput.openContradictions`

### What Map rail now consumes

- Canonical Map **Active conflicts** (`conflicts`)
- Open ContradictionNode projected as `contradiction-<rawId>` with kind `contradiction`
- Disputed UserMapConclusion conflicts still work alongside

### Composition still masks other live rails?

**YES.** Full composition ownership of unrelated Map rails / Timeline / Decisions / Explore remains. Only a **conflicts-specific** live ContradictionNode overlay was added (`mergeLiveContradictionConflicts`).

### Live vs synthetic conflicts

| Form | Meaning |
|------|---------|
| `contradiction-<cuid>` + `inspectorObjectType=contradiction_node` | Live open CN |
| `m-conflict-*` | Composition seed (retained) |
| `conclusion-<id>` disputed UMC | Live disputed conclusion |

### Inspector selection

Click → rail id → ProductionInspectorBridge → `contradiction_node` → fetch by raw CN id. No UMC fallback when metadata is set.

### Human verification (final)

**HUMAN CLICK GATE PASS** on `/dev/contradiction-map-projection`:

- Initial selection: Fixture claim (dev only)
- Click contradiction → centre + Inspector switched
- Truthful Side A / Side B; no fabricated Model Movement
- Refresh reconstruction PASS
- `/your-map` unaffected

Not counted as Kay live open-CN proof (account still 0 open). Wave 2.1 remains the genuine accept proof.

### Test / gate results (final closeout)

| Gate | Result |
|------|--------|
| Focused Wave 1.1 | **18/18 PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| Full suite | 5 files / 7 tests fail — **exact match** baseline `e3b79ed` |
| Account inventory | pending 53 / RI 28 / CN 25 / chicken active / patterns 7 / MU 1 / UEL 50 — **matchesExpected true** |
| `git diff --check` | **PASS** |
| Human click gate | **PASS** |

### Explicit confirmations

| Item | Value |
|------|-------|
| Kay database mutation | **NO** |
| Wave 2.1 readiness | **YES** |
| Production readiness | **NO** |
| Human click gate | **PASS** |
| Ready to commit | **YES** (await Kay request — not committed in this run) |

### Remaining boundaries

- Do not accept a Kay candidate until Wave 2.1 safety contract
- Do not remove composition / global Map mock cutover
- Do not claim production readiness
- Commit only when Kay requests

---

## Changed product files

- `lib/map-open-contradictions.ts` (new)
- `lib/map-contradiction-projection-fixture.ts` (new)
- `lib/orvek-adapters/map.ts`
- `lib/orvek-v0/production/map-api.ts`
- `lib/orvek-v0/production/map-selection.ts`
- `lib/orvek-v0/production/hybrid-workbench-api.ts`
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
- `components/orvek-v0-canonical/workbench.tsx` (optional fixture bootstrap slot)
- `components/orvek-v0-canonical/contradiction-map-projection-fixture-entry.tsx` (new)
- `app/dev/contradiction-map-projection/page.tsx` (new)

## Changed test files

- `lib/__tests__/map-open-contradictions.test.ts` (new)
- `lib/__tests__/map-contradiction-projection.test.ts` (new)
- `lib/__tests__/map-contradiction-read-api-security.test.ts` (new)

## Receipts

`docs/agent-runs/receipts/CONTRADICTION-MAP-CONFLICT-PROJECTION-001/00`–`10` (+ `readonly-gate-output.txt`)
