# 13 — Referee result

## Status

**NOT_RUN on all three cases**

| Metric | Value |
|--------|-------|
| refereeCallCount (LiveProofResult) | 0 |
| clear case refereeExecutionState | not_run |
| compatible case refereeExecutionState | not_run |
| ambiguous case refereeExecutionState | not_run |

## Why

- Clear case stopped at deterministic validation (internal inconsistency) —
  never became Class A eligible for referee.
- Compatible case accepted as non–Class A (`compatible_states`) — referee not
  applicable for ContradictionNode continuation.
- Ambiguous case abstained — no Class A selection.

No referee proof obtained. This contributes to
`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED` (authority path incomplete on clear /
ambiguous; no clear write path).
