# 21 — Root cutover review

Verdict: **READY FOR KAY ROOT-CUTOVER VISUAL REVIEW**

> **RETRACTED (2026-07-18):** Kay compared production `/` to the frozen reference
> and found production dramatically thinner. Canonical architecture + root wiring
> remain accepted; live provider contract completeness failed the human review.
> See `23-reference-live-contract-inventory.md`, `24-semantic-twin-live-contract-gate.md`,
> and `26-real-account-diagnosis-after-semantic-twin.md`. Do not treat this receipt
> as visual acceptance.


No hard fail reason recorded.

## Production root paths
- Shell: `components/orvek-workbench/OrvekWorkbenchShell.tsx`
- Shared runtime: `components/orvek-v0-canonical/canonical-live-runtime-entry.tsx`
- Live provider: `components/orvek-v0-canonical/live-provider.ts` (`buildCanonicalLiveRuntimeData`)
- Hybrid data: `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
- Presentation: `components/orvek-v0-canonical/workbench.tsx` + `pages/*`

## Inactive parallel presentation (retained on disk)
- `components/orvek-v0/workbench.tsx`
- `components/orvek-v0/pages/*`
- Temporary rollback route: `/dev/orvek-v0-parallel-production-rollback` (not reference; not production authority)

## Unchanged cold / fixture
- `/dev/orvek-v0-reference`
- `/dev/orvek-v0-canonical-reference`
- Live candidate retained: `/dev/orvek-v0-canonical-live`

## Seeded live identities (kept for Kay review)
- ModelUpdate: `cmrq7uymy0000qlccc21qjo3c`
- Open Active Question: `dev-populated-live-aq-1784370055907` — dev-investigations-assault durable investigation active 1784370055907
- Resolved Investigation: `dev-populated-live-inv-1784370055907` — dev-investigations-assault durable investigation resolved 1784370055907
- Decision surface key: `stabilize:s6:claim:dev-durable-actions-assault-claim`
- Primary Clerk user: `user_3GfkY153edzcz5FzJhlCMFybtmc` / `populated-primary-1784370053828@example.com`
- KEEP_SEED: `true` — cleanup only when `ROOT_CUTOVER_CLEANUP=1` after Kay review
- Review sign-in password (disposable): `Kay-RootCutover-Review-Aa1!`

## Deferred product decision (does not block cutover)
- attach-evidence / create-watch-for cards from `ProductionInvestigationWorkbenchDetail`
- No accepted-reference equivalent; not required for canonical investigation path
- Recorded as post-cutover product decision; not restored in this campaign

## Capability traces
- Today: live MU/claim → live provider → canonical Today → identity preserved (cmrq7uymy0000qlccc21qjo3c)
- Evidence: selection → canonical Inspector Evidence/Context branch
- Linked navigation: receipt/related → select → Inspector destination
- Report: openReport(live id) → overlay; MU=cmrq7uymy0000qlccc21qjo3c
- Map: conclusions API → mapCategories → canonical MapPage
- Decisions: surfaced actions → decisionListGroups → canonical DecisionsPage
- Active Question: /api/active-questions → exploreQuestionIds → canonical Questions (dev-populated-live-aq-1784370055907)
- Investigation: /api/explore/investigations + inspector detail enrichment → typed investigation → canonical Explore Investigations (dev-populated-live-inv-1784370055907)
- Explore Free: live chat handlers; fixture conversation gated off
- Timeline: timeline API → timelineGroups → canonical TimelinePage

## Captures (1440×900)
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/01-populated-today.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/02-selected-today-object.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/03-evidence-context.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/04-linked-receipt.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/05-linked-related.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/06-back-restoration.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/07-model-movement.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/08-live-report-overlay.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/09-populated-map.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/10-populated-decision.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/11-populated-investigation.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/12-live-explore.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/13-populated-timeline.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step7-root-cutover/14-canonical-live-equivalence-spot.png`

## Notes
- Seeded movement MU=cmrq7uymy0000qlccc21qjo3c, decision surface=stabilize:s6:claim:dev-durable-actions-assault-claim, openAQ=dev-populated-live-aq-1784370055907, resolvedInv=dev-populated-live-inv-1784370055907
- Production `/` mounts orvek-v0-production-canonical-root (canonical runtime).
- No reference fixture identity/copy leak in production body text.
- No reference fixture identity/copy leak in production body text.
- No reference fixture identity/copy leak in production body text.
- WARNING: canonical-live Today identity not immediately visible on spot-check.
- KEEP_SEED=true: Clerk users + DB seeds retained for Kay visual review. Cleanup: ROOT_CUTOVER_CLEANUP=1 after review.
- Seeded primary userId=user_3GfkY153edzcz5FzJhlCMFybtmc email=populated-primary-1784370053828@example.com; cross=user_3GfkYB5mIQayPil8ZHSxJAUIDYg
