# 02 — Offset data-flow map

```
buildContradictionAdjudicationPrompt
  → embeds Side A/B sourceText
  → (CEQR-020) embeds code-owned lexical boundary catalogs
provider structured output (schema-v4)
  → evidenceClaim{A,B}: { startBoundaryIndex, endBoundaryIndex }
OpenAI strict envelope unwrap (adjudication.*)
parseContradictionModelTransportResult
bindDualSideEvidenceClaims
  → resolveBoundaryIndexSelection (catalog → UTF-16 offsets)
  → bindExactEvidenceClaimFromOffsets
       range gates → validateLexicalBoundaryIntegrity → slice exactQuote
  → per-side EvidenceSideBindDiagnostic (both sides always evaluated)
collectSemanticConsistencyErrors (defence in depth)
validation_failed if any bind/semantic error
  → semantic = null (referee/writer unreachable)
buildSanitizedAdjudicationDiagnostics
  → records indices, resolved offsets, categories, failing side, hashes
  → never stores API keys, credentials, or provider-authored exactQuote as authority
```

| Concern | Where decided |
|---|---|
| start/end enter transport | provider `startBoundaryIndex` / `endBoundaryIndex` |
| index units | UTF-16 code units after catalog resolution |
| source length | `sourceText.length` (UTF-16) |
| exactQuote derived | `sourceText.slice(start, end)` in binder |
| lexical validity | `validateLexicalBoundaryIntegrity` |
| rejection diagnostics | labeled Side A/B errors + sanitized sideOffsetDiagnostics |
| raw transport discarded historically (CEQR-019) | semantic null + no offset fields in diagnostics — **fixed in CEQR-020** |
