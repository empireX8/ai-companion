# 03 — Root-cause classification

## Established fact

| Code | Statement |
|---|---|
| F | Sanitized failure observability gap in CEQR-011 live receipts (proven code defect) |
| — | Exact live failure cause remains **unknown** |
| — | All three corrected cases stopped at adjudication validation |

## Inference only (not established)

Removed pre-correction mutation classes (offset / blank-qual / full-text) do not
prove which errors occurred on the corrected run.

## Chosen classification

`HOLD_FAILURE_EVIDENCE_INSUFFICIENT`

Runtime changes in this slice are **observability only**. No runtime prompt
patch. Prompt changes require a later evidence-supported slice after a
diagnostic rerun under the landed CEQR-011 prompt.
