# 09 — Live run command (EXECUTED ONCE)

## Status

EXECUTED once under explicit authorisation. The one-shot claim is consumed.
This command must not be re-run for CEQR-019.

## Exact command that was authorised

```bash
cd /Users/user/ai-companion-worktrees/desktop-contradiction-live-semantic-reproof-001
set -a && source /Users/user/ai-companion/.env && set +a
CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED=YES \
CONTRADICTION_LIVE_ADJUDICATOR_MODEL=gpt-4o-mini \
CONTRADICTION_LIVE_REFEREE_MODEL=gpt-4o-mini \
CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS=45000 \
CONTRADICTION_LIVE_MAX_TOTAL_CALLS=6 \
RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \
  npx ts-node --transpile-only \
  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/run-contradiction-controlled-live-semantic-reproof.ts
```

## Result pointer

Live classification: `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN`
See `11-live-execution-result.md`.

No second live execution is authorised automatically.
Production readiness remains NO.
