# 00 — Intake and boundaries

## Task

`CONTRADICTION-LIVE-SEMANTIC-CONSISTENCY-REPAIR-001` / CEQR-018

## Exact base

`113e90e88107abb3234d96640b77644eabf5bc8e`

## Authorised

- PHASE 1 — offline contract repair and deterministic proof

## Not authorised

- PHASE 2 — live provider reproof
- `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF`
- CEQR-017 orchestrator / account gates / claim reuse
- real DB query or mutation
- writer against a real account
- production ingestion / message-send / import wiring
- Prisma schema or migration changes
- historical CEQR-011…017 receipt mutation
- staging / commit / push / PR

## Objectives

1. Make forbidden semantic states structurally impossible at the provider
   transport boundary (`clear_contradiction` + any compatibility flag true).
2. Add lexical evidence-span boundary integrity (not complete semantic adequacy).
3. Preserve CEQR-016 source authority (`sourceId` / `exactQuote` code-owned).
4. Preserve deterministic validation as defence in depth.
5. End with offline classification only.
