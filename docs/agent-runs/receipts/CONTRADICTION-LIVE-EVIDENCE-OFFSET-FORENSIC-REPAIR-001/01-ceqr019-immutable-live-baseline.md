# 01 — CEQR-019 immutable live baseline

## Immutable facts (must not change)

| Fact | Value |
|---|---|
| Offline harness | `PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY` |
| Live result | `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN` |
| Live provider attempts | 3 |
| Adjudicator calls | 3 |
| Referee / writer / persistence / account / database | all 0 |
| Production readiness | NO |

## Canonical hashes (landed; verified this slice)

See `ceqr019-hash-verification.json`.

- `live-execution-receipt.json` SHA-256: `74c12305a2dc15d166a37c6a054158996016f0bc66c6236d42a16868d1798e58`
- `live-run-oneshot-claim.json` SHA-256: `0973a66f6c1b36fbef77625d435b83c14ee14cbf5530cf9c5d324d7b5504a65c`
- `ceqr019-permanent-claim.json` SHA-256: `13f497f29a31021a023e2f9ce03c7af0f27f005a9025b9792f311d6c25e9c357`

## Forensic gap in CEQR-019 receipt

- `evidenceA` / `evidenceB` are null on all three cases.
- Sanitized diagnostics retained lengths only; `evidenceFailureSide: "unknown"`.
- Raw `startOffset` / `endOffset` were **not** retained.
- Therefore CEQR-019 exact failing sides/offsets are **UNKNOWN** unless recovered
  from another immutable artifact (CEQR-017 retained analogous truncations).

CEQR-019 live execution is immutable. CEQR-020 live provider attempts are 0.
