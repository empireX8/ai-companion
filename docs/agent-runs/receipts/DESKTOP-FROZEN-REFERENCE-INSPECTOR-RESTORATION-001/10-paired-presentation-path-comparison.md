# 10 — Paired presentation-path comparison (1440×900)

Authority: shared `ObjectDetail` / `MovementView` in
`components/orvek-v0-authority/evidence-panel.tsx` for both routes.

| # | State | Same presentation component? | Remaining difference |
|---|---|---|---|
| 01 | Evidence / Context top | Yes — `ObjectDetail` | Live title/receipts vs curated reference copy |
| 02 | Receipt / supporting / conflicting | Yes — `ObjectDetail` | Live evidence quotes vs reference fixture quotes |
| 03 | Related-object rows | Yes — `ObjectDetail` | Live related ids/titles vs reference map objects |
| 04 | Linked-object detail | Yes — `ObjectDetail` | Live receipt satellite vs reference receipt objects |
| 05 | Back + scroll restore | Yes — shared store + `ObjectDetail` | Scroll values differ by content height |
| 06 | Model Movement top | Yes — `MovementView` | Live before/after vs reference mu-1 copy |
| 07 | Recent movement cards | Yes — `MovementView` | Production uses Today movements; reference uses mu-1..3 |
| 08 | Report overlay top | Yes — shared report overlay | Live report id vs `rep-weekly` |
| 09 | Report overlay lower | Yes — shared report overlay | Live report body vs reference report body |
| 10 | Overlay close / return | Yes — shared overlay + `MovementView` | None structural |
| 11 | Today hero identity | Today page (not Inspector) | Live identity via `resolveModelUpdateDisplayTitle`; no `Link Detected · Related pattern` |

Production-specific ModelUpdate fork (`ProductionModelUpdateEvidenceDetail` /
`ProductionModelUpdateMovementView`) is absent from the active path.
