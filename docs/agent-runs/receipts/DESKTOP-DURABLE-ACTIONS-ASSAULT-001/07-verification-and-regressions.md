# 07 — Verification and regressions

## Commands run (final)

| Check | Result |
|---|---|
| `git diff --check` | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| Targeted durable / affected Vitest (9 files, 75 tests) | **PASS** |
| `npx playwright test scripts/durable-actions-assault.playwright.ts` | **PASS** — **5/5** |
| Closeout evidence capture (`-g "decision outcome\|fieldwork\|negative proof"`) | **PASS** — **3/3** (logged exact IDs/statuses) |
| `npm run build` | **PASS** |
| `npm run check:trust` | **PASS** |
| `npm run check:legacy` | **PASS** |
| `bash scripts/verify-mindlab.sh` | **Vitest FAIL only on staging-unchanged baselines** (see below); tsc/diff/build/trust/legacy **PASS** |

## Playwright (final serial run)

1. Correction journey — **PASS** (~52s)
2. Decision outcome journey — **PASS** (~40s)
3. Fieldwork check-in — **PASS** (~51s)
4. Negative proof — **PASS** (~42s)
5. Fixture cleanup — **PASS** — `deletedConclusions=1 deletedActions=1 deletedFieldwork=1` / remaining **0/0/0**

## Exact IDs (evidence capture)

| Record | Exact ID |
|---|---|
| Correction parent | `dev-durable-actions-assault-conclusion` (mutated in place) |
| Fieldwork parent | `dev-durable-actions-assault-fieldwork` (mutated in place) |
| Decision `SurfacedAction` | `cmrl2j3kv0000qloo4k0zisi3` |
| Decision claim | `dev-durable-actions-assault-claim` |
| Decision surfaceKey | `stabilize:s6:claim:dev-durable-actions-assault-claim` |

## Exact negative status codes (evidence capture)

| Case | Status |
|---|---|
| Unauthenticated correction | **404** |
| Cross-user correction | **404** |
| Cross-user decision | **404** |
| Cross-user fieldwork | **404** |
| Missing parent fieldwork | **404** |
| Malformed correction payload | **400** |

## Branch-introduced Vitest failures

**NONE** relative to staging @ eb5b0fa.

Reproduced clean staging on the same suites: only

- `explore-composer-wireup` (composerDraft source-string drift)
- `free-explore-chat-hybrid-fetch` (`exploreGrounding` emptied by chat overlay)

remain failing. Prisma/schema index naming contracts also fail on staging and this branch unchanged. Allowed per assault instructions.

## Remaining blockers

**NONE** (corrections / decision outcomes / fieldwork / overall)

## Complete changed-file list (working tree, excluding `test-results/`)

See `08-final-result-for-kay.md` — same exact list; receipts 05/07/08 agree.
