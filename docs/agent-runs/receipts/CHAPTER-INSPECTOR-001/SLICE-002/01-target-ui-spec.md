# Target UI Spec — SLICE-002

**Date:** 2026-06-29  
**Rule:** Synthesize reference + contract. Do not blind-copy v0 if Reality-Tracking or product truth requires different tab roles.

---

## Surfaces in scope

| Surface | Role |
|---------|------|
| Evidence / Context tab for selected `model_update` | Show affected object, related context, supporting evidence, and receipts without duplicating the epistemic movement report |
| Mind Model Movement tab for selected `model_update` | Show the epistemic report only: facts, supported claims, inferences, uncertainties/speculations, guardrails, model movement, reality gate, watch-for, re-entry action, and what would change this conclusion |

---

## Reference gets right

- The direct conclusion Evidence / Context surface already has a usable object/context section formula and may continue to show stored conclusion-specific change conditions when the conclusion itself is selected.
- Evidence cards and continuity blocks already keep the inspector in the workbench and should remain unchanged.

---

## Contract / Reality-Tracking requires

- Selected `model_update` Evidence / Context must not duplicate “What would change this conclusion.”
- The Movement tab remains the only place for the movement report and its change-condition section.
- Route-safe in-inspector evidence selection must remain intact.

---

## Section list (target)

| Section | Content | Must not show |
|---------|---------|---------------|
| Evidence / Context | Movement summary, affected object continuity, related map conclusion or related object context, supporting evidence, receipts | `facts`, `inferences`, `speculations`, `guardrails`, `watch-for`, `re-entry action`, `what would change this conclusion` |
| Mind Model Movement | Evidence packet summary, linked receipts, facts, strongly supported claims, inferences, speculations / uncertainties, guardrails, pattern detection, model movement, reality gate, watch-for, re-entry action, what would change this conclusion | Duplicated Evidence / Context receipts list behavior changes, legacy route leakage |

---

## Card / row spec (if applicable)

| Field | Source |
|-------|--------|
| Primary label | Existing `projectInspectorEvidenceCard()` title resolution |
| Secondary | Existing source kind, role label, and linked date |
| Action | `InspectorEvidenceSelectionControl` only; no legacy `/patterns` or `/contradictions` link navigation |

---

## Navigation contract

| Linked type | Behavior |
|-------------|----------|
| `pattern_claim` | Inspector-selectable via `InspectorEvidenceSelectionControl` |
| `contradiction_node` | Inspector-selectable via `InspectorEvidenceSelectionControl` |
| Receipt refs | Inspector-selectable via `InspectorEvidenceSelectionControl` when resolvable |
| Selected `model_update` change conditions | Available only on the Mind Model Movement tab |

**Forbidden:** legacy `/patterns` or `/contradictions` navigation from the workbench inspector

---

## Kay sign-off

- [ ] Tab roles approved
- [ ] Navigation contract approved

**Approved to implement:** yes
