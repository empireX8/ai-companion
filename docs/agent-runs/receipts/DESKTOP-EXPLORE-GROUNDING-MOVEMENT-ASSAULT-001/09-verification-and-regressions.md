# 09 — Verification and regressions

## Status

**FULLY VERIFIED** for the Explore assault slice.

All Explore hard gates were re-proven on this branch. The repo-wide convenience script remains expected non-zero only because four unchanged pre-existing schema-index baseline failures still reproduce on this branch.

| Check | Result |
|---|---|
| `git diff --check` | PASS |
| `npx tsc --noEmit` | PASS |
| Targeted Explore / grounding / Free Explore Vitest | PASS (`12/12` files, `175/175` tests) |
| Isolated Ask send-readiness Playwright | PASS (`1/1`) |
| Playwright explore grounding assault | PASS (`5/5`) |
| `npm run build` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `bash scripts/verify-mindlab.sh` | Expected non-zero due only to four unchanged pre-existing schema-index baseline failures remaining on this branch |

## Clean staging baseline @ `220d0a0`

Clean staging reproduced a broader pre-existing Vitest baseline than this branch:

- `4` failed files / `6` failed tests
- `275` passed files / `3749` passed tests

Exact failing tests:

- `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`
  - `bounded free explore chat hybrid fetch bridge > can surface ready Free Explore chat production data through the hybrid workbench`
- `lib/__tests__/explore-composer-wireup.test.ts`
  - `explore composer wireup > routes ask and quick prompts through explore chat handlers`
- `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
  - `EvidencePointerSurfacingRationale schema model contracts > pins one rationale row per source object per user`
  - `EvidencePointerSurfacingRationale migration SQL contracts > pins source lookup uniqueness in migration SQL`
- `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
  - `SurfacedEvidencePointer schema model contracts > pins required indexes and one-pointer-per-source uniqueness`
  - `SurfacedEvidencePointer migration SQL contracts > pins Today read and source lookup indexes in migration SQL`

## Current branch

Current branch Vitest failures are a strict subset of that clean baseline:

- `2` failed files / `4` failed tests
- `279` passed files / `3762` passed tests

Exact failing tests:

- `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
  - `EvidencePointerSurfacingRationale schema model contracts > pins one rationale row per source object per user`
  - `EvidencePointerSurfacingRationale migration SQL contracts > pins source lookup uniqueness in migration SQL`
- `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
  - `SurfacedEvidencePointer schema model contracts > pins required indexes and one-pointer-per-source uniqueness`
  - `SurfacedEvidencePointer migration SQL contracts > pins Today read and source lookup indexes in migration SQL`

## Delta

- `bash scripts/verify-mindlab.sh`: expected non-zero due only to four unchanged pre-existing schema-index baseline failures
- `branch-introduced failures`: `NONE`
- The two additional clean-staging baseline failures in `free-explore-chat-hybrid-fetch.test.ts` and `explore-composer-wireup.test.ts` do not reproduce on this branch

## Explore hard gates re-proven

- Authenticated assault Playwright passed `5/5`
- `ExploreMovementProposal` and `ModelUpdate` were created as distinct records with distinct IDs
- `ModelUpdate` count was `0` before publication
- Exactly one `ModelUpdate` existed after publication
- Negative status codes remained exact: `404` for unauthenticated/cross-user/missing-resource cases and `400` for malformed requests
- Browser identity matched across Explore, Inspector, Today, report overlay, and Timeline
- Fixture remaining counts were all zero after cleanup
- `tsc`, targeted Vitest, build, trust, legacy, and diff-check all passed

## Fixture cleanup evidence

Exact deletion counts from the original final successful Playwright `5/5` run were not preserved in the saved runtime log, `test-results`, or receipt artifacts.

The preserved cleanup proof from the successful browser campaign is the final zero-remaining log:

```text
remainingConversations=0
remainingMessages=0
remainingProposals=0
remainingModelUpdates=0
remainingMovementEvidenceLinks=0
remainingSeededMapEvidenceObjects=0
```

Later fixture-only cleanup verification deleted these rows:

| Fixture family | Later fixture-only deleted | Remaining after that later cleanup |
|---|---:|---:|
| conversations | `3` | `0` |
| messages | `1` | `0` |
| proposals | `0` | `0` |
| ModelUpdates | `0` | `0` |
| movement evidence links | `0` | `0` |
| seeded map / evidence objects | `5` | `0` |

Separately tracked later fixture-only field:

- grounded messages carrying `groundingPayload`: deleted `0`
- no separate remaining grounded-message counter is emitted; `remainingMessages=0` proves no fixture message rows remained

Those later fixture-only counts must not be represented as deletion counts from the original successful browser journey. The preserved successful cleanup proof is that all remaining fixture counts were zero at the end of the campaign.

## Final blockers

- Explore grounding blockers: `NONE`
- proposal/review blockers: `NONE`
- movement-publication blockers: `NONE`

## Regressions guarded

- Production Explore send no longer falls through to sample/reference transcript behavior
- Browser-grounded assistant messages retain real `Message.groundingPayload` end to end
- Inspector, Today, overlay, and Timeline all resolve the same published `ModelUpdate`
