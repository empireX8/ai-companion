# Fixture Lifecycle And Cleanup

## Fixture helper added

File:

- `lib/investigations-assault-runtime-fixture.ts`

This helper provides:

- deterministic seeded evidence spans
- one cross-user investigation
- one cross-user evidence span
- fixture counting
- fixture cleanup

## Global remaining counts after the authenticated browser assault

As recorded in `playwright-artifacts.json` on `2026-07-16 00:55:52 BST`:

- investigations: `0`
- watch-fors: `0`
- evidence links: `0`
- fieldwork associations: `0`
- outcomes: `0`
- closures: `0`
- investigation model updates: `0`
- seeded evidence objects: `0`
- seeded fieldwork/check-in objects: `0`

## Cleanup report status

- deleted investigations: `2`
- deleted watch-fors: `0`
- deleted evidence links: `0`
- deleted evidence objects: `3`
- deleted messages: `3`
- deleted sessions: `3`
- deleted model updates: `0`

## Historical browser-run deletion counts

- cleanup block persisted successfully in `playwright-artifacts.json`
- no campaign fixture rows remained after the successful authenticated run
