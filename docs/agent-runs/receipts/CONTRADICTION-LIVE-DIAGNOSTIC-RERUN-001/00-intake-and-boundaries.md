# 00 — Intake and boundaries

## Task

`CONTRADICTION-LIVE-DIAGNOSTIC-RERUN-001` / campaign slice **CEQR-013**

## Campaign

`CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001`

## Exact base

`64c79a7d424aefb9d7e499c07c0d240233211284`

## Branch / worktree

- Branch: `desktop-contradiction-live-diagnostic-rerun-001`
- Worktree: `/Users/user/ai-companion-worktrees/desktop-contradiction-live-diagnostic-rerun-001`

## Goal

Perform exactly one controlled opt-in live diagnostic rerun under the
unchanged CEQR-011 provider prompt, capturing sanitized deterministic
failure diagnostics sufficient to identify the earliest gate and validation
codes for each synthetic case.

## Hard boundaries (observed)

- Diagnostic execution only — no post-run prompt/schema/validation repair
- No second live provider invocation
- No provider-output mutation
- No runtime prompt change vs CEQR-011 addendum v1
- No real Prisma persistence; injected in-memory transaction only
- No real-account mutation
- No ordinary message-send or import wiring
- No schema / route / surface changes
- No git add / commit / push / PR in this slice

## Landed dependencies reused

- OpenAI provider path + adjudicator/referee model configuration
- Separate adjudicator and referee runner instances
- `maxRetries: 0`, `timeoutMs: 45000`, total attempt cap `8`
- CEQR-011 prompt addendum v1 (byte-for-byte)
- CEQR-012 sanitized diagnostics
- Synthetic persisted-input harness
