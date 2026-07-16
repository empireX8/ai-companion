# Browser Journeys And Fixture Cleanup

## Aggregate browser result

- Dedicated global production-parity Playwright suite:
  - `scripts/desktop-production-parity-closure.playwright.ts`
- Aggregate artifact:
  - `docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001/playwright-artifacts.json`
- Final result:
  - completed `7`
  - passed `7`
  - status `passed`

## Seven required journeys

1. `TEST 1 — Today and report continuity`
   - `PASS`
   - exact ids:
     - Today ModelUpdate `cmrny3kfp0000qlid56o30lnv`
     - report overlay `cmrny3kfp0000qlid56o30lnv`
     - Inspector `cmrny3kfp0000qlid56o30lnv`
2. `TEST 2 — Map and Inspector`
   - `PASS`
   - exact ids:
     - Map conclusion `dev-live-evidence-depth-conclusion`
     - Inspector `dev-live-evidence-depth-conclusion`
3. `TEST 3 — Decisions continuity`
   - `PASS`
   - exact ids:
     - decision action `cmrny41y10008qlidn502238j`
     - Inspector `cmrny41y10008qlidn502238j`
4. `TEST 4 — Explore grounding and movement continuity`
   - `PASS`
   - exact ids:
     - conversation `a11ce001-ea01-4000-8000-000000000002`
     - user message `2cd4aa7f-b480-431d-ac2f-9e066899136c`
     - assistant message `33714563-0b7b-4a63-b322-9a457c8e810f`
     - proposal `cmrny4sf90004qlicpmws9q6e`
     - published ModelUpdate `cmrny4u2r0005qlicjrbr4ehn`
5. `TEST 5 — Investigations continuity`
   - `PASS`
   - exact ids:
     - investigation `cmrny5088000cqlica6rx9s56`
     - evidence `dev-investigations-assault-evidence-secondary`
     - watch-for `cmrny51ee000eqlicig99n6su`
     - Inspector `cmrny5088000cqlica6rx9s56`
6. `TEST 6 — Timeline provenance`
   - `PASS`
   - exact ids:
     - ModelUpdate `cmrny58qz0009qlidggwkoi5w`
     - Inspector `cmrny58qz0009qlidggwkoi5w`
7. `TEST 7 — global empty, unavailable, auth, and reference isolation`
   - `PASS`
   - exact negative-proof investigation id:
     - `cmrny5t7d000fqlichep227fs`

## Preserved Map reliability artifacts

- Isolated `TEST 2` artifacts preserved:
  - `test-2-runs/run-1.json`
  - `test-2-runs/run-2.json`
  - `test-2-runs/run-3.json`
  - `test-2-runs/debug-pre-repair-run-1.json`
  - `map-test-2-trace-run-1.json`
  - `map-test-2-trace-run-2.json`
  - `map-test-2-trace-run-3.json`
- Exact outcome for each run:
  - run `1`: populated endpoint `200, 200, 200`; empty endpoint `200, 200`; visible id `dev-live-evidence-depth-conclusion`; Inspector id `dev-live-evidence-depth-conclusion`; cleanup counts all `0`
  - run `2`: populated endpoint `200, 200, 200`; empty endpoint `200, 200`; visible id `dev-live-evidence-depth-conclusion`; Inspector id `dev-live-evidence-depth-conclusion`; cleanup counts all `0`
  - run `3`: populated endpoint `200, 200, 200`; empty endpoint `200, 200`; visible id `dev-live-evidence-depth-conclusion`; Inspector id `dev-live-evidence-depth-conclusion`; cleanup counts all `0`
- Pre-repair retained root-cause artifact:
  - `test-2-runs/debug-pre-repair-run-1.json`
  - safe proof only:
    - context preflight `200`
    - browser preflight `404`
    - `handlerEntered: false`
    - `x-clerk-auth-status: signed-out`
    - `x-clerk-auth-reason: protect-rewrite, session-token-and-uat-missing`
    - `middlewareRewrite: /clerk_1784218926421`

## Fixture cleanup

- Movement fixtures remaining:
  - `remainingModelUpdates: 0`
  - `remainingLinks: 0`
- Durable actions fixtures remaining:
  - `remainingConclusions: 0`
  - `remainingActions: 0`
  - `remainingFieldwork: 0`
- Explore fixtures remaining:
  - `remainingConversations: 0`
  - `remainingMessages: 0`
  - `remainingProposals: 0`
  - `remainingModelUpdates: 0`
  - `remainingMovementEvidenceLinks: 0`
  - `remainingSeededMapEvidenceObjects: 0`
- Investigations fixtures remaining:
  - `investigations: 0`
  - `watchFors: 0`
  - `evidenceLinks: 0`
  - `fieldworkAssociations: 0`
  - `outcomes: 0`
  - `closures: 0`
  - `investigationModelUpdates: 0`
  - `seededEvidenceObjects: 0`
  - `seededFieldworkObjects: 0`

## Cleanup result

All campaign fixture remaining counts were zero after the successful closure run.
