# 01 — Pre-run static audit

## Gates

| # | Gate | Result |
|---|------|--------|
| 1 | Branch = `desktop-contradiction-live-diagnostic-rerun-001` | PASS |
| 2 | HEAD = `64c79a7d424aefb9d7e499c07c0d240233211284` | PASS |
| 3 | Worktree clean before CEQR-013 changes | PASS |
| 4 | `OPENAI_API_KEY` present (value not printed) | PASS |
| 5 | Live execution gated by `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1` | PASS |
| 6 | Adjudicator/referee `maxRetries` exactly `0` | PASS |
| 7 | Timeout exactly `45000` ms for both roles | PASS |
| 8 | Total attempt budget exactly `8` | PASS |
| 9 | CEQR-011 prompt addendum version `contradiction-live-adjudicator-prompt-addendum-v1` unchanged | PASS |
| 10 | Live wrapper leaves `request.prompt` unchanged | PASS |
| 11 | Provider output object returned by reference (no mutation) | PASS |
| 12 | CEQR-012 sanitized diagnostics attached on failed selection | PASS |
| 13 | Synthetic proof user id only (`ceqr011-live-provider-proof-user-isolated`) | PASS |
| 14 | In-memory `$transaction` harness only (no PrismaClient) | PASS |
| 15 | Ordinary message/import paths do not invoke proof | PASS |

## Focused deterministic tests before live call

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| CEQR-011 provider/referee execution | 1 | 49 | PASS |
| CEQR-012 semantic compatibility | 1 | 28 | PASS |
| AI SDK runner options | 1 | 3 | PASS |
| **Combined** | **3** | **80** | **PASS** |

## Pre-run classification

All static gates passed. Provider call authorised.
