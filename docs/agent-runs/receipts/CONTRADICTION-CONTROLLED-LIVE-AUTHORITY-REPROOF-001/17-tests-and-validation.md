# 17 — Tests and validation

## Post-live finalisation note

This document records **post-live receipt finalisation** after the single
authorised Phase-2 run. No provider rerun. No additional account query.

## Pre-live / Phase-1 gates (retained)

| Gate | Result |
|------|--------|
| Focused CEQR-017 | 27 passed / 0 failed |
| Contradiction sweep | 580 passed / 0 failed |
| Full Vitest | 5 fail files / 7 fail tests / 322 pass files / 4406 pass tests — known set not expanded |
| `npx tsc --noEmit` | PASS |
| changed-file ESLint | PASS |
| `npm run build` | PASS |

## Live execution (already completed; not re-run)

| Check | Result |
|-------|--------|
| liveExecuted | true |
| liveProviderAttempts | 3 |
| exitCode | 4 |
| classification | HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED |
| account gates before/after | matched; aggregates unchanged |
| real DB mutation | false |
| claim retained | phase2-live-run-claim.json present |

## Post-live finalisation actions

- Narrative receipts 09–20 updated from canonical JSON + code audit
- Canonical JSON (`live-execution-receipt.json`, account gates, claim) preserved
- No schema/prompt/validation/route edits
