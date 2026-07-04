# 10 Consolidation Plan

## Verdict
Consolidate #81-#84 first.
Do not continue stacking more PRs before consolidation.
Today parity passed after the Evidence Pointer regression was patched.
Delta Log is preserved.
Continue from what changed preserves the reference path.
Evidence Pointer opens Inspector.
Non-Today surfaces still use temporary reference/mock baseline.
`createMockOrvekDataApi` remains in use for unwired surfaces.
The stack is not production-ready.
Do not merge anything into `staging` until the mock/reference baseline risk is explicitly handled.

## Recommendation

- Consolidate the stack before adding any new surface.
- Use a clean branch PR instead of merging the stacked PRs directly.
- Preserve the accepted reference UI exactly as it is now.

## Why Consolidate First

- #81 establishes the accepted reference desktop shell.
- #82 adds Today intent metadata.
- #83 consumes that metadata in Today.
- #84 overlays live Today production data without changing the reference contract.
- The stack is only parity-complete for Today; it is not production-ready across the desktop surface set.
- Continuing to stack more PRs would increase fallback drift and make regressions harder to isolate.

## Exact Branch

- Create `desktop-reference-app-hard-swap-consolidated-001`
- Base it on `staging`
- Do not base it on `desktop-today-production-data-parity-bridge-001`

## Consolidation Style

- Use a clean branch PR.
- Build it by linear replay of the existing stack commits onto the new branch.
- Prefer cherry-pick or rebase onto the clean branch.
- Do not merge the stacked PRs into `staging`.
- Do not squash into `staging`.
- If the team later wants a single-commit PR, do that intentionally on the clean branch.

## PR Handling

- Keep #81, #82, #83, and #84 open/draft until the clean branch exists and is verified.
- Once the clean branch is open, treat #81-#84 as superseded by the consolidated branch.
- Close #82, #83, and #84 after the clean branch replaces the stack.
- Close #81 as well once the consolidated branch becomes the only review target.

## Step-By-Step Commands

Run these when you are ready to consolidate:

```bash
git fetch origin --prune
git checkout staging
git pull --ff-only origin staging
git checkout -b desktop-reference-app-hard-swap-consolidated-001
git cherry-pick e6c88f6 5c56ba0 5206235 ffe04aa 9f1074e
# Optional: cherry-pick 60e8ec5 only if you want the stack-audit doc on the clean branch
git push -u origin desktop-reference-app-hard-swap-consolidated-001
```

- Keep the replay linear.
- Keep the runtime commits in order.
- Leave the audit/receipt docs out unless the team explicitly wants them on the clean branch.
- Open one draft PR from the clean branch to `staging`.

## Required Checks

Run the full repo checks after consolidation and before review:

```bash
git diff --check
npx tsc --noEmit
npx vitest run
npm run build
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
bash scripts/verify-mindlab.sh
```

- Do not merge if any of these fail.
- Re-run the checks after any fix on the consolidated branch.

## Visual Checks

- Confirm `/` still renders the accepted reference workbench UI.
- Confirm Today parity still passes in the live desktop shell.
- Confirm the Evidence Pointer card opens Inspector.
- Confirm the Delta Log is still present.
- Confirm `Continue from what changed` still preserves the reference path.
- Confirm non-Today surfaces still visibly use the temporary reference/mock baseline.
- Confirm the old shell remains quarantined and not active.

## Direct-Merge Risks

- Merging #81-#84 directly into `staging` now risks shipping the reference shell before the non-Today surfaces are ready.
- A direct merge would make it harder to see which parts are live and which parts still depend on the temporary baseline.
- A direct merge would also make rollback and review harder because the stack is still layered on fallback behavior.
- If we keep stacking, fallback drift will widen and the reference contract will become harder to audit.

## Next Safest Surface

- If we consolidate first, the next safest single-surface bridge is `Map`.
- Do not start that bridge until the consolidated branch has been verified and accepted.

