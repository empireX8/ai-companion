# 06 Today Intent Consumption Receipt

- No production Today data wiring was done.
- The visual shell was not changed.
- Reference navigation was preserved.
- `components/orvek-v0/pages/today.tsx` now consumes workbench-native intent metadata when present.
- `href` remains fallback/permalink metadata only.
- `/watch-for` remains deferred unless a selectable or other workbench-native intent exists.
- The #81 visual baseline remains untouched.
- This branch is still not production-ready.
- Ready for product-owner visual check.

Verification:
- `npx tsc --noEmit`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `git diff --check`
- `npx vitest run lib/__tests__/today-workbench-routes.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts lib/__tests__/today-surface.test.ts`
