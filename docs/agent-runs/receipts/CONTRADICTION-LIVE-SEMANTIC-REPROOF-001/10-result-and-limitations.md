# 10 — Result and limitations

## Offline harness (unchanged truth)

`PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY`

The offline harness, dual guards, strict PASS contract, and write-isolation
proofs remain valid preparation. Offline success is not live proof.

## Live execution (final, immutable)

`FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN`

Exit code: `5`

Provider attempts: `3` (adjudicator `3`, referee `0`).
Writer / persistence / account-gate / real database calls: all `0`.
Production readiness: `NO`.

All three frozen cases failed closed at deterministic lexical-boundary
validation. See `11-live-execution-result.md` and
`12-post-live-forensic-boundary.md`.

## Strict PASS contract (still the acceptance bar)

`PASS_LIVE_SEMANTIC_REPROOF` still requires inspectable case observations for
all three frozen cases with the corrected clear / non-clear matrix. That bar
was **not** met by this live run.

## Historical integrity

| Artifact | SHA-256 |
|---|---|
| CEQR-017 live receipt | `b620aa7f718d4ace768a9a518a4d8cb32ca1b54662291280b3f6545fb5514fdd` |
| CEQR-017 permanent claim | `f313cbafb264f84d158a8aee20ca2276520fbf85940be7f910b87bead2c5cef0` |
| CEQR-018 receipts | unchanged (per-file hashes asserted in offline tests) |

## Forensic limit

Failed transport offsets / failing side / raw provider selections are not
sufficiently preserved in the live receipt to name a root cause. That is a
next-slice concern (`13-next-repair-slice-boundary.md`), not a CEQR-019 re-run.
