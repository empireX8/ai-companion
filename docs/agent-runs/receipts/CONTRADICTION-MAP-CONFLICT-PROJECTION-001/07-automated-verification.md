# 07 — Automated verification

## Focused Wave 1.1 tests (final)

```bash
npx vitest run \
  lib/__tests__/map-open-contradictions.test.ts \
  lib/__tests__/map-contradiction-projection.test.ts \
  lib/__tests__/map-contradiction-read-api-security.test.ts
```

**Result:** 3 files / **18 passed**

## Type / build (final)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Full suite vs staging baseline `e3b79ed` (final)

Campaign: **5 failed files / 7 failed tests / 3896 passed** (308 files)

Identical failing files on clean baseline `e3b79ed`:

1. `lib/__tests__/canonical-fixture-composition-gate.test.ts`
2. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
3. `lib/__tests__/orvek-adapters.test.ts`
4. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
5. `lib/__tests__/today-production-movement-depth.test.ts`

**Campaign-caused new failures:** **none** (exact matching baseline failure set).
