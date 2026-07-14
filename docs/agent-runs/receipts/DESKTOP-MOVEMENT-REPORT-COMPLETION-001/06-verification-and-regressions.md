# 06 — Verification and regressions

## Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| Targeted movement/report Vitest | PASS (provenance, identity, fixture cleanup, hybrid, today movement/report/depth/contract suites) |
| `npx playwright test scripts/movement-report-completion.playwright.ts` | PASS — 3/3 (39.4s) |
| `npm run build` (standalone, clean `.next`) | PASS |
| `npm run check:trust` | PASS |
| `npm run check:legacy` | PASS |
| `git diff --check` | PASS |
| `bash scripts/verify-mindlab.sh` | FAIL only on known unrelated Vitest baselines (see below). Build subcheck also failed once under concurrent `.next` race with Playwright; rebuild alone PASS. |

## Full Vitest

`6 failed | 3744 passed (3750)`

Failures (unchanged Explore / Prisma-contract baselines; not repaired in this slice):

1. `evidence-pointer-surfacing-rationale-schema.test.ts` (2)
2. `surfaced-evidence-pointer-schema.test.ts` (2)
3. `explore-composer-wireup.test.ts` (1)
4. `free-explore-chat-hybrid-fetch.test.ts` (1)

Prior assault counted seven including a stale Today `fullReportAvailable` source-token assertion. That assertion was updated to the current `reportCommands` / `today-full-report` contract (`orvek-ux-integration.test.ts`) — a movement/report surface honesty fix, not Explore repair.

**No new movement/report Vitest failures.**

## Defects repaired in this completion run

1. Hybrid Timeline showing reference `t1…t14` instead of live ModelUpdate IDs → inject depth-ready IDs via Today overlay + live Timeline presentation gate
2. Overlay live open path / provenance labelling
3. Production `rep-weekly` route intent / aside leakage
4. Fixture seed without reusable cleanup
5. Build type errors in evidence-object builder / LiveReportTarget field access
6. Playwright cold-start wait for authenticated API 200 before Today assertions
