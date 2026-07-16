# Timeline And Inspector Proof

## Narrow repairs affecting Timeline and Inspector

- `lib/orvek-v0/data-provider.tsx`
  - production `resolveOrvekObjectFromGraph()` no longer falls through to reference objects
- `components/inspector/WorkbenchInspector.tsx`
  - Inspector panels now stay on the same production identity selected in the surface
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
  - evidence and context panels no longer borrow reference movement or reference objects on live selections
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
  - production detail panels now preserve live ids and live panel routing
- `lib/orvek-v0/workbench-route-history.ts`
  - route synchronization keeps the shared shell page state aligned with direct navigation

## Timeline proof

- Canonical production path:
  - `GET /api/timeline/model-layers`
  - `GET /api/what-changed/cmrny58qz0009qlidggwkoi5w/evidence`
- Exact live production id:
  - `cmrny58qz0009qlidggwkoi5w`
- Exact Inspector id:
  - `cmrny58qz0009qlidggwkoi5w`
- Ordering proof:
  - first visible `timeline-movement-row` carried `data-movement-id="cmrny58qz0009qlidggwkoi5w"`
- Browser proof:
  - `TEST 6 — Timeline provenance`
- Honest empty proof:
  - `No published evolution in this window yet. Capture in journal, Explore, or Fieldwork — mind model movement appears when MindLab publishes it.`
- Sample bleed blocked:
  - no sample movement rendered for the empty user

## Exact Inspector identities proven in browser

- Today ModelUpdate
  - `cmrny3kfp0000qlid56o30lnv`
- Map conclusion
  - `dev-live-evidence-depth-conclusion`
- Decision action
  - `cmrny41y10008qlidn502238j`
- Explore published ModelUpdate
  - `cmrny4u2r0005qlicjrbr4ehn`
- Investigation
  - `cmrny5088000cqlica6rx9s56`
- Timeline ModelUpdate
  - `cmrny58qz0009qlidggwkoi5w`

## Honest Inspector behavior outside live selection

- No selection:
  - title `Select something to inspect`
  - body `Open a receipt, movement item, or attention row on Today to see evidence and context here.`
- Missing live object:
  - missing production ids did not resolve reference objects
  - representative negative status capture recorded in `07-authentication-ownership-and-negative-proof.md`
- Unsupported/reference-only sample state:
  - kept on `/dev/orvek-v0-reference`
  - never resolved as a production Inspector object

## Targeted regression proof

- `lib/__tests__/desktop-inspector-assault.test.ts`
- `lib/__tests__/hybrid-workbench-api.test.ts`
- `lib/__tests__/inspector-surface-wiring.test.ts`
- result: `PASS`
