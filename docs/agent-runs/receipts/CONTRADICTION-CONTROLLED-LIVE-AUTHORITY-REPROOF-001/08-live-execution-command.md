# 08 — Live execution command

## Status

**EXECUTED EXACTLY ONCE**

| Field | Value |
|-------|-------|
| exitCode | 4 |
| classification | HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED |
| liveRunnerInvocationCount | 1 |
| permanent claim | `phase2-live-run-claim.json` exists and is retained |
| Second provider run | **not authorised** |

The command below is **historical audit evidence only**. Do **not** execute it
again under CEQR-017.

## Historical Phase-2 orchestrator command (do not re-run)

```bash
cd /Users/user/ai-companion-worktrees/desktop-contradiction-controlled-live-authority-reproof-001
set -a && source /Users/user/ai-companion/.env && set +a
CEQR_READONLY_ACCOUNT_USER_ID="$ACCOUNT_ID" \
CONTRADICTION_LIVE_ADJUDICATOR_MODEL=gpt-4o-mini \
CONTRADICTION_LIVE_REFEREE_MODEL=gpt-4o-mini \
CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS=45000 \
CONTRADICTION_LIVE_MAX_TOTAL_CALLS=8 \
RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \
  npx ts-node --transpile-only \
  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/run-ceqr017-phase2-orchestrator.ts
```

Account ID was never serialized; mapping used `"$ACCOUNT_ID"` only.

## Orchestrator sequence (as executed)

1. cd exact CEQR-017 worktree
2. source `.env`
3. pin exact model/timeout/budget env values + readonly account mapping
4. before-account gate with `write: false` → matched
5. atomic `phase2-live-run-claim.json` (`wx`) — claim retained
6. claim winner wrote `account-gate-before.json`
7. exactly one live runner invocation (3 adjudicator / 0 referee attempts)
8. after-account gate wrote `account-gate-after.json` (matched; aggregates unchanged)
9. wrote `live-execution-receipt.json` once after try/finally

`scripts/run-contradiction-controlled-live-authority-reproof.ts` remains an
unconditional hard-stop. CEQR-017 must never be re-run.
