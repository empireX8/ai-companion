# 27 — Semantic twin isolated equivalence

Verdict: ~~SEMANTIC TWIN GATE PASSED — ISOLATED ROUTES AND EQUIVALENT DATA~~ **REJECTED BY KAY (2026-07-18)**

> Approximate twin + report-card omission. See `29-exact-fixture-round-trip-gate.md`.

No hard fail reason recorded.

## Retraction
Prior SEMANTIC TWIN PASSED (receipt 24) is retracted — comparison was invalid due to live→`/` route escape and misaligned states.

## Isolation
- Live interactions must keep `pathname` under `/dev/orvek-v0-canonical-live`
- Fixture interactions must keep `pathname` under `/dev/orvek-v0-canonical-reference`
- Production `/` was not used in this gate

## Blank card diagnosis
- Source: live-provider set `reportId` from `heroSelectionId` when `report` title/meta were empty
- Field: `today.reportTitle` / `today.reportMeta` empty while FileText+ArrowRight card still rendered
- Repair: refuse hero fallback for reportId; omit untitled report card in canonical Today

## Checks
- **route-isolation-live**: `PASS` — live pathname=/dev/orvek-v0-canonical-live
- **route-isolation-fixture**: `PASS` — fixture pathname=/dev/orvek-v0-canonical-reference
- **blank-icon-arrow-cards**: `PASS` — blank cards fixture=0 live=0
- **today-recent-movement**: `PASS` — fixture movements≈3 live≈3
- **report-overlay**: `PASS` — Report overlay opened without leaving live route
- **linked-back**: `PASS` — Linked navigation + Back stayed on live route
- **final-isolation**: `PASS` — final url=http://localhost:3000/dev/orvek-v0-canonical-live

## Captures
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/01-today-initial-fixture.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/01-today-initial-live.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/02-selected-lead-live.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/03-evidence-live.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/04-movement-tab-live.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/05-report-live.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step9-semantic-twin-isolated/06-linked-live.png`

## Notes
- Seeded dev-semantic-twin for user_3GfxO1sIpEEOAH37Euxb1QKIpHm; MUs=dev-semantic-twin-user_3GfxO1sIpEEOAH37Euxb1QKIpHm-model-update-mu-1,dev-semantic-twin-user_3GfxO1sIpEEOAH37Euxb1QKIpHm-model-update-mu-2,dev-semantic-twin-user_3GfxO1sIpEEOAH37Euxb1QKIpHm-model-update-aq-1-movement
- Compared Today initial: fixture movements=3 live=3; blankCards f/l=0/0
- Live movement tab state: identity=Avoidance appears strongest when social consequence is uncertain. tab=Evidence / Context
- KEEP_SEED user=user_3GfxO1sIpEEOAH37Euxb1QKIpHm email=semantic-twin-iso-primary-1784376388189@example.com password=TwinIso-1784376388189-Aa1!
