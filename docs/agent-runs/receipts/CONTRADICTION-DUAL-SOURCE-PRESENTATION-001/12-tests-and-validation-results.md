# 12 — Tests and validation results (post independent-review correction)

## Focused CEQR-008/009 tests

```
Test Files  3 passed (3)
Tests       39 passed (39)
```

- `contradiction-dual-source-presentation.test.ts` — 22 passed
- `contradiction-dual-source-routes.test.ts` — 8 passed
- `contradiction-dual-source-presentation-ui.test.ts` — 9 passed

## Related tests

```
Test Files  7 passed (7)
Tests       114 passed (114)
```

## TypeScript

`npx tsc --noEmit` — exit 0

## ESLint (changed TS/TSX)

Exit 0. Pre-existing warning only: unused `error` in `SelectedObjectEvidencePanel.tsx`.

## Production build

`npm run build` (with env loaded) — exit 0

## Full Vitest suite

```
Test Files  5 failed | 313 passed (318)
Tests       7 failed | 4211 passed (4218)
```

### Known baseline failing set (unchanged)

1. `canonical-fixture-composition-gate.test.ts`
2. `evidence-pointer-surfacing-rationale-schema.test.ts` ×2
3. `orvek-adapters.test.ts` ×2
4. `surfaced-evidence-pointer-schema.test.ts` ×2
5. `today-production-movement-depth.test.ts` ×1

## git diff --check

Exit 0

## Account gate after correction

`dual-source-presentation-after-patch`: matchesExpected true; IDs + span FKs identical to before gate.
