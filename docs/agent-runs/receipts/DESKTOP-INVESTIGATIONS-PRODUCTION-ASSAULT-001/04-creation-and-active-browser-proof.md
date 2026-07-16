# Creation And Active Browser Proof

## Real production creation path implemented

Files:

- `components/investigations/InvestigationCreateCard.tsx`
- `app/(root)/(routes)/active-questions/page.tsx`

Visible production controls:

- `data-testid="active-questions-create-card"`
- `data-testid="active-questions-create-title"`
- `data-testid="active-questions-create-question"`
- `data-testid="active-questions-create-submit"`
- `data-testid="active-questions-create-success-id"`

Create route used by UI:

- `POST /api/investigations`

## Browser assault file added

- `scripts/investigations-production-assault.playwright.ts`

Target tests coded:

1. `TEST 1 — create and reload`
2. `TEST 2 — watch-for, evidence and fieldwork activity`
3. `TEST 3 — outcome and closure`
4. `TEST 4 — empty/reference isolation`
5. `TEST 5 — authentication, ownership and malformed requests`

## Actual Playwright result

- Playwright artifacts timestamp: `2026-07-16 00:55:52 BST`
- Playwright metadata timestamp: `2026-07-16 00:55:54 BST`
- `Running 5 tests using 1 worker`
- Result: `5 passed`

Exact outcomes:

1. `TEST 1 — create and reload` -> `PASS`
2. `TEST 2 — watch-for, evidence and fieldwork activity` -> `PASS`
3. `TEST 3 — outcome and closure` -> `PASS`
4. `TEST 4 — empty/reference isolation` -> `PASS`
5. `TEST 5 — authentication, ownership and malformed requests` -> `PASS`

Exact browser-run creation proof:

- investigation ID: `cmrmqfgtf000uqlcyy5ebe8fe`
- title: `dev-investigations-assault durable investigation create-and-reload 1784159371680`
- organizing question: `dev-investigations-assault organizing question create-and-reload 1784159371680`
- row appearance proof: `one active-question row rendered before and after two reload recoveries`
- reload persistence proof: `the same investigation ID remained visible after reload and detail reopen`
- Inspector identity proof: `Investigation ID cmrmqfgtf000uqlcyy5ebe8fe`
