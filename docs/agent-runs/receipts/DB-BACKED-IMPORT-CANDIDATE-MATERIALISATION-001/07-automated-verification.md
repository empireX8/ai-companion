# 07 — Automated verification

## Campaign tests (required)

```bash
npx vitest run lib/__tests__/import-candidate-review.test.ts lib/__tests__/import-candidate-review-wiring.test.ts
```

**Result:** 17/17 passed (isolated mocks; no Kay mutations).

Coverage includes:

- authenticated real-candidate query shape + IMPORTED_ARCHIVE gate
- seed ids absent from production mapping
- truthful totals + pagination
- cross-user blocked
- reject persists without delete; idempotent
- accept persists; reference + contradiction materialisation
- accept idempotent / duplicate materialisation detected
- transaction failure leaves no partial mutation
- PatternClaim path untouched
- fixture `referenceSurface: true` retained
- provider destination wiring assertions

## Broader suite notes

Full `npx vitest run` on this worktree also reported **pre-existing** failures unrelated to this campaign (e.g. `surfaced-evidence-pointer-schema`, `today-production-movement-depth`). This campaign did not modify those modules.

`npx tsc --noEmit` — pass for campaign changes after type fixes.

`bash scripts/check-trust-language.sh` — pass
`bash scripts/check-legacy-surfaces.sh` — pass
`git diff --check` — pass

`npm run build` — failed in this environment without Stripe authenticator config (`Neither apiKey nor config.authenticator provided` for `/api/stripe`). Environmental; not caused by import-review routes.
