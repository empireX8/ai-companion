# Intake Receipt — SLICE-002

**Date:** 2026-06-29  
**Branch:** `chapter-inspector-001-slice-002-tab-boundary`  
**Agent:** `codex`

---

## Slice

| Field | Value |
|-------|-------|
| Slice ID | `SLICE-002` |
| Title | Tab boundary cleanup |
| Queue status | `Ready → In Progress` |

---

## Objective

Make the Workbench Inspector tabs coherent for `GOLDEN-INSPECTOR-001`: the selected `model_update` Evidence / Context tab should show the affected object, context, backing evidence, and receipts only, while the Mind Model Movement tab remains the single place for the epistemic report, including “What would change this conclusion.”

---

## Allowed

- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/inspector/panels/ModelMovementInspectorPanel.tsx` only if boundary preservation requires it
- `lib/__tests__/inspector-surface-wiring.test.ts`
- `lib/__tests__/inspector-evidence-presentation.test.ts`
- `docs/agent-runs/chapter-queue.md`
- receipt files under `docs/agent-runs/receipts/CHAPTER-INSPECTOR-001/SLICE-002/`
- Requested verification commands for inspector routes, closeout validation, build, and repo verification

---

## Forbidden

- `SLICE-003` movement epistemic clarity redesign
- `SLICE-004` polish
- Inspector back button or history
- Schema changes
- New API routes
- Non-Inspector surfaces
- Legacy route rewrites

---

## Acceptance anchor

| Field | Value |
|-------|-------|
| Record / route | Today workbench → select model update `cmq6h8ewn0000qlbwlg485jx1` → Inspector tabs |
| User / env | Local repo harness using affected conclusion `cmq6frqdx0000ql8h6nkavzue` |

---

## Scores at intake

| Metric | Before |
|--------|--------|
| Product Intelligence | `2` |
| Build Loop | `2` |

---

## Planned slice prediction

| Field | Value |
|-------|-------|
| Expected Product Intelligence Score | `2 → 3` |
| Expected Build Loop Score | `2 → 2` |
| Why this slice should move the score | Removing the duplicated / misplaced change-condition block from Evidence / Context should make the two inspector tabs read as separate roles instead of one overlapping dump. |
| What would prove the slice failed | The selected `model_update` Evidence / Context tab still shows movement-only change conditions, the Movement tab loses “What Would Change This Conclusion,” or legacy evidence navigation leaks back out of the inspector. |

---

## Golden object (if product slice)

| Field | Value |
|-------|-------|
| Golden ID | `GOLDEN-INSPECTOR-001` |
| Record ids | Movement `cmq6h8ewn0000qlbwlg485jx1`; conclusion `cmq6frqdx0000ql8h6nkavzue` |

---

## Open questions for Kay

- None for implementation. Screenshot acceptance remains pending after verification.

**Proceed to 01 target UI/spec:** yes
