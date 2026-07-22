# 01 — Pre-run static audit

## Gates

| # | Gate | Result |
|---|------|--------|
| 1 | Branch = `desktop-contradiction-live-evidence-prompt-rerun-001` | PASS |
| 2 | HEAD = `989886124fb6885d433acdf567c4d50c298f588e` | PASS |
| 3 | Worktree initially clean | PASS |
| 4 | `OPENAI_API_KEY` present (value not printed) | PASS |
| 5 | Live execution requires `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1` | PASS |
| 6 | Addendum identity = `contradiction-live-adjudicator-prompt-addendum-v2` | PASS |
| 7 | v2 source-ID and exact-quote authority wording present | PASS |
| 8 | Live wrapper leaves `request.prompt` unchanged | PASS |
| 9 | Provider-returned output unmodified / returned by reference | PASS |
| 10 | `maxRetries` remains `0` | PASS |
| 11 | Timeout remains `45000` ms | PASS |
| 12 | Total provider-attempt cap remains `8` | PASS |
| 13 | Separate adjudicator and referee runners remain in use | PASS |
| 14 | Synthetic cases unchanged from CEQR-013 | PASS |
| 15 | Harness remains injected/in-memory only | PASS |
| 16 | No ordinary message-send or import route invokes the proof | PASS |
| 17 | No source-length metadata in addendum/adapters | PASS |
| 18 | No output-repair helper or mutation path | PASS |
| 19 | Focused deterministic tests pass before live call | PASS |

## Focused deterministic tests before live call

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| CEQR-014 evidence prompt repair | 1 | 12 | PASS |
| CEQR-013 diagnostic receipts | 1 | 7 | PASS |
| CEQR-012 semantic compatibility | 1 | 28 | PASS |
| CEQR-011 provider/referee execution | 1 | 49 | PASS |
| AI SDK runner options | 1 | 3 | PASS |
| **Combined** | **5** | **99** | **PASS** |

## Pre-run classification

All static gates passed. Provider call authorised (not `HOLD_PRE_RUN_GATE_FAILED`).
