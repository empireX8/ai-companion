# Inspector Assault Experiment Brief

## Experiment only

Do not execute this experiment on the audit branch.

## Goal

Determine whether the built production Inspector can become the active desktop Inspector while preserving the accepted reference contract and exposing provenance gaps honestly.

This is an architecture experiment, not a global parity implementation.

## Exact scope

Representative object families:

1. one depth-safe live `receipt`;
2. one live `usermap_conclusion` represented as map-object;
3. one live `model_update`;
4. one live `active-question` or investigation;
5. one reference-only `decision`;
6. one reference-only `report`;
7. empty/sparse/unsupported selection.

Accepted states:

- EC selection and title remain coherent;
- receipt source/provenance, why-it-matters, context and related objects render;
- related/context navigation works and can return;
- MM shows selected before/after or an explicit honest empty state;
- global recent movement is clearly separate;
- unsupported types do not silently show unrelated fixture content;
- correction and Ask in Explore controls are either correctly wired or explicitly labelled as deferred;
- report selection does not claim live provenance when overlay content is fallback.

## Allowed autonomy

- Create an isolated branch/worktree from the clean baseline.
- Modify only Inspector mounting/bridge/selection/provider integration and targeted tests.
- Add temporary developer-only diagnostics for provenance.
- Use existing APIs, types and stored data.
- Add no user-facing fake content.
- Stop at an explicit unsupported state rather than fabricating parity.

## Prohibited

- No schema/migration changes.
- No new API routes.
- No changes to Today, Map, Decisions, Timeline or Explore page layouts.
- No global `displayContract: "production"` flip.
- No deletion of zip fallback until unsupported states are explicit.
- No new correction/report/grounding persistence.
- No visual redesign.
- No commit until verification and audit pass.

## Candidate file boundary

Architect must confirm the final slice. Expected hotspots:

- `components/orvek-v0/workbench.tsx`
- `components/orvek-v0/store.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
- active Inspector mount/router components under `components/inspector/`
- `lib/orvek-v0/data-provider.tsx`
- `lib/inspector-selection.ts`
- targeted Inspector/provider tests

Avoid `useOrvekHybridWorkbenchDataApi.ts` unless selection context cannot be supplied otherwise.

## Isolated branch/worktree plan

```text
base: desktop-reference-parity-provenance-audit-001 at aa43b42, excluding audit receipts
branch: desktop-inspector-assault-experiment-001
worktree: separate local worktree
```

Do not merge the experiment automatically. Preserve a single revertable integration commit only after all checkpoints pass.

## Checkpoints

### Checkpoint 0 — baseline

- Clean tree.
- Confirm `staging` is at `aa43b42`.
- Record both pre-existing failures, which reproduce on clean `staging` and were not caused by the audit:
  1. `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts` — `bounded free explore chat hybrid fetch bridge > can surface ready Free Explore chat production data through the hybrid workbench`
     - Stale assertion: `expect(hybridApi.exploreGrounding).toEqual(baseApi.exploreGrounding)`.
     - Current contract: live chat intentionally strips mock/reference grounding and returns `[]`.
  2. `lib/__tests__/orvek-ux-integration.test.ts` — `orvek ux integration — today what-changed output > keeps compact What Changed on Today with Inspector handoff and route-ready full report output`
     - Stale assertion: `expect(todayView).toContain("fullReportAvailable")`.
     - Current contract: Today report availability uses `reportCommands`, not the old `fullReportAvailable` source token.
- Do not change product code to satisfy either stale assertion.
- Repair both tests in a separate test-maintenance slice.
- Treat the audit conclusions as valid; these failures do not alter the provenance or Inspector baseline.
- Reference and production routes captured for the seven representative states.

### Checkpoint 1 — mount only

- Production Inspector shell visible in active workbench.
- No data fetch/selection changes.
- Reference route remains mock-only.
- Stop if layout or route ownership becomes ambiguous.

### Checkpoint 2 — selection bridge

- Workbench selection synchronizes once into production Inspector.
- Tab defaults are correct for receipt/map/question versus model update.
- Unsupported decision/report selections show truthful unsupported/fallback status.
- No selection loop.

### Checkpoint 3 — live hydration

- Receipt, conclusion and model update fetch/render from authenticated data.
- Exact object ID and API response recorded.
- No zip object substitutes for a missing live object without a visible provenance state.

### Checkpoint 4 — navigation and movement

- Related/context navigation and back stack work.
- Selected MM stays separate from global movement.
- Empty before/after remains explicit.

### Checkpoint 5 — actions

- Correction, Ask in Explore, report and check-in controls are audited.
- Any unwired action is disabled/deferred with honest copy for the experiment.
- No new write path is invented.

### Checkpoint 6 — regression

- All 35 coverage units classified again.
- Reference recording states spot-checked.
- Full repository verification run.
- Independent audit agent returns PASS or PASS WITH RISKS.

## Independent verification

1. Unit/integration tests for selection mapping, provider provenance and unsupported types.
2. Authenticated browser replay for the three live representative objects.
3. Reference route replay for decision/report and empty state.
4. Negative tests:
   - provider misses object;
   - linked ID does not resolve;
   - model update lacks before/after;
   - report ID exists only in zip;
   - selected type is not globally selectable.
5. `bash scripts/verify-mindlab.sh`.
6. Audit current uncommitted diff against the exact file boundary.

## Success measurements

Experiment succeeds only if:

- 3 live representative families render without fixture substitution;
- all 7 representative selections remain coherent;
- navigation works with no dead related/context links in tested graphs;
- selected movement is never replaced by unrelated global movement;
- unsupported/fallback states are explicit;
- reference route remains data-isolated;
- no product code outside the slice changes;
- verification passes except documented pre-existing baseline failures, which must be resolved or waived by Kay before commit.

## Failure measurements

Stop and report failure if:

- mounting requires broad page rewrites;
- selection loops or races occur;
- more than two unsupported Orvek families require new architecture;
- live hydration needs new schema/routes;
- fallback provenance cannot be made explicit without redesign;
- shared reference presentation changes unexpectedly;
- authenticated runtime proof is unavailable.

## Rollback

- Delete the isolated worktree/branch if the experiment fails.
- If a candidate commit exists, revert that single experiment commit.
- Do not retain partial mount code, compatibility aliases or hidden fallback behavior.

## Expected output

A short experiment receipt with:

- exact representative IDs;
- screenshots/runtime logs;
- updated 35-unit coverage totals;
- PASS/FAIL per checkpoint;
- architecture recommendation;
- no claim of global parity.
