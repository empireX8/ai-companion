# Test Coverage Receipt

Existing coverage already in repo:
- `scripts/v0-route-smoke.playwright.ts` mounts the v0 public surfaces and blocks legacy public routes.
- `lib/__tests__/today-workbench-routes.test.ts` covers the Today allowlist and honest disabling behavior.
- `lib/__tests__/inspector-surface-wiring.test.ts` covers Today, What Changed, Map, Timeline, and inspector boundary wiring.
- `lib/__tests__/inspector-evidence-presentation.test.ts` covers evidence selection and model_update boundary behavior.
- `lib/__tests__/what-changed-reality-report.test.ts` covers the CONTRACT-001 output guardrails for the reality-tracking report builder.

Slice decision:
- No new test files were added for this audit-only slice.
- The audit uses static code inspection plus the existing smoke / unit coverage as verification.
- The route smoke file was renamed out of Vitest discovery so the Playwright harness stays isolated.

Remaining coverage gap:
- There is still no targeted click-through Playwright spec for the visible shell/nav/command-palette/button flows in this slice.
- The audit receipts document those paths directly from source, but the repo does not yet have an end-to-end button audit test for them.
