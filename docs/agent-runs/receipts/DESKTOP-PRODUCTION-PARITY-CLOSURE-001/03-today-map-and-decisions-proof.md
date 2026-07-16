# Today, Map, And Decisions Proof

## Narrow repairs applied

1. `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
   - production hybrid hook now boots from `EMPTY_ORVEK_DATA_API`
   - mock/reference state is no longer the default production shell
2. `lib/orvek-v0/production/hybrid-workbench-api.ts`
   - honest shell-state merges for Today, Map, Decisions, Timeline, Explore, Questions, Investigations, and Fieldwork
   - non-ready production no longer preserves reference arrays
3. `lib/orvek-v0/production/today-evidence-pointer-depth-gate.ts`
   - removed silent rewrite to `r6`, `r5`, `r2`
4. `lib/orvek-v0/data-provider.tsx`
   - production object resolution no longer falls through to reference zip objects
   - reference lookup now requires `referenceSurface === true`
5. `lib/orvek-adapters/today.ts`
   - production `/journal-chat` intent no longer pretends to be local overlay capture
6. `lib/orvek-v0/production/map-api.ts`
   - canonical list/detail identity preserved for `dev-live-evidence-depth-conclusion`
7. `playwright.config.ts`
   - closure suite now owns a stable production server on `http://localhost:3100`
   - readiness endpoint switched to `/sign-in`
8. `scripts/desktop-production-parity-closure.playwright.ts`
   - authenticated journeys now use real Clerk sign-in flow
   - protected production pages no longer rely on cookie-only navigation

## Today proof

- Canonical production path:
  - `GET /api/today/intelligence-updates`
  - `GET /api/today/movement-depth`
- Exact live production id:
  - `cmrny3kfp0000qlid56o30lnv`
- Exact Inspector id:
  - `cmrny3kfp0000qlid56o30lnv`
- Exact report overlay id:
  - `cmrny3kfp0000qlid56o30lnv`
- Browser proof:
  - `TEST 1 — Today and report continuity`
  - `today-see-why` preserved `data-movement-id="cmrny3kfp0000qlid56o30lnv"`
  - report overlay preserved `data-report-provenance="live_model_update"`
- Empty-user proof:
  - `No current state surfaced yet.`
  - `No next observation or test surfaced yet.`
  - `No receipts resurfaced in this window yet.`
- Reference bleed blocked:
  - no `rep-*`
  - no `r6`
  - no `r5`
  - no `r2`

## Map proof

- Canonical production path:
  - `GET /api/user-map/conclusions?limit=50&sortOrder=desc`
  - `GET /api/user-map/conclusions/dev-live-evidence-depth-conclusion`
- Exact live production id:
  - `dev-live-evidence-depth-conclusion`
- Exact Inspector id:
  - `dev-live-evidence-depth-conclusion`
- Supporting evidence rendered:
  - `Energy drops after meetings without a stop point.`
- First repaired production-path defect:
  - live list response was present but the shell could drop the visible row during rail/detail hydration
- Intermittent `404` root cause:
  - Clerk middleware signed-out rewrite
  - route handler not entered
  - HTML `404` returned
  - hybrid layer correctly treated the source as unavailable
- Narrow repair:
  - kept the production projection repair
  - standardized real Clerk sign-in bootstrap for browser auth
  - used browser-context cookies only for Clerk bot-bypass support
- Reliability proof:
  - isolated `TEST 2` passed `3/3`
  - final closure suite `TEST 2` passed inside the `7/7` run
- Empty-user proof:
  - endpoint status `200`
  - response body `items: []`
  - UI `Nothing on your map yet.`
  - unavailable copy absent during empty success state
- Reference bleed blocked:
  - no reference Map row rendered
  - no silent fallback from empty or unavailable to reference Map

## Decisions proof

- Canonical production path:
  - `GET /api/actions`
  - `PATCH /api/actions/cmrny41y10008qlidn502238j`
- Exact live production id:
  - `cmrny41y10008qlidn502238j`
- Exact Inspector id:
  - `cmrny41y10008qlidn502238j`
- Durable outcome proof:
  - outcome note persisted
  - reload preserved the same production note and same production id
- Browser proof:
  - `TEST 3 — Decisions continuity`
- Empty-user proof:
  - `No decision invitations yet. When MindLab has enough pattern signal, choices may appear here.`
- Reference bleed blocked:
  - no reference decision row substituted into empty production state

## Targeted regression proof

- `lib/__tests__/today-production-api.test.ts`
- `lib/__tests__/today-adapter-honesty.test.ts`
- `lib/__tests__/today-object-graph-parity.test.ts`
- `lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts`
- `lib/__tests__/map-production-api.test.ts`
- `lib/__tests__/map-presentation-readiness.test.ts`
- `lib/__tests__/your-map-workbench.test.ts`
- `lib/__tests__/decisions-presentation-readiness.test.ts`
- `lib/__tests__/decisions-hybrid-fetch.test.ts`
- `lib/__tests__/decisions-surface.test.ts`
- result: `PASS`
