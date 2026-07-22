# 03 — Live execution command

## Live command count this slice

**1** (exactly one; no second invocation)

## Command

```bash
set -a && source /Users/user/ai-companion/.env && set +a
RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \
  npx ts-node --transpile-only \
  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/run-contradiction-live-provider-referee-proof.ts
```

## Execution window (UTC)

| Field | Value |
|-------|-------|
| Start | `2026-07-22T11:17:41Z` |
| End | `2026-07-22T11:17:58Z` |
| Process exit code | `4` |

Exit code `4` is the landed live-proof mapping for
`HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED` (semantic clear+referee write not
proven). CEQR-015 classification is determined from case-level evidence, not
from exit code alone.

## Invocation constraints observed

- No manual adjudicator/referee invocation outside the executable
- No ordinary message/import path used
- Opt-in env required and set only for this one command
- No isolated provider experiments
- No retry of any failed case
- No rerun after changing receipts or tests
