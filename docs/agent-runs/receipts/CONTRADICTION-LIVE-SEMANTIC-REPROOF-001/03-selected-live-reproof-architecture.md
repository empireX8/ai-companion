# 03 — Selected live reproof architecture

## Path chosen

New distinct harness — do not mutate or re-run CEQR-017.

| Piece | Path |
|---|---|
| Contract + orchestration | `lib/contradiction-controlled-live-semantic-reproof.ts` |
| Offline tests | `lib/__tests__/contradiction-controlled-live-semantic-reproof.test.ts` |
| Live entry (explicit only) | `scripts/run-contradiction-controlled-live-semantic-reproof.ts` |
| Receipts | `docs/agent-runs/receipts/CONTRADICTION-LIVE-SEMANTIC-REPROOF-001/` |

## Design

1. Reuse the frozen CEQR-015/017 synthetic case texts for baseline comparability.
2. Pin active schema-v3 transport (CEQR-018).
3. Dual live guards (CEQR-019 unique + underlying live opt-in).
4. No account gate; no real database client; synthetic in-memory harness only.
5. Production live entry locks exact worktree cwd + canonical receipt directory.
6. Test-only orchestration requires an opaque capability + injected fake runner.
7. One-shot `live-run-oneshot-claim.json` created only when live is authorised.
8. Strict PASS requires inspectable `caseObserver` observations for all three cases:
   clear must be `semantic_accepted` + validation `valid` + all flags false +
   `clearContradictionWriteProven`; compatible/ambiguous must never be
   `clear_contradiction` (even with no write).
9. Provider-call counts are taken from the captured adapter call budget on every
   return path, including thrown exceptions.

## Why not re-run CEQR-017

CEQR-017 permanently claimed one live run under schema-v2. Re-running it would
overwrite historical authority and confuse schema identity.
