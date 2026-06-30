# Verification Receipt

## Environment note

- `npx playwright test scripts/v0-route-smoke.playwright.ts` requires a live app server at `http://localhost:3000`.
- For this run, local dependencies were prepared with `npm run db:local`, then the smoke suite ran against `npm run dev`.

## Command results

- `git diff --check`
  - Exit: `0`
  - Output: none
- `npx tsc --noEmit`
  - Exit: `0`
  - Output: none
- `npx vitest run lib/__tests__/shell-legacy-route-cleanup.test.ts`
  - Exit: `0`
  - Output:

```text
 RUN  v3.2.4 /Users/user/ai-companion

 ✓ lib/__tests__/shell-legacy-route-cleanup.test.ts (7 tests) 11ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  10:27:06
   Duration  1.34s (transform 160ms, setup 0ms, collect 147ms, tests 11ms, environment 0ms, prepare 204ms)
```

- `npx playwright test scripts/v0-route-smoke.playwright.ts`
  - Exit: `0`
  - Output:

```text
Running 29 tests using 1 worker
  29 passed (46.1s)
```

- `npm run build`
  - Exit: `0`
  - Output summary:
    - `next build --turbopack`
    - Compiled successfully
    - Route manifest generated
    - Existing repo ESLint warnings remained, but build completed successfully
- `bash scripts/verify-mindlab.sh`
  - Exit: `0`
  - Output summary:
    - `git diff --check`: PASS
    - `npx tsc --noEmit`: PASS
    - `npx vitest run`: PASS (`221` files, `3046` tests)
    - `npm run build`: PASS
    - `bash scripts/check-trust-language.sh`: PASS
    - `bash scripts/check-legacy-surfaces.sh`: PASS
    - Final summary: `PASS: 6`, `FAIL: 0`, `SKIP: 0`
