# 01 — CEQR-013 to CEQR-015 failure evidence

## CEQR-013 (addendum v1)
All three adjudicator calls reached deterministic evidence validation and failed:
- clear: `fabricated_quote`
- compatible: `fabricated_quote`
- ambiguous: `source_id_mismatch`

## CEQR-014 (addendum v2)
Prompt strengthened to require character-for-character `sourceId` and `exactQuote` copying. No output mutation.

## CEQR-015 (v2 live rerun)
Classification: `HOLD_LIVE_EVIDENCE_FAILURE_PERSISTS`

Same three failure codes recurred under v2:
- clear: `fabricated_quote` + `clear_contradiction_requires_valid_spans`
- compatible: `fabricated_quote`
- ambiguous: `source_id_mismatch`

## Conclusion
Prompt-only repair cannot make model-authored `sourceId` / `exactQuote` reliable. Structural authority repair is required.
