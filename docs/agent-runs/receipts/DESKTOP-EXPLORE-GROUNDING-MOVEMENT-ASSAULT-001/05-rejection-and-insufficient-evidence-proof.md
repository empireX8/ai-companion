# 05 — Rejection and insufficient evidence proof

## Status

**PASS** (Playwright tests 2 and 3)

## Rejection

- Sufficient evidence → PROPOSED MODEL MOVEMENT visible
- Explicit reject/dismiss → proposal remains rejected and no `user_visible` ModelUpdate is created
- Reload does not convert rejection into publication
- Today / Timeline / report APIs do not surface rejected movement as published

## Insufficient evidence

- Quantum-potatoes probe message produces no publishable proposal
- No fake grounding chips for cross-user or empty owned evidence
- Honest empty / insufficient UI path

## Script

`scripts/explore-grounding-movement-assault.playwright.ts` — tests 2–3 passed in final run.
