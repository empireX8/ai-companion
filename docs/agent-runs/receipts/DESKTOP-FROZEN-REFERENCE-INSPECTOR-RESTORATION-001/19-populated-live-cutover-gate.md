# 19 — Populated live cutover gate

Verdict: **POPULATED LIVE GATE PASSED — READY FOR ROOT CUTOVER**

No hard fail reason recorded.

## Seeded live identities (not reference fixtures)
- ModelUpdate: `cmrq7j09f0000qluudy7gg4bi`
- Open Active Question: `dev-populated-live-aq-1784369498184` — dev-investigations-assault durable investigation active 1784369498184
- Resolved Investigation: `dev-populated-live-inv-1784369498184` — dev-investigations-assault durable investigation resolved 1784369498184
- Decision surface key: `stabilize:s6:claim:dev-durable-actions-assault-claim`

## Capability traces
- Today: live MU/claim → live provider → canonical Today → identity preserved (cmrq7j09f0000qluudy7gg4bi)
- Evidence: selection → canonical Inspector Evidence/Context branch
- Linked navigation: receipt/related → select → Inspector destination
- Report: openReport(live id) → overlay; MU=cmrq7j09f0000qluudy7gg4bi
- Map: conclusions API → mapCategories → canonical MapPage
- Decisions: surfaced actions → decisionListGroups → canonical DecisionsPage
- Active Question: /api/active-questions → exploreQuestionIds → canonical Questions (dev-populated-live-aq-1784369498184)
- Investigation: /api/explore/investigations + inspector detail enrichment → typed investigation → canonical Explore Investigations (dev-populated-live-inv-1784369498184)
- Explore Free: live chat handlers; fixture conversation gated off
- Timeline: timeline API → timelineGroups → canonical TimelinePage

## Captures (1440×900)
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/01-populated-today.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/02-selected-today-object.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/03-evidence-context.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/04-linked-receipt.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/05-linked-related.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/06-back-restoration.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/07-model-movement.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/08-live-report-overlay.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/09-populated-map.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/10-populated-decision.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/11-populated-investigation.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/12-live-explore.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step6-populated-live/13-populated-timeline.png`

## Notes
- Seeded movement MU=cmrq7j09f0000qluudy7gg4bi, decision surface=stabilize:s6:claim:dev-durable-actions-assault-claim, openAQ=dev-populated-live-aq-1784369498184, resolvedInv=dev-populated-live-inv-1784369498184
- No reference fixture identity/copy leak in live body text.
- No reference fixture identity/copy leak in live body text.
- No reference fixture identity/copy leak in live body text.

- Root `/` was not cut over.
- See `20-root-cutover-capability-matrix.md` and Investigation decision in that matrix.
