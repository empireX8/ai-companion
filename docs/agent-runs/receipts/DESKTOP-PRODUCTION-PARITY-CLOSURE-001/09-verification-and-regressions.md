# Verification And Regressions

## Final command results on the repaired branch

- `git diff --check`: `PASS`
- `npx tsc --noEmit`: `PASS`
- targeted Map repair set:
  - `lib/__tests__/map-production-api.test.ts`
  - `lib/__tests__/map-presentation-readiness.test.ts`
  - `lib/__tests__/your-map-workbench.test.ts`
  - `lib/__tests__/desktop-old-route-shell-quarantine.test.ts`
  - result: `PASS`
- final focused provenance slice:
  - `18/18` files passed
  - `240/240` tests passed
- `npx vitest run`: `FAIL`
  - `2 failed | 281 passed` files
  - `4 failed | 3776 passed` tests
- dedicated global production-parity Playwright suite:
  - `7/7 passed`
- `npm run build`: `PASS`
- `bash scripts/check-trust-language.sh`: `PASS`
- `bash scripts/check-legacy-surfaces.sh`: `PASS`
- `bash scripts/verify-mindlab.sh`: `FAIL`
  - only because the same full-Vitest baseline pair still fails

## Exact full-suite failures on the repaired branch

1. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
   - `2` failing assertions
   - mismatch: expected unmapped Prisma names; runtime schema uses mapped names `epsr_user_src_uniq` and `epsr_user_src_idx`
2. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
   - `2` failing assertions
   - mismatch: expected unmapped Prisma names; runtime schema uses mapped names `sep_user_src_uniq`, `sep_user_status_surfaced_idx`, `sep_user_pub_elig_status_idx`, `sep_user_src_idx`

## Exact baseline versus branch regression delta

- baseline failures:
  - files:
    - `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
    - `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
  - counts:
    - `2 failed | 281 passed` files
    - `4 failed | 3769 passed` tests
- branch failures:
  - files:
    - `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
    - `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
  - counts:
    - `2 failed | 281 passed` files
    - `4 failed | 3776 passed` tests
- exact intersection:
  - same two files
  - same four failing assertions
- branch-introduced failures:
  - `NONE`
- order dependence:
  - `NONE`

## Build concurrency note

- A transient `ENOENT` appeared only when `npm run build` and `bash scripts/verify-mindlab.sh` were launched concurrently against the same `.next` directory.
- Sequential final verification avoided that collision.
- The required final single-process `npm run build` passed.
