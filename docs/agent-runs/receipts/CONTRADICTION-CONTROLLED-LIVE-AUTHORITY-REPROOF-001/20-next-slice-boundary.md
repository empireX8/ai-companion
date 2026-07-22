# 20 — Next slice boundary

## Recommended next task (do not implement in CEQR-017)

**Name:** `CONTRADICTION-LIVE-SEMANTIC-CONSISTENCY-REPAIR-001`

## Focus (narrow)

1. Semantic field consistency for `clear_contradiction` — especially
   `changedBeliefOverTime` interaction (provider still emits forbidden true
   despite prompt + live addendum hard rules).
2. Evidence-span semantic adequacy — truncated but authoritative quotes such as
   compatible Side B `I drink coffee in the morni`.
3. Maintain deterministic source authority (offsets → code-owned sourceId /
   exactQuote); no fabricated-quote regressions.
4. **Do not weaken** deterministic validation rules.
5. **Do not** re-run the CEQR-017 live provider inside this slice; any future
   live proof requires a new authorised claim under a new slice.

## Out of scope for the next slice unless explicitly authorised

- Schema / route / persistence changes unrelated to the consistency gap
- Softening fail-closed internal_inconsistency checks
- Rewriting historical CEQR-011…016 receipts
- Using the existing CEQR-017 `phase2-live-run-claim.json` for a second live run

## CEQR-017 closeout posture

CEQR-017 live campaign result remains
`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`. Production readiness remains **NO**.
