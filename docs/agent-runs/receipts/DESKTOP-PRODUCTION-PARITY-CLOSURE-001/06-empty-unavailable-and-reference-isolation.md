# Empty, Unavailable, And Reference Isolation

## Exact honest empty states proven

- Today
  - `No current state surfaced yet.`
  - `No next observation or test surfaced yet.`
  - `No receipts resurfaced in this window yet.`
- Map
  - `Nothing on your map yet.`
- Decisions
  - `No decision invitations yet. When MindLab has enough pattern signal, choices may appear here.`
- Explore grounding
  - `Grounding chips appear when linked evidence is available.`
- Explore questions
  - `No active questions are open yet.`
- Explore investigations
  - `No investigation is active yet.`
- Timeline
  - `No published evolution in this window yet. Capture in journal, Explore, or Fieldwork — mind model movement appears when MindLab publishes it.`
- Inspector
  - `Select something to inspect`
  - `Open a receipt, movement item, or attention row on Today to see evidence and context here.`

## Exact unavailable/error copy preserved

- Map
  - `Could not load your map.`
- Decisions
  - `Could not load decisions.`
- Timeline list
  - `Could not load timeline.`
- Timeline movement
  - `Could not load mind model movement.`

## Recorded-state classification result

- Recorded-state universe empty states:
  - row `1` only
  - final classification `INTENTIONAL EMPTY`
- Recorded-state universe unavailable states:
  - none
  - final `INTENTIONAL UNAVAILABLE`: `0`

## Explicit reference isolation proof

- Allowed explicit sample/reference route:
  - `/dev/orvek-v0-reference`
- Isolation contract:
  - `referenceSurface === true`
- Browser proof:
  - `TEST 4 — Explore grounding and movement continuity`
  - `TEST 7 — global empty, unavailable, auth, and reference isolation`
- Reference sample controls remained isolated:
  - `orvek-v0-reference-route`
  - `reference-sample-report-control`

## Production no-leak result

- Empty production states did not render reference Today, Map, Decisions, Explore, Investigations, Timeline, or Inspector content.
- Successful populated production states did not render unavailable copy.
- Missing live ids did not resolve reference objects.
- Unsupported sample rows remained developer-only.
