# Verification And Regressions

## Branch verification after regression repair

Branch: `desktop-investigations-production-assault-001`

Canonical full-suite command:

- `npx vitest run`

Post-repair branch Vitest log:

- `/tmp/desktop-investigations-regression-20260716/post-fix/branch-vitest-post-fix.log`

Post-repair branch full Vitest result:

- `Test Files 2 failed | 281 passed (283)`
- `Tests 4 failed | 3769 passed (3773)`

Post-repair branch exact Vitest failures:

1. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
   - `EvidencePointerSurfacingRationale schema model contracts > pins one rationale row per source object per user`
   - `EvidencePointerSurfacingRationale migration SQL contracts > pins source lookup uniqueness in migration SQL`
2. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
   - `SurfacedEvidencePointer schema model contracts > pins required indexes and one-pointer-per-source uniqueness`
   - `SurfacedEvidencePointer migration SQL contracts > pins Today read and source lookup indexes in migration SQL`

`bash scripts/verify-mindlab.sh` post-repair log:

- `/tmp/desktop-investigations-regression-20260716/post-fix/verify-mindlab-post-fix.log`

Post-repair verify result on `2026-07-16`:

- `PASS: 5`
- `FAIL: 1`
- only failing gate: `npx vitest run`

Other post-repair verification:

- `git diff --check` passed
- four repaired files passed individually
- targeted Investigations tests passed:
  - `lib/__tests__/investigations-hybrid-fetch.test.ts`
  - `lib/__tests__/investigations-tab-alignment.test.ts`
- `npm run build` passed inside `verify-mindlab.sh`
- `bash scripts/check-trust-language.sh` passed
- `bash scripts/check-legacy-surfaces.sh` passed

## Exact clean-baseline reproduction at `15b7f77`

Clean baseline repo used:

- `/Users/user/ai-companion`

Baseline full-suite log:

- `/tmp/desktop-investigations-regression-20260716/baseline-vitest-full-run-1.log`

Baseline environment matched:

- Node `v18.20.8`
- npm `10.8.2`
- same `.env` target as branch worktree
- same local database
- zero leftover Investigations campaign fixtures
- no competing local server on `:3000`

Baseline full Vitest result:

- `Test Files 4 failed | 277 passed (281)`
- `Tests 8 failed | 3753 passed | 5 skipped (3766)`

Baseline exact failure entries from the preserved log:

1. `lib/__tests__/explore-grounding-movement-assault.test.ts`
   - `explore grounding movement assault contract`
   - `PrismaClientValidationError` in `lib/explore-grounding-movement-runtime-fixture.ts:237:42`
   - the preserved log shows this describe-level failure entry twice; these are hook failures, not two additional named test cases
2. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
   - `EvidencePointerSurfacingRationale schema model contracts > pins one rationale row per source object per user`
   - `EvidencePointerSurfacingRationale migration SQL contracts > pins source lookup uniqueness in migration SQL`
3. `lib/__tests__/explore-conversation-review.test.ts`
   - `/api/explore/sessions/[id]/review-items > returns empty items when no session-linked review sources exist`
   - `/api/explore/sessions/[id]/review-items > projects reference candidates with safe fields and governance actions only`
   - `/api/explore/sessions/[id]/review-items > projects Explore movement proposals as reviewable proposed model movement`
   - `/api/explore/sessions/[id]/review-items > excludes internal-only lifecycle names from user-facing labels`
4. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
   - `SurfacedEvidencePointer schema model contracts > pins required indexes and one-pointer-per-source uniqueness`
   - `SurfacedEvidencePointer migration SQL contracts > pins Today read and source lookup indexes in migration SQL`

## Branch-only failure investigation

Initial branch full-suite logs before repair:

- `/tmp/desktop-investigations-regression-20260716/branch-vitest-full-run-1.log`
- `/tmp/desktop-investigations-regression-20260716/branch-vitest-full-run-2.log`

Initial branch full Vitest result before repair:

- `Test Files 6 failed | 277 passed (283)`
- `Tests 8 failed | 3765 passed (3773)`

Initial branch-only failures before repair:

1. `lib/__tests__/desktop-old-route-shell-quarantine.test.ts`
   - `desktop old-route / old-shell quarantine audit > 4 — active v0 pages and chrome use store navigation, not route-first pushes`
2. `lib/__tests__/explore-surface.test.ts`
   - `explore surface wiring > renders grounding hierarchy and inspector actions without internal fields`
3. `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`
   - `bounded free explore chat hybrid fetch bridge > preserves Active Questions, Investigations, and Fieldwork parity when chat fetch is wired`
4. `lib/__tests__/free-explore-chat-tab-alignment.test.ts`
   - `free explore chat tab alignment > preserves unrelated hybrid parity surfaces when chat tab aligns`

Individual rerun evidence before repair:

- `/tmp/desktop-investigations-regression-20260716/individual/*.log`
- every initially failing branch file failed when run individually
- the initial six-file branch failure set was stable across two full runs and not file-order dependent

Classification of the four branch-only failures:

1. `desktop-old-route-shell-quarantine.test.ts`
   - stale expectation
   - it treated `useRouterRefresh={false}` as if the Explore surface had restored `useRouter`
   - no route-first navigation or `next/navigation` hook was reintroduced
2. `explore-surface.test.ts`
   - stale expectation
   - it pinned the removed internal variable name `showSkeleton`
   - current branch contract uses `showEmptyList`, `showProductionDetail`, and production Investigations detail/create wiring
3. `free-explore-chat-hybrid-fetch.test.ts`
   - stale expectation
   - it expected `exploreInvestigationIds` to stay `undefined`
   - current branch intentionally merges thin live Investigations rows into the hybrid shell
4. `free-explore-chat-tab-alignment.test.ts`
   - stale expectation
   - same outdated `exploreInvestigationIds` assumption as above

Repairs made:

- test-only assertion updates in:
  - `lib/__tests__/desktop-old-route-shell-quarantine.test.ts`
  - `lib/__tests__/explore-surface.test.ts`
  - `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`
  - `lib/__tests__/free-explore-chat-tab-alignment.test.ts`
- no runtime implementation files changed during the regression repair step
- Investigations Playwright was not rerun because the repair did not touch runtime behavior

Individual rerun outcomes after repair:

- `lib/__tests__/desktop-old-route-shell-quarantine.test.ts` passed
- `lib/__tests__/explore-surface.test.ts` passed
- `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts` passed
- `lib/__tests__/free-explore-chat-tab-alignment.test.ts` passed

## Final delta

Exact branch failure files:

1. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
2. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`

Exact baseline failure files:

1. `lib/__tests__/explore-grounding-movement-assault.test.ts`
2. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
3. `lib/__tests__/explore-conversation-review.test.ts`
4. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`

Exact intersection:

1. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
2. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`

Exact branch-only failures after repair:

- `NONE`

Exact baseline-only failures:

1. `lib/__tests__/explore-grounding-movement-assault.test.ts`
2. `lib/__tests__/explore-conversation-review.test.ts`

Regression conclusion:

- no genuine branch-introduced failures remain
- all remaining branch full-suite failures reproduce on clean `15b7f77`
- the previous provisional `FAIL` was not sustained by the exact baseline comparison
