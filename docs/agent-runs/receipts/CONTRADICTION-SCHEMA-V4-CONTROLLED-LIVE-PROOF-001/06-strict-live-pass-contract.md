# 06 — Strict live PASS contract

## Offline PASS (this patch)

`PASS_OFFLINE_SCHEMA_V4_LIVE_PROOF_HARNESS_READY`

Means: harness contracts, catalogs, classifier, one-shot safety, orchestration
wiring, and dry-run control flow are ready. Not live proof.

Independent review required: PASS is claimed only after blockers 1–5 regressions
pass offline.

## Future live PASS (not authorised by this patch)

`PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED`

Completed provider calls alone are never sufficient.

## Global PASS accounting (strict)

- exactly 3 observations / frozen case IDs once each
- providerConstructionAttempted === 1
- liveRunnerInvoked === 1
- adjudicatorAttempts === 3; refereeAttempts === 1; totalProviderAttempts === 4
- total === adj + ref; per-case sums match globals
- retries/writers/persistence/account/DB/ingestion/nodes all 0

## Clear / compatible / ambiguous contracts

- Clear: exact `clear_contradiction`, semantic_accepted, flags false, approved
  spans recomputed (ignore `approved: true`), frozen source IDs, referee once.
- Compatible: exact `compatible_states` (not merely “not clear”), no referee.
- Ambiguous: classification null + abstained + nonblank abstention reason; no
  validation_failed disguised as abstention.

## Non-PASS examples (classifier vocabulary)

- `FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN`
- `FAIL_INVALID_BOUNDARY_INDEX`
- `FAIL_SOURCE_AUTHORITY`
- `FAIL_REFEREE_NOT_REACHED`
- `FAIL_WRITER_OR_PERSISTENCE_BOUNDARY`
- `FAIL_CALL_BUDGET`
- `HOLD_LIVE_SCHEMA_V4_PROOF_NOT_YET_EXECUTED`

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
