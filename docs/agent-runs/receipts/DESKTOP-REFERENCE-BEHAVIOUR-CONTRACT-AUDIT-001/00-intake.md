# DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001 — Intake

**Baseline:** `8938091` (staging)  
**Branch:** `desktop-reference-behaviour-contract-audit-001`  
**Production-ready:** NO

---

## Purpose

Document the **accepted reference-style product behaviour** at root workbench (`8938091`) as an explicit contract. Future live-data work must preserve these interaction affordances — not merely merge API payloads.

This audit exists because the aborted `desktop-surface-live-mode-gating-001` slice proved that **data presence without behaviour parity degrades the product**, even when automated tests pass.

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| Today, Evidence Pointer, Model Movement, Report opening, Inspector, Explore | Implementing per-surface live gating |
| Accepted reference presentation at root (`isProductionDisplay === false`) | Setting global `displayContract: production` |
| Free Explore live honesty guards (PR #97/#99) | Restoring old route-first pages |
| Cross-surface navigation via workbench store | Faking evidence, receipts, movement, or memory |
| Anti-regression rules for future live replacement | Committing product code |

---

## Why the previous live-mode slice was aborted

**Branch:** `desktop-surface-live-mode-gating-001` (never committed)

**What it attempted:** Per-surface live readiness gating so v0 pages could render merged live Today/Map/Timeline/Decisions data without global `displayContract: production`.

**Why it failed PO runtime review:**

1. **Today** switched from coherent reference cards/language to raw live intelligence-update hero copy ("Conclusion Added · Related map item") without equivalent Inspector movement/evidence linkage.
2. **Today ↔ Inspector split-brain:** Hero offered "See why it moved" / model-movement framing, but Inspector opened objects with **no before/after record**, then pointed users at unrelated "Recent model movement" fixtures below.
3. **Evidence Pointer** rows became non-actionable or misleading relative to the accepted clickable receipt path.
4. **Explore** movement CTA opened Inspector movement context dominated by Today/global fixtures, regressing Free Explore honesty.
5. **Buttons** that were understandable in reference mode became confusing when live primary-action wiring surfaced (disabled vs active mismatches).

**Lesson:** Live data replaced reference **presentation** before it could replace reference **interaction contracts**. The app became more live technically and worse product-wise.

---

## Audit method

- Code audit at `8938091` (clean tree; HEAD matches baseline).
- Source files: `components/orvek-v0/pages/*`, `evidence-panel.tsx`, `top-bar.tsx`, `lib/orvek-v0/mock-api.ts`, `lib/orvek-v0/orvek-data.ts`, `lib/orvek-v0/production/hybrid-workbench-api.ts`, `lib/orvek-v0/display-contract.ts`, guard test suites.
- PO manual verification reported accepted staging restored locally.

---

## Deliverables

| File | Contents |
|------|----------|
| `01-today-contract.md` | Today + Evidence Pointer + movement/report/button contracts |
| `02-inspector-report-evidence-contract.md` | Inspector tabs, movement/report separation, evidence linkage |
| `03-explore-contract.md` | Free Explore honesty, reference route |
| `04-live-data-replacement-rules.md` | Anti-regression rules + proposed safer slices |

---

## Production-ready: NO

Root workbench remains reference-presented with hybrid live merges underneath. Known P0/P1 gaps from PR #102 audit remain open; this receipt documents **accepted behaviour to preserve**, not completion.
