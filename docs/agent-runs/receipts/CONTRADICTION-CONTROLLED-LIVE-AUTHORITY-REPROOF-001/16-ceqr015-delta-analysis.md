# 16 — CEQR-015 delta analysis

## Baseline (CEQR-015)

Historical live hold: `HOLD_LIVE_EVIDENCE_FAILURE_PERSISTS` with

- `fabricated_quote` on clear + compatible
- `source_id_mismatch` on ambiguous

## CEQR-017 live delta (this run)

| Previous code | Relevant case(s) | Class | Reason |
|---------------|------------------|-------|--------|
| fabricated_quote | clear_contradiction_candidate | **INCONCLUSIVE** | Stopped at deterministic_validation (changedBeliefOverTime inconsistency) before binding / quote authority proof |
| fabricated_quote | compatible_contextual | **RESOLVED** | Transport parsed; binding succeeded; authoritative source IDs matched; derived quotes equal authoritative slices; fabricated_quote did not recur |
| source_id_mismatch | ambiguous_insufficient | **INCONCLUSIVE** | Model abstained; binding not reached |

## What this proves

- Compatible case demonstrates CEQR-016 authority repair can succeed live for
  that fixture (no fabricated quote; bound IDs; exact slices).
- Clear and ambiguous cases did **not** re-prove or disprove the historical
  fabricated_quote / source_id_mismatch failures — paths incomplete.
- New live blocker on clear: semantic-field inconsistency
  (`clear_contradiction` + `changedBeliefOverTime: true`), not fabricated_quote.

## What this does not prove

- Live Class A selection + referee + writer for clear case
- RESOLVED fabricated_quote on the clear fixture
- RESOLVED source_id_mismatch on the ambiguous fixture
- Production readiness
