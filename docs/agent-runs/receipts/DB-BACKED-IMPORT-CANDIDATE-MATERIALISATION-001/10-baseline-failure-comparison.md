# Final verification — baseline comparison of five failing suite files

Compared against isolated worktree at `staging @ dc1db2f`
(`/tmp/mindlab-baseline-dc1db2f-import-verify`), same `.env` as branch.

| Test file | Baseline `dc1db2f` | Branch | Campaign caused/changed? |
|-----------|-------------------|--------|--------------------------|
| `canonical-fixture-composition-gate.test.ts` | FAIL — cannot resolve `@/lib/canonical-reference-model-status-card` from fixture-provider | FAIL — same error | **No** — identical; zero diff vs baseline on this file / fixture-provider |
| `evidence-pointer-surfacing-rationale-schema.test.ts` | FAIL — migration SQL index name mismatch (`epsr_user_src_uniq` vs expected long Prisma name) | FAIL — same assertion | **No** |
| `orvek-adapters.test.ts` | FAIL — after-state honesty (`Updated summary` vs unavailable copy) | FAIL — same assertion | **No** |
| `surfaced-evidence-pointer-schema.test.ts` | FAIL — migration SQL index name mismatch (`sep_user_status_surfaced_idx` vs expected long name) | FAIL — same assertion | **No** |
| `today-production-movement-depth.test.ts` | FAIL — after-state honesty (`Headline movement summary` vs unavailable copy) | FAIL — same assertion | **No** |

`git diff dc1db2f --` on all five test files and related production/schema paths: **empty**.

Normalized failure-log diff baseline ↔ branch: **empty**.

**Conclusion:** all five suite failures are pre-existing on `dc1db2f`. This campaign did not introduce or change them. No campaign-caused fix required.
