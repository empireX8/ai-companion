# Visual Alignment Notes

Manual comparison attempted:
- Started the local app with `npm run dev -- --hostname 127.0.0.1 --port 3000`.
- Initial screenshots hit Clerk/proxy failure because middleware rewrote to `localhost` while the server was bound to `127.0.0.1`.
- Restarted with `npm run dev -- --hostname localhost --port 3000`.
- Captured Playwright screenshots for:
  - `http://localhost:3000/dev/orvek-v0-reference`
  - `http://localhost:3000/`

Live visual result:
- `PARTIAL`
- Both local routes rendered Clerk sign-in for the unauthenticated browser session, so no live production Inspector with selected evidence could be visually compared.
- No middleware/auth changes were made because they are explicitly forbidden in this slice.

Reference artifacts used for comparison:
- `.reference/v0-orvek-workbench/inspector.png`
- `.reference/v0-orvek-workbench/movement.png`
- `.reference/v0-orvek-workbench/s-inspector.png`
- `.reference/v0-orvek-workbench/components/orvek/evidence-panel.tsx`

Static/code comparison result:
- Production Inspector outer shell already matched the accepted fixed rail direction.
- Evidence / Context inner panels now match the reference section cadence more closely: header spacing, small section labels, compact cards, related rows, and correction callout.
- Mind Model Movement now matches the reference movement readout direction more closely: no legacy material blocks, no border-heavy header, structured before/after cards, and compact evidence rows.
- The trust repair structure remains visible rather than being flattened into purely visual cards.

Remaining visual gap:
- A live authenticated product-owner visual pass is still required to validate selected-object states against real production data.

