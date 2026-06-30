# Target Decision

## Decision

Keep the existing `components/orvek-v0/pages/explore.tsx` surface and wire its Free Explore composer to the production Explore chat handlers already provided by `OrvekExplorePage`.

## Why this target

- The real Explore chat/log path already exists through `useOrvekExploreChat`.
- Replacing the entire route with the newer `V0ExploreView` would broaden the slice and pull in unrelated behavior, including a question detail route path that is outside this repair.
- The smallest sufficient repair is to reconnect the visible composer controls to the existing production chat path.

## Target behavior

- `Ask` sends the current Explore composer draft to the active `explore_chat` session.
- Production quick prompt chips send their prompt into the same Explore conversation output space.
- Composer focus no longer routes the user into Inspector movement.
- The movement note remains the intentional Inspector-movement handoff.
