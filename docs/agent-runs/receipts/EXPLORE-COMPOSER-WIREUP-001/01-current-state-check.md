# Current State Check

## Observed production path

- `/explore` mounts `OrvekExplorePage`.
- `OrvekExplorePage` already boots a real `explore_chat` session through `useOrvekExploreChat`.
- `buildExploreProductionDataApi` already maps Explore chat messages and composer state into the production Orvek data contract.

## Observed failure

- `components/orvek-v0/pages/explore.tsx` hard-coded Free Explore composer focus, `Ask`, and quick prompt chips to `setInspectorTab("movement")`.
- The real Explore chat path existed underneath that UI, but the visible v0 controls bypassed it.

## Boundary to preserve

- The end-of-turn movement note is the correct place to open Inspector movement.
- Explore question evidence drill-ins should remain Inspector/evidence scoped.
- No Explore action should expose blocked legacy public routes.

## Verdict

`explore-composer-wireup` was a real wrong-target wiring defect, not a missing backend capability.
