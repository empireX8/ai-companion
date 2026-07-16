# Explore And Investigations Proof

## Narrow repairs affecting these surfaces

- `components/orvek-v0/workbench.tsx`
  - production workbench and reference workbench now stay explicitly separated
- `components/orvek-workbench/useOrvekExploreChat.ts`
  - live Explore chat grounding/movement stays on production ids
- `lib/orvek-v0/production/hybrid-workbench-api.ts`
  - non-ready Explore, Questions, Investigations, and Fieldwork states now clear production presentation instead of preserving reference bleed
- `components/inspector/WorkbenchInspector.tsx`
  - production Inspector selection stays aligned with the same live object id

## Explore proof

- Canonical production path:
  - `GET /api/session/list?origin=app&surfaceType=explore_chat`
  - `POST /api/message`
  - `GET /api/message/list?sessionId=...`
  - `GET /api/explore/messages/33714563-0b7b-4a63-b322-9a457c8e810f/grounding`
  - `POST /api/explore/sessions/.../movement-proposals/cmrny4sf90004qlicpmws9q6e/publish`
- Exact production ids:
  - conversation `a11ce001-ea01-4000-8000-000000000002`
  - user message `2cd4aa7f-b480-431d-ac2f-9e066899136c`
  - assistant message `33714563-0b7b-4a63-b322-9a457c8e810f`
  - proposal `cmrny4sf90004qlicpmws9q6e`
  - published ModelUpdate `cmrny4u2r0005qlicjrbr4ehn`
- Grounding provenance:
  - `VERIFIED` source id `dev-explore-grounding-movement-assault-journal-verified`
  - `INFERRED` source id `dev-explore-grounding-movement-assault-claim-evidence`
  - no fake `UNVERIFIED` or `PENDING EVIDENCE` substitution was rendered as verified truth
- Cross-surface continuity:
  - Explore published ModelUpdate `cmrny4u2r0005qlicjrbr4ehn`
  - Today report `cmrny4u2r0005qlicjrbr4ehn`
  - Inspector `cmrny4u2r0005qlicjrbr4ehn`
  - Timeline row `cmrny4u2r0005qlicjrbr4ehn`
- Reference isolation:
  - `/dev/orvek-v0-reference` remained visible and labelled
  - production Explore never fell through to the reference transcript or reference grounding chips

## Investigations proof

- Canonical production path:
  - `POST /api/investigations`
  - `POST /api/understanding/evidence-links`
  - `POST /api/fieldwork`
  - `PATCH /api/fieldwork/[watchForId]`
  - `PATCH /api/investigations/[id]`
- Exact production ids:
  - investigation `cmrny5088000cqlica6rx9s56`
  - linked evidence `dev-investigations-assault-evidence-secondary`
  - watch-for / fieldwork `cmrny51ee000eqlicig99n6su`
- Exact Inspector id:
  - `cmrny5088000cqlica6rx9s56`
- Durable continuity proof:
  - evidence linked to the same live investigation
  - watch-for created for the same live investigation
  - fieldwork check-in persisted
  - outcome persisted
  - status progressed to `resolved`
  - closed review re-opened after reload with the same live investigation id
- Honest empty proof:
  - `No investigation is active yet.`
- Reference bleed blocked:
  - no `inv-*` sample row rendered in production
  - no `aq-*` sample row rendered in production

## Targeted regression proof

- `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`
- `lib/__tests__/desktop-old-route-shell-quarantine.test.ts`
- `lib/__tests__/desktop-inspector-assault.test.ts`
- `lib/__tests__/live-evidence-depth-runtime-validation.test.ts`
- `lib/__tests__/live-evidence-depth-runtime-fixture.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`
- result: `PASS`
