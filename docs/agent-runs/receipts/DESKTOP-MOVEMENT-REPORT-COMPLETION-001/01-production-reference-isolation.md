# 01 — Production / reference isolation

## Decision

Reference report subtypes remain **reference-only**. This is an intentional boundary, not an unresolved production ambiguity.

## Changes

| Area | Result |
|---|---|
| Today `/what-changed` route intent | No longer stamps `reportId: "rep-weekly"` (`lib/orvek-adapters/today.ts`) |
| Today aside sample control | Rendered only when `data.referenceSurface === true`; labelled `REFERENCE / SAMPLE` |
| Hybrid root (`useOrvekHybridWorkbenchDataApi`) | Forces `referenceSurface: false` |
| Pure mock workbench | Sets `referenceSurface: true` |
| Overlay / production journey | Never opens zip/`rep-weekly` for a live ModelUpdate ID |

## Proof

Authenticated Playwright production journey asserted:

- `reference-sample-report-control` count = 0
- visible text `rep-weekly` count = 0

Reference route `/dev/orvek-v0-reference` still exposes the sample control and labels it `REFERENCE / SAMPLE REPORT`.

## Verdict

Production controls no longer silently substitute `rep-weekly`, zip/reference data, or mock report identity for a live ModelUpdate.
