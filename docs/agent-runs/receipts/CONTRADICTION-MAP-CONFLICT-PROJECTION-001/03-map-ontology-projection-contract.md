# 03 — Map ontology projection contract

## Input extension

`MapMapDataInput.openContradictions?: MapOpenContradictionItem[]`

Kept **separate** from `items` (UserMapConclusion). No conversion of ContradictionNode into UserMapConclusion.

## Rail projection

| Field | Value |
|-------|-------|
| Rail key | `conflicts` |
| Label | Active conflicts |
| Stable object id | `contradiction-<rawId>` |
| Raw id | ContradictionNode id |
| Kind | `contradiction` (new explicit kind) |
| Inspector id | raw CN id |
| recentlyMoved | `false` (open ≠ movement) |

Disputed UserMapConclusion conflicts continue as `kind: "conclusion"` with `conclusion-<id>`.

Both families may share the Active conflicts rail and remain distinguishable by kind / id prefix / inspectorObjectType.
