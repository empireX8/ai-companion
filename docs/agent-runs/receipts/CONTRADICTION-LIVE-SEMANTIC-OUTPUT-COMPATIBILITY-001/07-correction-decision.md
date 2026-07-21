# 07 — Correction decision

## Decision

`HOLD_FAILURE_EVIDENCE_INSUFFICIENT`

Proven defect addressed: sanitized failure observability.

Not addressed (unknown / deferred): exact live validation errors; any prompt
or transport patch.

## Implemented (observability only)

1. `sanitizedAdjudicationDiagnostics` on selection rejections and live cases
2. Honest side attribution (no default-to-Side-A)
3. Honest `gateStoppedAt` (null when no controlled-entry result)
4. Live bundle `adjudicatorPromptAddendumVersion` = landed v1 (not in prompt)

## Explicitly not implemented

- Runtime prompt changes
- Source-length metadata
- Provider-output mutation
- Live provider rerun
