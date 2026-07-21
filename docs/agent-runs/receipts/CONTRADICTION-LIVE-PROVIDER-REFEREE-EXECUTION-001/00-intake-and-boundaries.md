# 00 — Intake and boundaries

## Task

`CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001` / campaign slice **CEQR-011**

## Exact base

`c9a0c09941c6819b1fd53e864983e4a1eeee65f7` (CEQR-010 / PR #154 landed)

## Goal

Prove a controlled, explicitly invoked, real-provider execution boundary for:

1. the first contradiction adjudicator; and
2. the independent Objectivity Referee;

composing the landed CEQR-010 orchestrator from synthetic persisted-input shapes through the injected in-memory writer harness.

## Hard boundaries (observed)

- No `POST /api/message` wiring
- No import-chatgpt / import route wiring
- No legacy contradiction materialiser invocation
- No mutation of the existing 25 Kay ContradictionNode rows
- No real Kay account database writes from the live proof
- No schema / migration changes
- No credentials committed or printed
- No WeakSet-authorised plan egress
- No public production endpoint for the proof
- No production-readiness claim

## Allowed work

- Provider audit + decision receipts
- Live OpenAI / AI-SDK adapters implementing landed interfaces
- Controlled opt-in script / service harness
- Deterministic tests (no live network in Vitest)
- Read-only account gates before/after
- Sanitized machine-readable receipts
