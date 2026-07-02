# Implementation Receipt

Files changed:
- `components/inspector/InspectorContext.tsx`
- `components/inspector/InspectorEvidenceSelectionControl.tsx`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/inspector/panels/ModelMovementInspectorPanel.tsx`
- `lib/inspector-evidence-presentation.ts`
- `lib/__tests__/inspector-evidence-presentation.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`

Implementation summary:
- Added Inspector-local selection history with `pushObject`, `goBack`, `canGoBack`, and `backTarget`.
- Switched evidence click-through to Inspector-local history instead of one-way selection replacement.
- Added local back affordances to object and movement Inspector headers.
- Reworked selected-object evidence sections into explicit readouts:
  - current understanding
  - why Orvek thinks this
  - current read
  - supporting signals
  - supporting evidence
  - conflicting evidence
  - related background / context
  - related objects
  - what could change this read
  - missing or unavailable evidence
  - correct the model
- Reworked movement detail sections into clearer labels:
  - evidence strength / confidence
  - evidence used
  - why Orvek thinks this
  - what Orvek infers
  - weak or uncertain
  - guardrails / confidence
  - pattern context
  - what changed
  - reality check
  - watch for next
  - re-entry
  - what could change this read
- Added structured clause splitting for dense inspector and movement text.
- Added user-facing sanitization for path-like and opaque ID-like display strings.
- Replaced vague unavailable states with explicit in-view-unavailable copy.
- Removed `Linked path` and `Open linked path/record` wording from user-facing Inspector states.
- Restored visible `Correct the model` actions with honest non-persistence wording.

Implementation boundary held:
- no schema changes
- no middleware changes
- no auth changes
- no route creation
- no navigation changes
- no mobile changes

