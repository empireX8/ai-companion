# 28 — Blank card + Model Movement diagnosis

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`

## Blank icon+arrow card

| Step | Finding |
|------|---------|
| Rendered component | Canonical Today side-rail report button (`FileText` + `ArrowRight`) |
| Canonical fields | `today.reportTitle`, `today.reportMeta`, `today.reportId` |
| Live provider bug | `reportId` fell back to `heroSelectionId` when `report` was null → empty title/meta with non-empty click target |
| Classification | LIVE_DATA_MAPPED_TO_WRONG_CANONICAL_FIELD (invented report identity) |
| Repair (partial) | Require titled report before setting `reportId` (no hero fallback). **Omitting the untitled report card was REJECTED by Kay** — card must always render; seed exact titled report data instead. See receipt 29. |

## Model Movement mismatch (prior invalid compare)

| Side | Path |
|------|------|
| Fixture | authored `today.movements` × 3 in `createCanonicalFixtureRuntimeData` |
| Live (valid) | hybrid Today movements from intelligence updates + movement-depth → live-provider |

Prior human observation (populated vs empty) is classified as **WRONG_PAGE_STATE / REFERENCE_STATE_NOT_EQUIVALENT**: live had escaped to `/`, so the compared “live” surface was not the twin candidate.

Isolated gate (receipt 27): fixture≈3 and live≈3 Recent Model Movement cards on Today initial.

## Route isolation

`updateWorkbenchHistory` is a no-op on `/dev/orvek-v0-canonical-*` (and other isolated prefixes) so sidebar/map handlers cannot push `/`, `/your-map`, `/actions`, `/explore`, or `/timeline`.
