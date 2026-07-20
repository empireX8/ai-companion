# 07 — Phase A non-mutation verification

> **Historical — Phase A only.** Campaign closed **FAIL** — see `13-wave-2-1-controlling-result.md`.
> Do not proceed to candidate lock or Accept from Phase A outputs.

**After all Phase A work completed**
**Inventory rerun timestamp:** `2026-07-20T08:33:24.258Z` (see `readonly-intelligence-inventory.json` → `queriedAt`)

---

## Comparison: before vs after Phase A

| Gate | Before Phase A | After Phase A | Match |
|------|----------------|---------------|-------|
| pending total | 53 | **53** | ✓ |
| ReferenceItem pending | 28 | **28** | ✓ |
| ContradictionNode pending | 25 | **25** | ✓ |
| open genuine CN | 0 | **0** | ✓ |
| chicken-burger active | 1 | **1** | ✓ |
| PatternClaims | 7 | **7** | ✓ |
| ModelUpdates | 1 | **1** | ✓ |
| UnderstandingEvidenceLinks | 50 | **50** | ✓ |
| Selected RI status | active | **active** | ✓ |
| Selected RI updatedAt | `2026-07-19T14:14:39.275Z` | **unchanged** | ✓ |
| CN statuses | all candidate | **all candidate** | ✓ |
| `matchesExpected` | true | **true** | ✓ |

**Before/after Phase A account gate: IDENTICAL**

---

## Mutation checks

| Check | Result |
|-------|--------|
| `POST /api/import-review/candidates/[key]/decide` called | **NO** |
| Prisma write methods in campaign scripts | **NONE** (select/count only) |
| Kay database mutated | **NO** |
| Candidate lock applied | **NO** |
| Human Accept performed | **NO** |

---

## Scripts executed (read-only)

| Script | Purpose |
|--------|---------|
| `INTELLIGENCE-COMPATIBILITY-AUDIT-001/readonly-intelligence-inventory.mjs` | Gate (×2) |
| `SINGLE-REAL-CONTRADICTION-MATERIALISATION-PROOF-001/readonly-contradiction-candidate-shortlist.mjs` | CN shortlist |

---

## Side effect note

Re-running the shared inventory script updates `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/readonly-intelligence-inventory.json` timestamp only (read-only query output). No product files modified.

---

## Phase A verdict (superseded)

Phase A initially returned **READY FOR HUMAN CANDIDATE LOCK — NO MUTATION**.
Phase A2 and final closeout superseded that outcome. **Final verdict: FAIL — NO TRUSTWORTHY CONTRADICTION CANDIDATE FOUND** (`13-wave-2-1-controlling-result.md`).
