# Final Result For Kay

- verdict: `FULLY VERIFIED`
- baseline commit: `38d3b2c7cc9e944512fd6269269f04838b46a8e5`
- Today blockers: `NONE`
- Map blockers: `NONE`
- Decisions blockers: `NONE`
- Explore blockers: `NONE`
- Investigations blockers: `NONE`
- Timeline blockers: `NONE`
- Inspector blockers: `NONE`
- reference-isolation blockers: `NONE`
- exact browser result: `7/7 passed`
- MIXED final count: `0`
- FALLBACK final count: `0`
- MOCK final count: `0`
- UNPROVEN final count: `0`
- branch-introduced failures: `NONE`
- fixture cleanup result: all campaign fixture remaining counts `0`

## Exact counts

- initial counts
  - `LIVE: 12`
  - `MIXED: 7`
  - `FALLBACK: 8`
  - `MOCK: 1`
  - `UNPROVEN: 2`
  - `INTENTIONAL EMPTY: 0`
  - `INTENTIONAL UNAVAILABLE: 0`
  - `EXPLICIT SAMPLE / REFERENCE: 15`
- final counts
  - `LIVE: 14`
  - `MIXED: 0`
  - `FALLBACK: 0`
  - `MOCK: 0`
  - `UNPROVEN: 0`
  - `INTENTIONAL EMPTY: 1`
  - `INTENTIONAL UNAVAILABLE: 0`
  - `EXPLICIT SAMPLE / REFERENCE: 30`

## Exact production ids

- Today / report / Inspector ModelUpdate:
  - `cmrny3kfp0000qlid56o30lnv`
- Map conclusion / Inspector:
  - `dev-live-evidence-depth-conclusion`
- Decisions action / Inspector:
  - `cmrny41y10008qlidn502238j`
- Explore conversation:
  - `a11ce001-ea01-4000-8000-000000000002`
- Explore user message:
  - `2cd4aa7f-b480-431d-ac2f-9e066899136c`
- Explore assistant message:
  - `33714563-0b7b-4a63-b322-9a457c8e810f`
- Explore proposal:
  - `cmrny4sf90004qlicpmws9q6e`
- Explore published ModelUpdate / Inspector:
  - `cmrny4u2r0005qlicjrbr4ehn`
- Investigation / Inspector:
  - `cmrny5088000cqlica6rx9s56`
- Investigation evidence:
  - `dev-investigations-assault-evidence-secondary`
- Watch-for / Fieldwork:
  - `cmrny51ee000eqlicig99n6su`
- Timeline ModelUpdate / Inspector:
  - `cmrny58qz0009qlidggwkoi5w`

## Exact negative statuses

- unauthenticated investigation list: `404`
- unauthenticated investigation detail: `404`
- unauthenticated decision patch: `404`
- cross-user investigation detail: `404`
- missing investigation: `404`
- missing Explore message grounding: `404`
- malformed Explore message grounding: `400`
- cross-user Explore session list: `404`
- unauthorized mutation result: `NONE`

## Exact fixture remaining counts

- Today-supporting movement records:
  - `remainingModelUpdates: 0`
  - `remainingLinks: 0`
- Map support records:
  - `remainingConclusions: 0`
- Decisions support records:
  - `remainingActions: 0`
- Explore support records:
  - `remainingConversations: 0`
  - `remainingMessages: 0`
  - `remainingProposals: 0`
  - `remainingModelUpdates: 0`
  - `remainingMovementEvidenceLinks: 0`
  - `remainingSeededMapEvidenceObjects: 0`
- Investigations support records:
  - `investigations: 0`
  - `watchFors: 0`
  - `evidenceLinks: 0`
  - `fieldworkAssociations: 0`
  - `outcomes: 0`
  - `closures: 0`
  - `investigationModelUpdates: 0`
  - `seededEvidenceObjects: 0`
  - `seededFieldworkObjects: 0`

## Complete changed-file summary

- Runtime and UI provenance repairs:
  - `components/inspector/WorkbenchInspector.tsx`
  - `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
  - `components/orvek-v0/production/ProductionInspectorBridge.tsx`
  - `components/orvek-v0/production/RouteSidebar.tsx`
  - `components/orvek-v0/sidebar.tsx`
  - `components/orvek-v0/workbench.tsx`
  - `components/orvek-workbench/useOrvekExploreChat.ts`
  - `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
  - `lib/actions-v1.ts`
  - `lib/live-evidence-depth-runtime-fixture.ts`
  - `lib/live-evidence-depth-runtime-validation.ts`
  - `lib/model-movement-runtime-fixture.ts`
  - `lib/orvek-adapters/today.ts`
  - `lib/orvek-v0/data-provider.tsx`
  - `lib/orvek-v0/production/decisions-api.ts`
  - `lib/orvek-v0/production/hybrid-workbench-api.ts`
  - `lib/orvek-v0/production/map-api.ts`
  - `lib/orvek-v0/production/map-presentation.ts`
  - `lib/orvek-v0/production/today-evidence-pointer-depth-gate.ts`
  - `lib/your-map-surface.ts`
  - `lib/orvek-v0/workbench-route-history.ts`
- Browser/auth harness:
  - `app/api/desktop-production-parity/auth-probe/route.ts`
  - `playwright.config.ts`
  - `scripts/desktop-production-parity-closure.playwright.ts`
- Regression tests:
  - `lib/__tests__/actions-v1.test.ts`
  - `lib/__tests__/decisions-hybrid-fetch.test.ts`
  - `lib/__tests__/decisions-presentation-readiness.test.ts`
  - `lib/__tests__/decisions-surface.test.ts`
  - `lib/__tests__/desktop-inspector-assault.test.ts`
  - `lib/__tests__/desktop-old-route-shell-quarantine.test.ts`
  - `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`
  - `lib/__tests__/hybrid-workbench-api.test.ts`
  - `lib/__tests__/inspector-surface-wiring.test.ts`
  - `lib/__tests__/live-evidence-depth-runtime-fixture.test.ts`
  - `lib/__tests__/live-evidence-depth-runtime-validation.test.ts`
  - `lib/__tests__/map-presentation-readiness.test.ts`
  - `lib/__tests__/map-production-api.test.ts`
  - `lib/__tests__/orvek-adapters.test.ts`
  - `lib/__tests__/today-adapter-honesty.test.ts`
  - `lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts`
  - `lib/__tests__/today-object-graph-parity.test.ts`
  - `lib/__tests__/today-production-api.test.ts`
  - `lib/__tests__/your-map-workbench.test.ts`
- Receipts and artifacts:
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/00-intake-and-prior-audit-reconciliation.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/01-provenance-taxonomy-and-hard-gates.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/02-initial-production-state-census.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/03-today-map-and-decisions-proof.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/04-explore-and-investigations-proof.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/05-timeline-and-inspector-proof.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/06-empty-unavailable-and-reference-isolation.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/07-authentication-ownership-and-negative-proof.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/08-browser-journeys-and-fixture-cleanup.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/09-verification-and-regressions.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/10-final-result-for-kay.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/production-provenance-matrix.md`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/production-provenance-matrix.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/playwright-artifacts.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/map-test-2-trace-run-1.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/map-test-2-trace-run-2.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/map-test-2-trace-run-3.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/test-2-runs/run-1.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/test-2-runs/run-2.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/test-2-runs/run-3.json`
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/test-2-runs/debug-pre-repair-run-1.json`

## Commit/push/merge status

- committed: `NO`
- pushed: `NO`
- PR opened: `NO`
- merged: `NO`
