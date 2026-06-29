# Current State Check

Verdict: the audit gap was real, not stale.

Observed before repair:
- `SelectedObjectEvidencePanel.tsx` still led the `model_update` evidence tab with `ORVEK_COPY.mindModelMovement`.
- The same branch rendered a `Movement summary` block.
- The same branch injected `whatWouldChangeItems` from `report.whatWouldChangeThisConclusion`.
- The evidence tab could therefore duplicate Mind Model Movement copy instead of opening on affected-object context.

Boundary already owned elsewhere:
- `components/inspector/panels/ModelMovementInspectorPanel.tsx` already owns the epistemic movement report, including `What Would Change This Conclusion`.

