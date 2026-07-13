# Checkpoint 1 — Canonical Movement Report Contract

**Result:** **PASS**

---

## Contract module

`lib/model-movement-report-contract.ts`

| Type | Purpose |
|---|---|
| `CanonicalMovementReport` | Single production contract: affected object, before, after, evidence status, rationale, report identity |
| `ModelMovementDepthRecord` | Workbench-safe depth row (no `beforeSummary` field names) |
| `ModelMovementDepthById` | Shared index for Today/Timeline/hybrid |
| `resolveCanonicalMovementReportFromDepth()` | Report readiness + explicit blockers |
| `buildMovementReportOrvekObject()` | Registers openable report object at **model update id** |
| `enrichOrvekObjectWithMovementDepth()` | Hydrates Orvek objects without zip substitution |

**Report identity:** `reportId === modelUpdateId === canonicalReportId`

**Readiness gate:** requires recorded before **and** after, movement summary, ≥1 evidence link, **and** durable movement rationale. Missing rationale blocks `reportReady` and full-report affordances.

---

## Anti-substitution rules (unchanged + tightened)

| Rule | Module |
|---|---|
| No zip report when live object missing | `today-movement-report-parity.ts` |
| No global movement for selected object | `mustNotSubstituteGlobalMovementForSelectedObject` |
| No fake before from current summary | Timeline adapter no longer maps `userFacingSummary` → `afterSummary` |
| Reference `rep-weekly` stripped without live report | `today-adapter-honesty.ts` |

---

## Distinction guarantees

| Field | Distinct from |
|---|---|
| `movementSummary` | Evidence quote text |
| `movementRationale` | Movement summary and evidence (validated in `model-movement-rationale.ts`) |
| `before` / `after` | Current object state inference (must be stored snapshots) |

---

## Tests

`lib/__tests__/model-movement-report-contract.test.ts` — **6 passed**
