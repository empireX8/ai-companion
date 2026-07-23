# 00 — Intake and boundaries

## Slice

`CONTRADICTION-SCHEMA-V4-CONTROLLED-LIVE-PROOF-001` / campaign slice `CEQR-021`

## Purpose

Offline preparation of a schema-v4 controlled live-proof harness. This patch
builds contracts, catalogs, classifiers, and receipts only. It does not run a
live provider, arm a claim, or authorise future live execution.

## Worktree / branch

- Branch: `desktop-contradiction-schema-v4-controlled-live-proof-001`
- Worktree: `/Users/user/ai-companion-worktrees/desktop-contradiction-schema-v4-controlled-live-proof-001`
- Base HEAD: `785d88640fdb284805a958f5a7f25cd0c68b7188`
- Committed execution HEAD field: `PENDING_POST_REVIEW_COMMIT_FREEZE`

## Hard boundaries

- No live provider calls.
- No real account / database / writer / persistence calls.
- No `final-frozen-live-plan.json`, armed claim, consumed claim, or
  `live-execution-receipt.json`.
- CEQR-019 historical live failure remains immutable and is never rerun.
- JSON plan/claim artifacts are code-generated later; this corpus is markdown only.

## Offline classification target

`PASS_OFFLINE_SCHEMA_V4_LIVE_PROOF_HARNESS_READY`

Future live PASS (not authorised here):
`PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED`

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
