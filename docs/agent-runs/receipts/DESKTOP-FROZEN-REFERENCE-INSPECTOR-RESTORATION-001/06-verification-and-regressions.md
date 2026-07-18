# 06 Verification And Regressions

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`

## Typecheck And Build

- `git diff --check`: pass
- `npx tsc --noEmit`: pass
- `npm run build`: pass
- `bash scripts/check-trust-language.sh`: pass
- `bash scripts/check-legacy-surfaces.sh`: pass

Build note:

- `npm run build` completed successfully on `2026-07-17`
- existing lint warnings were emitted, but the build completed
- no build failure was introduced by this campaign slice

## Targeted Vitest

Targeted shared-authority regression cluster:

- command:
  - `npx vitest run lib/__tests__/inspector-surface-wiring.test.ts lib/__tests__/evidence-panel-provider-lookup.test.ts lib/__tests__/model-movement-fixture-cleanup.test.ts`
- result: `3 files`, `26 tests` passed

Focused pre-existing schema-failure comparison:

- branch command:
  - `npx vitest run lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
- baseline command:
  - same command in `/tmp/ai-companion-baseline`
- result on both branch and baseline: `2 files`, `18 tests`, `4` failing assertions, `14` passing assertions

## Full Vitest Baseline Comparison

Branch full-suite result:

- test files: `285`
- total tests: `3790`
- passed: `3786`
- failed: `4`
- failed files: `2`
- command date: `2026-07-17`

Baseline `staging @ 1f8cb7cede1844d079a2dd0ab0ac434a132e761e` full-suite result:

- test files: `283`
- total tests: `3780`
- passed: `3776`
- failed: `4`
- failed files: `2`
- command date: `2026-07-17`

Comparison:

- branch adds `10` passing tests versus baseline
- branch adds `2` passing test files versus baseline
- branch adds `0` new full-suite failures versus baseline
- the same `4` failures exist on both baseline and branch

Shared failing files on baseline and branch:

- `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
- `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`

These are pre-existing failures, not introduced by this campaign.

## Playwright

Trusted authenticated reruns on fresh local ports with serial workers:

- `scripts/desktop-frozen-reference-inspector-restoration.playwright.ts`: `3/3` passed
- `scripts/movement-report-completion.playwright.ts`: `3/3` passed

Total authenticated Playwright checks re-run in this update slice: `6/6` passed.

## Fixture Cleanup

Recorded in `visual-comparison-manifest.json`:

- deleted links: `3`
- deleted model updates: `2`
- deleted evidence: `4`
- deleted claims: `1`
- deleted conclusions: `1`
- remaining model updates: `0`
- remaining links: `0`

## Secret And Artifact Scan

Secret scan:

- dedicated secret-scanning binaries were not installed in this environment
- fallback scan over the changed tree found no newly introduced hard-coded secrets

Artifact scan:

- transient Playwright runner output is not retained as campaign evidence
- stale duplicate production screenshots from intermediate runs were removed from the receipt directory
- only the intended canonical receipt artifacts remain under `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/`

## Regression Summary

Restoration-specific regressions fixed in this branch:

- frozen reference route no longer depends on mutable production Inspector presentation
- production Inspector no longer uses a separate visual language
- weekly report returns to overlay behavior
- Inspector linked-object back trail is restored
- Today hydration is hardened against empty/partial first loads

Outstanding non-campaign regression status:

- the pre-existing schema-test failures above remain
- the separate intelligence contradiction is recorded as out of scope in its own receipt
