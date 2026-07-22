# 11 — Next live proof boundary

## Required for any future live proof

- separately named task (not CEQR-017 / not this slice)
- new claim path (do not reuse CEQR-017 permanent claim)
- explicit user authorisation for Phase 2
- fresh provider-call budget
- fresh account-mutation boundary decision
- new receipt directory

## Must not happen from this slice

- set `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF`
- invoke CEQR-017 orchestrator
- query or mutate the real database
- wire production ingestion routes

## Suggested next task name (informational only)

`CONTRADICTION-CONTROLLED-LIVE-SEMANTIC-CONSISTENCY-REPROOF-001`
