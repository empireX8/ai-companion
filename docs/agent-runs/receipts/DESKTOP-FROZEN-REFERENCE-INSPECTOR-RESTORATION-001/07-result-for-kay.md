# 07 Result For Kay (presentation restoration correction)

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`

## Verdict

`READY FOR KAY VISUAL REVIEW`

## Correction of prior assessment

The previous agent result that treated the Inspector as “structurally aligned with four narrow defects” was wrong.

Pre-repair production kept a composed read model (useful) but rendered a **raw ModelUpdate report dump** inside reference chrome. That is not reference presentation parity.

## What was repaired in this pass

1. Preserved the composed production ModelUpdate read model / hydration path.
2. Extracted and enforced the frozen-reference Evidence / Context and Model Movement section contract.
3. Mapped live production detail into that contract via `lib/orvek-v0/production/model-update-inspector-presentation.ts`.
4. Removed metadata FactGrid, affected-object dump, evidence-card dump, and full report-section dump from the shared Inspector MU path.
5. Restored receipt quotes + supporting/conflicting short lists + LinkedRows.
6. Restored Movement as before/after + recent movement + Open report.
7. Restored Back scroll position and removed the false “affected-object unavailable” flash.
8. Replaced generic linked-pattern alias titles where production identity exists.
9. Recaptured paired screenshots; wrote explicit gap/repair matrix.

## Exact review inputs

- Authority: `docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md`
- Gap/repair matrix: `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/08-presentation-gap-audit-and-repair.md`
- Screenshots: `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/`
- Manifest: `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/visual-comparison-manifest.json`

## What is not claimed

This does **not** claim:

- visual parity
- complete restoration acceptance
- production readiness
- product completion

Only Kay can accept the visual result.

## Remaining honest live-data differences

- Production content is authenticated live ModelUpdate data, not fixture copy.
- Live report identity is the ModelUpdate id, not `rep-weekly`.
- Today hero cards may still show compact type/object labels outside the Inspector; Inspector identity now prefers `userFacingSummary` / affected identity.

## Next exact step

Kay reviews production vs `/dev/orvek-v0-reference` side by side using the new captures and either accepts or names remaining presentation drift by state.
