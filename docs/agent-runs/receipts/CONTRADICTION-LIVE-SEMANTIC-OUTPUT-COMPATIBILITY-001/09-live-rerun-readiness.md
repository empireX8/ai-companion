# 09 — Live rerun readiness

## Future diagnostic rerun

- Will use the **same CEQR-011 prompt** (addendum unchanged)
- Will record `sanitizedAdjudicationDiagnostics` with validation codes / paths
- Side-specific evidence status remains unknown when the validator message does
  not identify the side
- Generic diagnostics do not claim live-wrapper provenance
- Live receipt may carry `adjudicatorPromptAddendumVersion: …-v1` from the bundle

## Prompt changes

Require a **later evidence-supported slice** after the diagnostic rerun
identifies the actual failure. Not authorised in CEQR-012.
