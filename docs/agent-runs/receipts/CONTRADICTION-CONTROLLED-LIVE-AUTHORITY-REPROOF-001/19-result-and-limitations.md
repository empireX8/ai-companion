# 19 — Result and limitations

## Post-live classification

`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`

Exit code: **4**

## Production readiness

**NO**

## What the authorised live run proved

- Orchestrator ran exactly once with pinned runtime identities matched
- Account before/after gates matched; aggregates unchanged; no real-account write
- Compatible fixture: fabricated_quote **RESOLVED** under CEQR-016 authority
- Clear fixture: failed closed on semantic-field inconsistency before binding
- Ambiguous fixture: safe abstention; source_id_mismatch **INCONCLUSIVE**
- Referee never reached; writer never invoked; no ContradictionNode created

## Clear-case root cause (summary)

Provider supplied `changedBeliefOverTime: true` with
`classification: clear_contradiction`. Deterministic validation rejected that
pair. Prompt and live addendum already forbid the combination. No CEQR-017 patch.

## Compatible-case adequacy note

Bound Side B quote `I drink coffee in the morni` is an exact authoritative
slice (offsets 0–27) but semantically truncated — evidence-span adequacy
concern, not fabricated_quote / source-authority failure.

## Explicit non-claims

- Live Class A + referee + writer success
- fabricated_quote RESOLVED on clear
- source_id_mismatch RESOLVED on ambiguous
- Production readiness

## Artifacts retained

- `phase2-live-run-claim.json` (never delete / recreate)
- `account-gate-before.json` / `account-gate-after.json`
- `live-execution-receipt.json`
