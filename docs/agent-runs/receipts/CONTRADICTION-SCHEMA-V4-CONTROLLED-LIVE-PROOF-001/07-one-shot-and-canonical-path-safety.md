# 07 — One-shot and canonical path safety

## Dual live guards (exact values required)

| Env | Required value |
|-----|----------------|
| `ORVEK_CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF` | `ALLOW_SCHEMA_V4_CONTROLLED_LIVE_PROOF` |
| `ORVEK_CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT` | `CONFIRM_SYNTHETIC_ONLY_ONE_SHOT` |

Mere presence, `"1"`, or other truthy strings must not arm the path.

## Canonical path rules

- Canonical receipt dir:
  `.../docs/agent-runs/receipts/CONTRADICTION-SCHEMA-V4-CONTROLLED-LIVE-PROOF-001/`
- Offline tests use isolated temporary claim paths only.
- This preparation slice must not create or consume the final canonical claim.
- Claim arming states: `unarmed` | `armed` | `consumed`.

## Atomic one-shot consumption (Blocker 3 repair)

- Exclusive execution lock: `ceqr021-execution-lock.json` via `openSync(..., "wx")`.
- Exactly one process acquires execution authority; losers fail before provider construction.
- Lock is never auto-deleted; stale locks are not silently removed.
- Claim is durably marked `consumed` while exclusive ownership is held.
- Concurrent child-process race tests prove exactly one winner and one provider construction.

## Mandatory frozen-plan preflight (Blocker 2 repair)

Production preflight derives authority from canonical files only:

1. Read exact `final-frozen-live-plan.json` bytes; reject missing/malformed/symlink escape.
2. SHA-256 exact plan bytes; require `claim.frozenPlanSha256 ===` that digest.
3. Require Git HEAD === plan.committedExecutionHead === claim.committedExecutionHead.
4. Strict-validate every plan and claim field against pinned constants.
5. Check `OPENAI_API_KEY` presence only after non-provider gates (value never printed).

## Explicitly not created by this patch

- `final-frozen-live-plan.json`
- Armed claim
- Consumed claim
- `ceqr021-execution-lock.json`
- `live-execution-receipt.json`

Committed execution HEAD remains
`PENDING_POST_REVIEW_COMMIT_FREEZE` until a later freeze boundary.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
