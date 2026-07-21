# 07 — Domain Inspector presentation (CEQR-009 Path A)

## Panel

`components/inspector/panels/ContradictionsInspectorPanel.tsx`

## Data

Still reads `/api/contradiction/[id]` when on `/contradictions/[id]`.

Detail GET now always attaches `dualSource` from ordered span FKs.

## Render

Uses shared `ContradictionDualSourceView` with `compact` layout:

- Side A interpretation / Side A source
- Side B interpretation / Side B source
- Legacy / partial / integrity notices via shared copy helpers

No truncation-only proposition display for active detail when `dualSource` is present.
