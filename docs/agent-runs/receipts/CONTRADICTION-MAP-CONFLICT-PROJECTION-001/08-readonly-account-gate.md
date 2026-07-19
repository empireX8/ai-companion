# 08 — Read-only account gate

**Script:** `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/readonly-intelligence-inventory.mjs`
**Captured:** `readonly-gate-output.txt` (same directory) — final closeout run

## Gate

| Check | Expected | Observed |
|-------|----------|----------|
| pending total | 53 | 53 |
| ReferenceItem pending | 28 | 28 |
| ContradictionNode pending | 25 | 25 |
| chicken-burger ReferenceItem active | 1 | 1 (active) |
| PatternClaims | 7 | 7 |
| ModelUpdates | 1 | 1 (`cmq6h8ewn…`) |
| ContradictionNode open | 0 | 0 (all 25 candidate) |
| UnderstandingEvidenceLinks total | unchanged | 50 |
| matchesExpected | true | **true** |

## Mutation confirmation

- Inventory script is read-only (select/count only).
- Campaign Map CN projection paths use GET only.
- No candidate status changes (CN all still `candidate`).
- No new ModelUpdates.
- UEL total remains 50 (no new UELs from this campaign).
- Composition seed still present (`full_reference_round_trip_seed`).

**Kay database mutation: NO**
