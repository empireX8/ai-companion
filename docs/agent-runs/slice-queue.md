# Slice Queue

> One **In Progress** slice at a time. Update **Status** when a slice moves phase.

**Status values:** `Queued` | `In Progress` | `Blocked` | `Partial` | `Done`

---

## INSPECTOR-001 — Inspector Evidence/Context acceptance closeout

| Field | Value |
|-------|-------|
| **Slice ID** | INSPECTOR-001 |
| **Title** | Inspector Evidence/Context acceptance closeout |
| **Objective** | Confirm Slice A (presentation) + Slice B (route contract) are product-acceptable on golden object **GOLDEN-INSPECTOR-001** |
| **Product Intelligence Target** | 3 (Coherent) |
| **Build Loop Target** | 2 |
| **Golden object** | GOLDEN-INSPECTOR-001 |
| **Acceptance object/route** | `cmq6h8ewn0000qlbwlg485jx1` → Evidence/Context + Mind Model Movement |
| **Reference surface** | `UserMapEvidencePanel` formula + Reality-Tracking Movement report |
| **Out of scope** | Schema, new pages, Explore/Timeline, provider wrap |
| **Required checks** | `verify-mindlab.sh`, `check-legacy-inspector-routes.ts`, `07-product-intelligence-scorecard.md`, Kay B1–B5 |
| **Status** | Blocked — awaiting Kay scorecard + acceptance on `inspector-evidence-contract` |

---

## INSPECTOR-002 — Inspector back button / object history

| Field | Value |
|-------|-------|
| **Slice ID** | INSPECTOR-002 |
| **Title** | Inspector back button / object history |
| **Objective** | After drill-down from GOLDEN-INSPECTOR-001 evidence, user returns to prior selection |
| **Product Intelligence Target** | 3 |
| **Build Loop Target** | 2 |
| **Golden object** | GOLDEN-INSPECTOR-001 |
| **Acceptance object/route** | Workbench Inspector pattern/signal drill-down |
| **Out of scope** | Global nav redesign, schema |
| **Required checks** | Scorecard regression row G4 + back navigation |
| **Status** | Queued |

---

## LOOP-001 — AI Build Loop Harness v0.1

| Field | Value |
|-------|-------|
| **Slice ID** | LOOP-001 |
| **Title** | AI Build Loop Harness v0.1 |
| **Objective** | Queue, templates, prompts, mechanical checks |
| **Product Intelligence Target** | N/A |
| **Build Loop Target** | 2 |
| **Status** | Done |

---

## LOOP-002 — Product Intelligence Benchmark

| Field | Value |
|-------|-------|
| **Slice ID** | LOOP-002 |
| **Title** | Product Intelligence Benchmark layer |
| **Objective** | Golden objects, scorecard template, benchmark docs, closeout regression enforcement |
| **Product Intelligence Target** | N/A |
| **Build Loop Target** | 2 → 2.5 (objective product measurement) |
| **Golden object** | Seeds GOLDEN-INSPECTOR-001 |
| **Out of scope** | Product UI, schema, runtime changes |
| **Required checks** | `verify-mindlab.sh`, harness tests, `check-agent-closeout.ts` on updated template |
| **Status** | In Progress |

---

## Adding a slice

Minimum fields: Slice ID, Title, Objective, Product Intelligence Target, Build Loop Target, Golden object (if product), Acceptance route, Out of scope, Required checks, Status.
