# 16 — Result and limitations

## Final classification
`PASS_WITH_DETERMINISTIC_EVIDENCE_AUTHORITY_REPAIR`

## Path
A

## Explicit status
- raw provider output mutated: **NO**
- provider-authored sourceId remains authoritative: **NO**
- provider-authored exactQuote remains authoritative: **NO**
- code-owned sourceId implemented: **YES**
- code-derived exactQuote implemented: **YES**
- offsets model-authored: **YES**
- invalid offsets fail closed: **YES**
- fuzzy matching introduced: **NO**
- quote search repair introduced: **NO**
- validation weakened: **NO**
- prompt changed: **YES** (v3; structural companion, not prompt-only fix)
- transport schema changed: **YES** (v2 offsets-only)
- generic kernel contract changed: **NO** (KERNEL_CONTRACT_VERSION remains `orvek-intelligence-kernel-v1`; shared kernel envelope/domain ExactEvidenceClaim unchanged)
- contradiction provider transport contract changed: **YES** (schema-v2 offsets-only)
- domain ExactEvidenceClaim shape changed: **NO**
- kernel adjudication envelope changed: **NO**
- live provider attempts: **0**
- real database mutation: **NO**
- existing 25 rows untouched: **YES**
- ordinary ingestion wired: **NO**
- production readiness: **NO**

## Limitations
- No live proof under the new architecture in this slice (forbidden)
- Model may still select poor offsets; those fail closed rather than being repaired
- Evidence selections remain required for all classifications (optional absence not introduced)
- Production readiness remains NO pending a future controlled live rerun slice

## Independent review correction
- `propositionFieldsSchema` restored
- transport vs domain naming restored (`contradictionModelTransportResultSchema` vs domain `contradictionModelResultSchema`)
- `selectionForSubstring` removed from production (`evidence-validation.ts`); test-local helper only
- real injected writer / lineage proof added (controlled natural-entry harness)
- `KERNEL_CONTRACT_VERSION` remains `orvek-intelligence-kernel-v1`
- Classification confirmed after validation rerun: `PASS_WITH_DETERMINISTIC_EVIDENCE_AUTHORITY_REPAIR`
