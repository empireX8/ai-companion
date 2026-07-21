# 06 — Controlled live entry contract

## Opt-in

`RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1` (or `true`)

Missing opt-in exits without provider calls.

## Entry modules

| Piece | Location |
|---|---|
| Adapters | `lib/contradiction-live-provider-adapters.ts` |
| Proof orchestrator | `lib/contradiction-live-provider-referee-proof.ts` |
| CLI | `scripts/run-contradiction-live-provider-referee-proof.ts` |
| Landed chain | `runControlledContradictionNaturalEntryProof` (CEQR-010) |

## Input shape

Synthetic only:

- `CurrentMessageSource` (Side B)
- `SameSessionReferenceRow[]` with authoritative `sourceMessage`
- Isolated user id `ceqr011-live-provider-proof-user-isolated` (never Kay)

## Persistence boundary

Injected in-memory transactional harness (`createLiveProofInMemoryHarness`).

Not the Kay account database. Not an isolated Postgres engine.

## Non-execution contexts

Does not run during:

- normal Vitest
- `npm build`
- ordinary app startup
- route handling
- imports / module evaluation alone
