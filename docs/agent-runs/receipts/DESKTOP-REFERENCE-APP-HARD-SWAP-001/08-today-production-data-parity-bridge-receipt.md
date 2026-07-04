# 08 Today Production Data Parity Bridge Receipt

- The reference Today layout was preserved.
- The Delta log section remains present.
- `Continue from what changed` still follows the reference workbench behavior.
- The Evidence Pointer card keeps the reference receipt ids that the Inspector already knows.
- The Weekly Model Movement report still opens only through the reference report control.
- Dead or reference-inactive buttons were not newly activated.
- Production Today data is overlaid only where it does not alter the reference contract.
- Live resurfaced receipt ids are not forwarded into the visible Evidence Pointer action target.
- Missing production Today sections fall back to the reference/mock baseline instead of disappearing.
- Non-Today surfaces remain on the temporary reference baseline.
- The old production shell stayed quarantined.
- This branch is not production-ready yet.
- Ready for product-owner visual check.

What changed:

- `components/orvek-v0/workbench.tsx` now accepts an injected `dataApi` prop.
- `components/orvek-workbench/OrvekWorkbenchShell.tsx` now injects the hybrid Today workbench data API.
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` fetches Today re-entry data and builds the production-overlaid API.
- `lib/orvek-v0/production/hybrid-workbench-api.ts` merges live Today receipt ids onto the mock baseline without setting the production display contract.
- `lib/__tests__/hybrid-workbench-api.test.ts` proves the hybrid bridge keeps the baseline and only hydrates live Today receipts.

Verification:

- `npx tsc --noEmit`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `git diff --check`
- `npx vitest run lib/__tests__/hybrid-workbench-api.test.ts lib/__tests__/today-production-api.test.ts lib/__tests__/today-workbench-routes.test.ts lib/__tests__/today-surface.test.ts lib/__tests__/orvek-adapters.test.ts lib/__tests__/shell-quarantine.test.ts lib/__tests__/orvek-v0-inversion.test.ts`
