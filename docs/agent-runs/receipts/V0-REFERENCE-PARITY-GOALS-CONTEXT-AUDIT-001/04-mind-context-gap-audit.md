# Mind Context Gap Audit

## What Exists
- The Mind Context surface fetches active references and active patterns.
- The production Context page shows those items in a read-only list.
- The production Map fetches Mind Context display items and counts.

## What Is Missing
- The derived Mind Context / Context Profile layer is not correctable in the UI.
- Map rail items for context do not open to a selectable inspector target in the production click path.
- The Context page does not expose a profile artifact, per-item correction flow, or a direct evidence trail for the derived context layer.

## Reference Contrast
- The reference data marks `Context Profile` as a first-class, correctable model layer.
- The reference Map and Today views both treat that layer as part of the readable model.

## Why It Matters
- This is a hidden profiling risk: the app computes and uses context without a matching user-visible correction surface.
- The gap is blocker-level because it affects a core intelligence layer, not just a label or layout choice.
