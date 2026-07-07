# Desktop Product UX Completion Audit — Intake

**Slice:** `DESKTOP-PRODUCT-UX-COMPLETION-AUDIT-001`  
**Branch:** `desktop-product-ux-completion-audit-001`  
**Baseline commit:** `8ef094a` (staging — PR #96–#101 hard-swap guard stack closed)  
**Date:** 2026-07-07  
**Mode:** Product UX audit + receipts + prioritized blocker map (not a plumbing slice)

**Production-ready: NO**

---

## Context

The desktop hard-swap guard stack is closed. Root workbench architecture, reference route integrity, old-route/shell quarantine, and Free Explore post-send honesty are protected by tests. This audit asks a different question:

> What still stops the Orvek desktop from feeling like a **complete product** now that the shell is stable?

This is a **product surface** audit — not a regression sweep of plumbing.

---

## Audit scope

| Area | Question |
|------|----------|
| **Today** | Re-entry surface clarity; what changed / what matters / what to do next; honest sparse states; connections to decisions, questions, fieldwork, movement, reports |
| **Map** | Durable user model feel; inspectability; evidence linkage; ontology clarity; sparse usefulness |
| **Timeline** | Semantic evolution (not calendar); movement framing; distinct from Today |
| **Decisions** | Real decision-tracking; status/tradeoffs/lineage; quick vs deep; evidence/report links |
| **Explore** | “Talk to your model” vs generic chat; tab separation; grounding honesty; inspector support; send polish |
| **Inspector** | Object explanation; meaningful tabs; evidence vs inference; movement framing |
| **Cross-surface continuity** | Life Data → Signal → Object → Movement → Map/Today/Timeline → Report → Re-entry |
| **Product honesty** | Copy/UI that implies fake evidence, memory, receipts, movement, or completion |

---

## Constraints (hard rules)

- Do **not** restore old production shell or route-first pages
- Do **not** change hard-swap architecture
- Do **not** move bridges back into old route pages
- Do **not** use global `displayContract: production`
- Do **not** remove `createMockOrvekDataApi()`
- Do **not** enable send on `/dev/orvek-v0-reference`
- Do **not** fake evidence, receipts, movement, memory, or model updates
- Do **not** call the app production-ready
- Do **not** make broad product code changes in this slice

---

## Deliverables

1. `00-intake.md` — this file
2. `01-surface-audit.md` — per-surface findings
3. `02-blocker-priority-map.md` — P0/P1/P2 blockers with classification
4. `03-next-slice-plan.md` — recommended next 3–7 slices

---

## Verification at intake

Guard stack remains green at baseline (see closeout receipt for full stack). Core guard bundle re-run during this audit:

- `npx tsc --noEmit` — PASS
- Trust / legacy surface scripts — PASS
- Core guard vitest (95 tests) — PASS

**Production-ready: NO**
