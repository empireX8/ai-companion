# 03 — Live execution command

## Live run count in this slice

**1** (exactly one; no second invocation)

## Command

```bash
set -a && source /Users/user/ai-companion/.env && set +a
RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \
  npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/run-contradiction-live-provider-referee-proof.ts
```

## Execution window (UTC)

| Field | Value |
|-------|-------|
| Start | `2026-07-22T09:18:16Z` |
| End | `2026-07-22T09:18:33Z` |
| Process exit code | `4` |

Exit code `4` is the landed live-proof mapping for
`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED` (semantic clear+referee write not
proven). This does not preclude CEQR-013 diagnostic PASS.

## Invocation constraints observed

- No manual adjudicator/referee invocation outside the executable
- No ordinary message/import path used
- Opt-in env required and set only for this one command
