# 12 — Changed files list (privacy + exit-code correction)

## Code

- `lib/orvek-intelligence-kernel/model-runner.ts`
- `lib/contradiction-live-provider-adapters.ts`
- `lib/contradiction-live-provider-referee-proof.ts` (no real account ID; exit-code helper)
- `lib/__tests__/contradiction-live-provider-referee-execution.test.ts`
- `lib/__tests__/ai-sdk-structured-model-runner-options.test.ts`
- `scripts/run-contradiction-live-provider-referee-proof.ts` (uses exit-code helper)

## Receipts

- `docs/agent-runs/receipts/CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001/**`
- Flat `account-gate-before.json` / `account-gate-after.json` only (redacted)
- Nested `before/` / `after/` duplicates removed

## Privacy

- No hard-coded real account user ID in slice code
- Account receipts redact userId and omit node/span ID lists
