# 11 — Tests and validation plan

## Focused projection / route / UI tests

- `lib/__tests__/contradiction-dual-source-presentation.test.ts`
- `lib/__tests__/contradiction-dual-source-routes.test.ts`
- `lib/__tests__/contradiction-dual-source-presentation-ui.test.ts`

## Related existing tests

- map contradiction read security
- phase1c understanding-links endpoints (mock added for new module)
- inspector surface wiring / evidence presentation
- nodes-api
- dual-side lineage / contradiction-evidence

## Validation commands

- focused vitest
- related vitest
- `npx tsc --noEmit`
- eslint on changed TS/TSX
- `npm run build`
- full `npx vitest run`
- `git diff --check`
- prohibited write/path scan
- account before/after gate
