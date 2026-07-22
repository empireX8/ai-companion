# 02 — Current prompt and evidence trace

## Audit answers

| # | Question | Finding |
|---|----------|---------|
| 1 | Where `sourceId` enters the prompt | `lib/contradiction-adjudicator.ts` user prompt lines `Side A sourceId:` / `Side B sourceId:` from `sideA.sourceId` / `sideB.sourceId` |
| 2 | Where `sourceText` enters the prompt | Same file: `Side A sourceText:` / `Side B sourceText:` |
| 3 | Is `sourceText` represented as JSON? | **YES** — `JSON.stringify(sideA.sourceText)` / `JSON.stringify(sideB.sourceText)` |
| 4 | What the live wrapper adds | `wrapAdjudicatorRunnerForLiveEvidence` appends `LIVE_ADJUDICATOR_EVIDENCE_ADDENDUM` to `request.system` only |
| 5 | Is `request.prompt` currently changed? | **NO** — wrapper spreads request and only replaces `system` |
| 6 | Is the output object ever modified? | **NO** — wrapper returns `runner.runStructured(...)` result unchanged (same object reference) |
| 7 | Where `exactQuote` is validated | `lib/orvek-intelligence-kernel/evidence-validation.ts` → `validateExactEvidenceClaim` (`fabricated_quote` when slice ≠ quote) |
| 8 | Where `sourceId` is validated | Same file (`source_id_mismatch` when claim.sourceId ≠ source.sourceId); dual-side cross-pointing → `cross_side_source` |
| 9 | Dynamic transport-schema equality without weakening? | OpenAI-strict nullable transport already exists; no further equality change needed for this repair |
| 10 | Narrowest safe repair boundary | Live-wrapper addendum + version identity only (v1 → v2). Generic kernel prompt unchanged |

## Related modules traced

- `lib/contradiction-live-provider-adapters.ts`
- `lib/contradiction-adjudicator.ts`
- `lib/contradiction-live-sanitized-diagnostics.ts`
- `lib/contradiction-live-provider-referee-proof.ts`
- `lib/orvek-intelligence-kernel/structured-output.ts`
- `lib/orvek-intelligence-kernel/evidence-validation.ts`
- `lib/orvek-intelligence-kernel/model-runner.ts`
- CEQR-011 / CEQR-012 / CEQR-013 receipts
- Related live/adjudication tests
