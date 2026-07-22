# 13 — Tests and validation

## Focused CEQR-016
- File: `lib/__tests__/contradiction-evidence-authority-repair.test.ts`
- **27 passed / 0 failed**

## Related honesty/core
12 files / **261 passed / 0 failed**:
- contradiction adjudication contract
- contradiction evidence
- controlled natural-entry proof
- Objectivity Referee interface contract
- repaired persistence / duplicate-prevention schema
- live provider/referee/semantic/diagnostic/evidence-prompt suites (no live opt-in)
- ai-sdk structured model runner options

Structured-output coverage: `lib/__tests__/ai-sdk-structured-model-runner-options.test.ts` plus CEQR-016/contract coverage of transport vs domain parsers. No dedicated `*evidence-validation*` test file.

## Related broader
6 files / **181 passed / 0 failed**:
- contradiction-source
- dual-side lineage
- persistence plan
- confidence calibration
- dual-source presentation + routes

## Related combined
18 files / **442 passed / 0 failed**

## Full Vitest
- Files: **5 failed / 321 passed** (326 total)
- Tests: **7 failed / 4380 passed** (4387 total)
- Known baseline after CEQR-015: 5 failing files / 7 failing tests / 320 passing files / 4352 passing tests
- Known failure set expanded: **NO**
- Passing delta vs CEQR-015 baseline: **+28** (explained by new CEQR-016 focused suite + honest test updates)
- Failing files unchanged (unrelated Today/evidence-pointer/orvek-adapter baseline)

## Other gates
| Gate | Result |
|---|---|
| `git diff --check` | PASS |
| `npx tsc --noEmit` | PASS (after widening CEQR-016 offset-only override helpers to transport types) |
| changed-file ESLint | PASS (warnings only: unused `_qa`/`_qb`/`_ea`/`_eb`/`_R`) |
| `npm run build` | PASS (env sourced from `/Users/user/ai-companion/.env`; secrets not printed) |
| trust language | PASS |
| legacy surfaces | PASS |
| secret scan (CEQR-016 receipt + repair test) | PASS |
| real-account-ID scan | PASS |
| provider-output mutation pattern scan | PASS |
| live-opt-in scan | PASS (`RUN_LIVE_CONTRADICTION_PROVIDER_PROOF` unset / not set to 1) |
| quote/sourceId repair pattern scan | PASS |
| source-length metadata scan | PASS |
| route/import/live-wiring scan | PASS (no ordinary app wiring of live proof / adjudicator) |
| `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF` | unset / not set to 1 |

See `validation-summary.json`.
