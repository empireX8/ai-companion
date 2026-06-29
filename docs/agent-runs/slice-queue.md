# Slice Queue

> One **In Progress** slice at a time. Update **Status** when a slice moves phase.

**Status values:** `Queued` | `In Progress` | `Blocked` | `Partial` | `Done`

---

## INSPECTOR-001 — Inspector Evidence/Context acceptance closeout

| Field | Value |
|-------|-------|
| **Slice ID** | INSPECTOR-001 |
| **Title** | Inspector Evidence/Context acceptance closeout |
| **Objective** | Confirm Slice A (presentation) + Slice B (route contract) are product-acceptable on acceptance record `cmq6h8ewn0000qlbwlg485jx1` |
| **Product Surface Target** | 3 (Coherent) |
| **Build Loop Target** | 2 (Agent stops at screenshot gate with full receipts) |
| **Acceptance object/route** | Workbench Inspector → model_update `cmq6h8ewn0000qlbwlg485jx1` → Evidence/Context + Mind Model Movement tabs |
| **Reference surface** | Direct map conclusion inspector (`UserMapEvidencePanel` formula) + Reality-Tracking Movement report |
| **Out of scope** | Schema, new pages, Explore/Timeline, provider wrap, full reference_item hydration |
| **Required checks** | `verify-mindlab.sh`, `check-legacy-inspector-routes.ts`, Kay screenshots S1–S4 + B1–B5 |
| **Status** | Blocked — awaiting Kay product acceptance on branch `inspector-evidence-contract` |

---

## INSPECTOR-002 — Inspector back button / object history

| Field | Value |
|-------|-------|
| **Slice ID** | INSPECTOR-002 |
| **Title** | Inspector back button / object history |
| **Objective** | After opening linked evidence in Inspector, user can return to prior selection without losing workbench context |
| **Product Surface Target** | 3 (Coherent) |
| **Build Loop Target** | 2 |
| **Acceptance object/route** | Workbench Inspector — pattern/signal drill-down from movement evidence |
| **Reference surface** | v0 inspector navigation patterns (if any); otherwise spec-first |
| **Out of scope** | Global nav redesign, browser history replacement, schema |
| **Required checks** | `verify-mindlab.sh`, manual click path B2 + back |
| **Status** | Queued |

---

## LOOP-001 — AI Build Loop Harness v0.1

| Field | Value |
|-------|-------|
| **Slice ID** | LOOP-001 |
| **Title** | AI Build Loop Harness v0.1 |
| **Objective** | Add queue, receipt templates, prompts, and mechanical checks; move Build Loop toward score 2 |
| **Product Surface Target** | N/A (meta slice) |
| **Build Loop Target** | 2 |
| **Acceptance object/route** | `docs/agent-runs/`, `prompts/orvek-*.md`, `scripts/check-*.ts` |
| **Reference surface** | Inspector workflow experiment receipts |
| **Out of scope** | Product UI, schema, runtime behavior changes |
| **Required checks** | `verify-mindlab.sh`, closeout script sanity, legacy inspector route check |
| **Status** | In Progress |

---

## Adding a slice

Copy a block above. Minimum fields: Slice ID, Title, Objective, Product Surface Target, Build Loop Target, Acceptance object/route, Out of scope, Required checks, Status.
