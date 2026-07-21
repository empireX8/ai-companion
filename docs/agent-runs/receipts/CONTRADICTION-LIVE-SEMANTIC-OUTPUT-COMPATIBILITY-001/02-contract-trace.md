# 02 — Contract trace

```
OpenAI → AI SDK runner (maxRetries 0, timeout 45s)
  → OpenAI-strict transport schema
  → wrapAdjudicatorRunnerForLiveEvidence (CEQR-011 system addendum only; prompt unchanged)
  → StructuredModelRunnerResult.object (unchanged)
  → parseContradictionModelResult
  → collectSemanticConsistencyErrors
  → validateDualSideEvidenceClaims
  → required proposition-field checks
  → Class A only → Objectivity Referee → confidence → persistence → writer
```

CEQR-012 adds sanitized diagnostics on selection rejection / live case receipts.
Generic diagnostics do not claim live-addendum provenance.
