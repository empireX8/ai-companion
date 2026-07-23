# 10 — Offline dry run

## Scope

Fake-runner dry run of all three frozen cases. Demonstrates expected future
control flow without a real provider adapter.

## Behaviour

- Builds frozen catalogs and selects approved full-proposition spans.
- Simulates ideal adjudicator outcomes for clear / compatible / ambiguous.
- Clear path reaches referee in the simulated control flow.
- Writer / persistence / account / DB remain blocked at 0.
- Classifier may emit offline harness labels such as
  `PASS_OFFLINE_HARNESS_DRY_RUN_SCHEMA_V4_CONTROL_FLOW`.

## Hard rule

Offline dry-run results are **not** live proof and must never be recorded as
`PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED`.

## Artifacts not produced

- No `live-execution-receipt.json`
- No armed/consumed one-shot claim
- No `final-frozen-live-plan.json`

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
