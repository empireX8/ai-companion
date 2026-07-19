# 04 — Production object and Inspector contract

## Object builder

`lib/orvek-v0/production/map-api.ts` → `railItemToOrvekObject` for `kind === "contradiction"`:

| Field | Value |
|-------|-------|
| type | `map-object` |
| subtype | `conflict` |
| inspectorObjectType | `contradiction_node` |
| inspectorObjectId | raw ContradictionNode id |
| title | CN title |
| summary | truthful side A / side B summary |
| supporting / conflicting | Side A / Side B (when present) |
| confidence | formatted ReferenceConfidence |
| evidenceCount | row count (may be 0) |
| lastUpdated | lastTouchedAt |
| before / after | **not set** (no fabricated movement) |

Also registers raw id alias so `getObject(rawId)` resolves with the same Inspector metadata.

## Selection → Inspector

`ProductionInspectorBridge` uses `object.inspectorObjectType` first → `contradiction_node` → `fetchInspectorContradiction(rawId)`.

No fallback to `usermap_conclusion` when metadata is present.
