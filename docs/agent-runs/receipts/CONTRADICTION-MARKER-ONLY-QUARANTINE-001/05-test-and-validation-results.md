# 05 — Test and validation results

## Focused commands

```bash
npx vitest run \
  lib/__tests__/contradiction-detection.test.ts \
  lib/__tests__/import-chatgpt.test.ts \
  lib/__tests__/import-archive.test.ts \
  lib/__tests__/contradiction-backfill.test.ts
```

**Result:** 4 files passed / 167 tests passed.

## Contracts covered

### Detector (A–K)

- A–C: rhetorical markers alone → no detection
- D–E: goal-mismatch markers + goal ref → no detection
- F: plausible pair abstains without semantic adjudication
- G: multi-ref no fan-out candidates
- H: high token overlap ≠ eligibility
- I: existing-node similarity ≠ update authorization
- J: short/no-marker/no-ref remain empty
- K: nominations non-persistable / not `DetectedContradiction`

### Import (L–U)

- L–P: overlap / regex / lack-of-rejection ≠ eligibility
- Q–R: zero CNs / no contradiction derivation artifacts
- S: quarantine vs hard-rejection diagnostic distinction
- T–U: ReferenceItem path intact; existing 25 untouched in fake import

## Prior expectations invalidated (documented in tests)

| Prior expectation | Why invalid |
|-------------------|-------------|
| Marker + goal/constraint → `DetectedContradiction` | Markers are nomination only (CEQR-002) |
| Import `eligible: true` when no rejection reasons | Not semantic approval |
| Behavioral regex / token overlap affirmative eligibility | Retrieval/relevance only |
| Import fanout created N candidates from marker messages | No persistable detections |
| Backfill created nodes from marker messages | Detector fail-closed |

## Broader validation

See `validation-summary.json` for TypeScript, build, and full-suite results vs CEQR-001 baseline failure set.
