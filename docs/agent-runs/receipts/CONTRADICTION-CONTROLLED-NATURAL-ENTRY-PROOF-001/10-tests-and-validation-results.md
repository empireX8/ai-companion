# 10 — Tests and validation results (independent review correction)

## Focused CEQR-010

```
Test Files  1 passed (1)
Tests       35 passed (35)
```

`lib/__tests__/contradiction-controlled-natural-entry-proof.test.ts`

## Related contradiction chain

```
Test Files  12 passed (12)
Tests       334 passed (334)
```

## TypeScript

`npx tsc --noEmit` — exit 0

## ESLint (changed files)

`npx eslint lib/contradiction-controlled-natural-entry-proof.ts lib/__tests__/contradiction-controlled-natural-entry-proof.test.ts` — exit 0

## Production build

`npm run build` (env loaded) — exit 0

## Full Vitest suite

```
Test Files  5 failed | 314 passed (319)
Tests       7 failed | 4246 passed (4253)
```

### Known baseline failing set (unchanged)

1. `canonical-fixture-composition-gate.test.ts`
2. `evidence-pointer-surfacing-rationale-schema.test.ts` ×2
3. `orvek-adapters.test.ts` ×2
4. `surfaced-evidence-pointer-schema.test.ts` ×2
5. `today-production-movement-depth.test.ts` ×1

Passed-test count rose versus CEQR-008/009 baseline by the CEQR-010 focused matrix (35 tests in one file). Failure set unchanged.

## git diff --check

Exit 0

## Account gate

before/after: `matchesExpected: true`; 25 CN / 5941 spans / 25 legacy both-null unchanged.
