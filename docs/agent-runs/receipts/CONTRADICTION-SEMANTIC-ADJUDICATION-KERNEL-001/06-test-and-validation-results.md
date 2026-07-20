# 06 — Test and validation results

## Focused tests

```bash
npx vitest run lib/__tests__/contradiction-adjudication-contract.test.ts
```

**Result:** 22/22 passed (matrix A–R + runtime non-wiring + unsupported object type + cross-side source).

### Matrix coverage

| Case | Result |
|------|--------|
| A Clear contradiction | PASS — semantic accepted; referee `not_run`; no persistence |
| B Objectivity / somatic near-miss | PASS — `compatible_states` |
| C Goal vs obstacle (Du Bois shape) | PASS — tension/compatible; not Class A |
| D Intention vs outcome in progress | PASS — not automatic Class A |
| E Change over time | PASS — not simultaneous contradiction |
| F Rhetorical marker | PASS — compatible/insufficient |
| G Different subject/scope | PASS |
| H Partial compliance / qualifiers | PASS — Class B |
| I Abstention | PASS |
| J Malformed output | PASS — fail closed |
| K Fabricated quote | PASS |
| L Invalid offsets | PASS |
| M Wrong source ID | PASS |
| N Class A without both valid spans | PASS |
| O Model failure / timeout | PASS |
| P Provider independence | PASS |
| Q Referee interface | PASS — default `not_run`; no auto PASS |
| R Version/audit metadata | PASS |

Du Bois / objectivity near-miss cases covered so they do not become false Class A.

## TypeScript / build / full suite

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| `npx vitest run lib/__tests__/contradiction-adjudication-contract.test.ts` | **PASS** (22/22) |
| `npm test` | 304 files passed / 5 failed; 3918 tests passed / 7 failed |

### Full-suite failure classification

**Pre-existing baseline** — unrelated to CEQR-001:

- `canonical-fixture-composition-gate.test.ts`
- `evidence-pointer-surfacing-rationale-schema.test.ts` (2)
- `orvek-adapters.test.ts` (2)
- `surfaced-evidence-pointer-schema.test.ts` (2)
- `today-production-movement-depth.test.ts` (1)

CEQR-001 added only new files under `lib/orvek-intelligence-kernel/`, `lib/contradiction-adjudicator.ts`, the focused test, and this receipt directory. No edits to the failing modules.

Machine-readable summary: `validation-summary.json`.
