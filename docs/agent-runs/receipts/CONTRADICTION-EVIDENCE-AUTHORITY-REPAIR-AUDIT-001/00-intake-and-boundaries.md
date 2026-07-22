# 00 — Intake and boundaries

## Task
CONTRADICTION-EVIDENCE-AUTHORITY-REPAIR-AUDIT-001 / CEQR-016

## Exact base
`b6c10a8334d2c57033272eb97a845a91269327fa`

## Goal
Audit whether the contradiction adjudicator gives the language model authority over `evidenceClaim.sourceId` and `evidenceClaim.exactQuote`, then implement the narrowest safe structural repair.

## Boundaries observed
- No live provider execution
- No real database mutation
- No schema migrations
- No UI changes
- No ordinary route/import wiring
- No rewrite of CEQR-013…015 historical receipts
- No prompt-only v3 declared as the fix (v3 addendum is a structural companion only)

## Allowed work
- Audit authority boundary
- Path A structural repair if supported
- Focused tests + receipts
- Version identity bumps for schema/prompt/live-addendum

## Forbidden work
- Provider-output mutation / silent overwrite
- Fuzzy match, quote search, clamp, full-source fallback
- Weakening deterministic validation
- Live provider / real DB writes
