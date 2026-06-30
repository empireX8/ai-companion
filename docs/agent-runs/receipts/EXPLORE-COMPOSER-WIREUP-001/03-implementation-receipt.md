# Implementation Receipt

## Summary

The Explore Free Explore composer now uses the real production Explore handlers instead of hard-coded Inspector movement for `Ask`, focus, and quick prompts.

## Code changes

- `components/orvek-v0/pages/explore.tsx`
  - Read production Explore composer state from `data.explore`.
  - Use `useOrvekPageHandlers().explore` for draft changes, send, focus, and quick prompt actions.
  - Keep the explicit movement note as the only local Inspector-movement CTA in Free Explore.
  - Surface honest loading and error state in the Explore conversation area.
- `components/orvek-workbench/useOrvekExploreChat.ts`
  - Allow `sendMessage` to accept an optional prompt override for production quick prompt sends.
  - Keep the same `explore_chat` session type, model, response mode, and persistence path.
- `components/orvek-workbench/OrvekExplorePage.tsx`
  - Wire production quick prompts to `sendMessage(prompt)` so they write to the real Explore conversation output.
- `lib/__tests__/explore-composer-wireup.test.ts`
  - Add a narrow regression test for the composer wiring path.

## No-change confirmation

- No schema changes
- No middleware changes
- No generation logic changes
- No broad visual styling changes
