# 09 — Next slice boundary

## Done in CEQR-004

- Same-session retrieval for legacy detector + selection query contract
- Exact source-unit assembly and completeness fail-closed checks
- Provider-agnostic zero-or-one semantic selection orchestrator
- Ambiguity abstention for multiple Class A passes
- Explicit persistence blocking on selection results
- Live/import/backfill session-boundary wiring
- Contract tests with injected fake runners/referees only

## Explicitly not done (do not pull forward early)

| Slice | Scope |
|-------|--------|
| **CEQR-005** | Dual-side exact span lineage migration — blocked until dependency gate reviewed |
| Referee execution | Shared AI Objectivity Referee implementation |
| Confidence calibration | CEQR-006 |
| Duplicate redesign | CEQR-007 |
| UI dual-source | CEQR-008 / CEQR-009 |
| Natural-entry proof | CEQR-010 |
| Existing-25 disposition | Separate authorisation only |

## Safe next step

Review the CEQR-005 dependency gate. Do not begin durable lineage migration until:

- zero-or-one same-session selection remains green
- exact provenance objects are supplied to candidate construction
- referee interface remains available
- persistence authorisation is still distinct from semantic selection

## Standing invariants

- Existing 25 remain untouched without separate authorisation
- Production readiness remains **NO**
- CEQR-001, CEQR-002 and CEQR-003 remain landed and must not be weakened
- Semantic selection must not be cast into persistable detection types
