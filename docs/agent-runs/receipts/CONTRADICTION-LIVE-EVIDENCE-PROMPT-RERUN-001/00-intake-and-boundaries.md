# 00 — Intake and boundaries

## Task

`CONTRADICTION-LIVE-EVIDENCE-PROMPT-RERUN-001` / campaign slice **CEQR-015**

## Campaign

`CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001`

## Exact base

`989886124fb6885d433acdf567c4d50c298f588e`

## Branch / worktree

- Branch: `desktop-contradiction-live-evidence-prompt-rerun-001`
- Worktree: `/Users/user/ai-companion-worktrees/desktop-contradiction-live-evidence-prompt-rerun-001`

## Goal

Perform exactly one controlled opt-in live provider rerun under the landed
CEQR-014 live adjudicator evidence addendum **v2**, and determine whether the
v2 pre-generation evidence instructions repair the exact CEQR-013 live failure
classes:

- `fabricated_quote`
- `source_id_mismatch`

## Hard boundaries (observed)

- Controlled live proof only — no prompt/validator/schema/adapter redesign
- Exactly one live provider invocation (`RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1`)
- No second live run for any reason
- No provider-output mutation
- No runtime prompt change during this slice
- No `request.prompt` change
- No real Prisma persistence; injected in-memory transaction only
- No real-account mutation / no re-evaluation of the existing 25 rows
- No ordinary message-send or import wiring
- No schema / migration / UI / route changes
- No git add / commit / push / PR in this slice
- Production readiness remains **NO**

## Landed dependencies reused (unmodified)

- OpenAI provider path + adjudicator/referee model configuration
- Separate adjudicator and referee runner instances
- `maxRetries: 0`, `timeoutMs: 45000`, total attempt cap `8`
- Live addendum: `contradiction-live-adjudicator-prompt-addendum-v2`
- CEQR-012 sanitized diagnostics
- Synthetic persisted-input harness (unchanged from CEQR-013)
