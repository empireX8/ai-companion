# Model Goals Gap Audit

## What Exists
- Goal is present as a generic reference type in the chat memory panel.
- Goal is present as a filterable reference type in the reference list panel.
- The production Map classifies some user-map conclusions into a goals rail.

## What Is Missing
- There is no first-class Model Goal object or dedicated Model Goal surface in production.
- Goal-like items are stored as generic reference memories instead of a separate model layer.
- Today, Map, Decisions, and Actions do not expose goal correction or goal evidence lineage as a visible state.

## Reference Contrast
- The reference workbench has dedicated goal objects in `lib/orvek-v0/orvek-data.ts`.
- The reference Map treats goals as an explicit ontology rail, not just a generic reference type.
- The reference Today view treats movement as a change in model state, not just a list of goal memories.

## Why It Matters
- Model goals can steer decisions even when users cannot inspect or correct them as goals.
- This is an inference from the code paths reviewed, not a claim about hidden runtime behavior beyond what the code shows.
