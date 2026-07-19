# 11 — Automated verification (final closeout)

## Focused commands

```bash
npx vitest run lib/__tests__/your-map-runtime-profile-facts.test.ts \
  lib/__tests__/map-profile-facts.test.ts \
  lib/__tests__/import-candidate-review.test.ts \
  lib/__tests__/import-candidate-review-wiring.test.ts \
  lib/__tests__/hybrid-workbench-api.test.ts \
  lib/__tests__/your-map-workbench.test.ts \
  lib/__tests__/desktop-frozen-reference-authority.test.ts
npx tsc --noEmit
npm run build
git diff --check
```

## Focused results

| Suite | Result |
|-------|--------|
| `your-map-runtime-profile-facts.test.ts` | **PASS** (4) |
| `map-profile-facts.test.ts` | **PASS** (18) |
| import-candidate-review (+ wiring) | **PASS** |
| hybrid-workbench-api | **PASS** |
| your-map-workbench | **PASS** |
| desktop-frozen-reference-authority | **PASS** |
| Focused total | **120 passed / 7 files** |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

## Full suite vs staging @ `7d025bf`

| | Baseline `7d025bf` | Campaign worktree |
|--|--------------------|-------------------|
| Test files failed | **5** | **5** (identical set) |
| Tests failed | **7** | **7** (identical assertions) |
| Test files passed | 298 / 303 | 300 / 305 (+2 campaign files) |
| Tests passed | 3856 / 3863 | 3878 / 3885 (+22 campaign tests) |

### Identical baseline failing files (not campaign-caused)

1. `lib/__tests__/canonical-fixture-composition-gate.test.ts`
2. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
3. `lib/__tests__/orvek-adapters.test.ts`
4. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
5. `lib/__tests__/today-production-movement-depth.test.ts`

No new failing files relative to baseline.
