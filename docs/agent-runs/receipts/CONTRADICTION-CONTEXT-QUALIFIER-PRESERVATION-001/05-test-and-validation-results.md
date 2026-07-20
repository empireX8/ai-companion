# 05 — Test and validation results

## Focused tests

```bash
npx vitest run lib/__tests__/contradiction-adjudication-contract.test.ts
```

**Result:** PASS — 1 file, **47 tests** passed.

## TypeScript

```bash
npx tsc --noEmit
```

**Result:** PASS

## Build

```bash
npm run build
```

**Result:** PASS

## Full suite

```bash
npm test
```

| Metric | This slice | CEQR-002 baseline |
|--------|------------|-------------------|
| Failed files | 5 | 5 |
| Passed files | 304 | 304 |
| Total files | 309 | 309 |
| Failed tests | 7 | 7 |
| Passed tests | 3960 | 3935 |
| Total tests | 3967 | 3942 |

Passed-test count rose by **25** from new/expanded CEQR-003 contract coverage. Failure set is an **exact file match** to the CEQR-002 recorded baseline.

### Pre-existing failed files (exact match)

1. `lib/__tests__/canonical-fixture-composition-gate.test.ts`
2. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
3. `lib/__tests__/orvek-adapters.test.ts`
4. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
5. `lib/__tests__/today-production-movement-depth.test.ts`

## Other checks

| Check | Result |
|-------|--------|
| `git diff --check` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |

## Assertions preserved

- Existing CEQR-001 clear-contradiction positive control retained
- No weakening of CEQR-001 assertions
- Injected fake runners only; no network / provider calls
- No Kay DB mutation in tests
