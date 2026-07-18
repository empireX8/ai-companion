# 04 Inspector Interaction And Report Parity

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`

## Verified Interaction Manifest

The following states and interactions were exercised against the frozen reference and authenticated production surfaces:

1. Empty Inspector
2. Select an object
3. Evidence / Context tab
4. Model Movement tab
5. Scroll through each tab
6. Open linked evidence or related object
7. Navigate back inside the Inspector
8. Open weekly/model-movement report
9. Close report
10. Return to the original selection
11. Direct page navigation with valid Inspector continuity preserved

## Weekly Report Regression

Known regression from campaign intake:

- production weekly-report action was drifting away from the reference overlay path

Restored behavior:

- frozen reference uses `openReport("rep-weekly")`
- production opens the live report overlay for the resolved report ID
- production no longer treats the weekly-report action as a detour into Map-only navigation when the overlay path is available

Reference proof:

- screenshot `07-report-overlay-reference.png`
- selector: `button[name~="Weekly Model Movement report"]`
- report ID: `rep-weekly`

Production proof:

- screenshot `14-report-overlay-production.png`
- selector: `[data-testid="today-full-report"]`
- live report ID in capture manifest: `cmrpccfpk0000qltzf9zzoaj6`

## Back Trail Restoration

Inspector history/back behavior is now handled in the shared store and shared authority ModelUpdate cache:

- `pushSelection`
- `canGoBack`
- `backTarget`
- `goBack`
- `useProductionModelUpdateInspector(...)` cache keyed by canonical `modelUpdateId`

This supports:

- movement-card to model-update navigation in the reference surface
- receipt-linked navigation in the production surface
- visible return banner/back trail inside the shared Inspector
- restoring populated ModelUpdate detail after linked receipt navigation and Back

Proof screenshots:

- `06-linked-back-navigation-reference.png`
- `13-linked-back-navigation-production.png`

## Browser Proof

Authenticated interaction/browser proof on `2026-07-17`:

- `scripts/desktop-frozen-reference-inspector-restoration.playwright.ts`: `3/3` passed
- `scripts/movement-report-completion.playwright.ts`: `3/3` passed

Total authenticated Playwright checks re-run for this update slice: `6/6` passed.

## Behavioral Mismatch Status

Observed after restoration:

- no remaining behavioral mismatches were found in the exercised Inspector/report flows
- reference and production still differ in content because production uses authenticated live data rather than sample fixtures
- the separate intelligence contradiction remains out of scope and is recorded separately

Residual acceptance limitation:

- broader human comparison is still required because Kay has not yet signed off the production paired captures against the confirmed frozen route
