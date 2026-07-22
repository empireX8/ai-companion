# 18 — Changed files list

## CEQR-017 worktree files (Phase-1 + Phase-2 + post-live)

```
docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001/**
lib/__tests__/contradiction-controlled-live-authority-reproof.test.ts
lib/ceqr017-account-gate-path.ts
lib/ceqr017-phase2-orchestration.ts
lib/ceqr017-readonly-account-gate.ts
lib/ceqr017-whitespace-scan.ts
lib/contradiction-controlled-live-authority-reproof.ts
lib/contradiction-controlled-natural-entry-proof.ts
lib/contradiction-live-provider-referee-proof.ts
lib/contradiction-same-session-selection.ts
scripts/run-ceqr017-phase2-orchestrator.ts
scripts/run-contradiction-controlled-live-authority-reproof.ts
```

## Post-live narrative receipts

First finalisation updated `09`–`20` (+ `changed-files.txt`).

**Post-live receipt coherence correction** additionally updated:

- `00-intake-and-boundaries.md`
- `06-provider-budget-and-timeout-policy.md`
- `07-account-gate-before.md`
- `08-live-execution-command.md`
- `10-clear-case-result.md`
- `14-writer-and-persistence-result.md`
- `18-changed-files-list.md`

## Canonical JSON preserved byte-unchanged

- `phase2-live-run-claim.json`
- `account-gate-before.json`
- `account-gate-after.json`
- `live-execution-receipt.json`
- `pre-live-validation-summary.json` (explicitly a pre-live artifact)

## Unchanged (must remain byte-clean)

- Historical CEQR-011…016 receipt directories
- Production routes / ordinary app surfaces
- Schema / Prisma migrations
- Adjudicator / prompt / validation / route / script code (this correction is narrative-only)
