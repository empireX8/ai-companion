# 08 — Offline validation

## Post-live finalisation sweep

| Check | Status |
|---|---|
| Focused CEQR-019 contract + adversarial + live-lock tests | PASS 38/38 |
| Contradiction adjudication contract tests | PASS 48/48 |
| Provider schema/transport + CEQR-018 repair tests | PASS 21/21 |
| Semantic output compatibility tests | PASS 28/28 |
| Evidence authority tests | PASS 27/27 |
| Controlled natural-entry writer-block tests | PASS 35/35 |
| Live provider/referee offline contract tests | PASS 49/49 |
| CEQR-017 authority reproof offline tests | PASS 27/27 |
| Objectivity/referee interface tests | PASS 28/28 |
| TypeScript `tsc --noEmit` | PASS |
| Changed-file ESLint | PASS (0 errors) |
| `git diff --check` | PASS |
| JSON parse of all CEQR-019 JSON receipts | PASS |
| One-shot claim exists | PASS |
| Live receipt classification exact | `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN` |
| Live provider attempts exact | 3 |
| Referee/writer/persistence/account/database counters | all 0 |
| Canonical live artifact hashes locked | PASS |
| CEQR-017 / CEQR-018 historical hashes | unchanged |
| Additional live provider attempts during finalisation | 0 |
| Ambient live env guards | unset |
| Build | NOT RUN (not claimed) |

## Classification distinction

| Phase | Classification |
|---|---|
| Offline harness | `PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY` |
| Live execution | `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN` |
