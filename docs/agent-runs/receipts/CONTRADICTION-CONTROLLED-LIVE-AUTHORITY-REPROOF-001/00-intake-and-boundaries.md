# 00 — Intake and boundaries

## Slice

`CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001` / campaign slice **CEQR-017**

## Campaign

`CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001`

## Exact base

`f2fbab22a5935962d2b1456874a24ddba4b9f098` (CEQR-016 merged)

## Phase status (post-live closeout)

| Phase | Status |
|-------|--------|
| Phase 1 — pre-live audit and harness preparation | **Completed** |
| Phase 2 — exactly one controlled live provider run | **Authorised and executed exactly once** |

## Final result

- Classification: `HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED`
- Exit code: 4
- Phase-2 claim (`phase2-live-run-claim.json`): **consumed and retained**
- **No rerun is permitted** for CEQR-017
- Production readiness remains **NO**

## Purpose

Determine whether landed deterministic evidence-authority repair (schema-v2 +
prompt-v3 + addendum-v3 + code-owned sourceId/exactQuote) allows the same
controlled live cases to move beyond CEQR-015
`fabricated_quote` / `source_id_mismatch` failures — without collapsing
structural, semantic, referee, writer, persistence, and production-readiness
into one PASS/FAIL.

## Explicit non-goals

- production integration
- live message-send wiring
- import wiring
- account-data processing
- general contradiction-pipeline rewrite
- product completion
- production readiness (remains **NO**)

## Forbidden (ongoing)

- Real account mutation
- Ordinary Prisma writer against the real account
- Prompt/schema/addendum version bumps inside this closeout
- Weakening validation
- Mutating raw provider output
- Second provider run / second claim under CEQR-017
- Additional real-account gate queries
- Staging / commit / push / PR unless Kay requests it
