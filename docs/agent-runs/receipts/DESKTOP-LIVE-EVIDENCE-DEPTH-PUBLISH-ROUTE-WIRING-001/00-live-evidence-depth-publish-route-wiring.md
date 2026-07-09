# Desktop Live Evidence Depth Publish Route Wiring 001

**Branch:** `desktop-live-evidence-depth-publish-route-wiring-001`  
**Baseline:** `35789f6` (staging — PR #121 authoring path)  
**Authoritative receipts consulted:** #118 write hook, #119 rationale source, #120 graphSlot link source, #121 authoring path  
**UI changed:** NO  
**Product code changed:** YES  
**Schema/migration changed:** NO  
**Route/API response shape changed:** NO (optional `evidenceDepthMaterialization` on helper result only; route JSON unchanged)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Wire `publishModelUpdateCandidate` to call the #118 materializer when stored rationale + explicit graphSlot links exist — first branch where backend publish can create stored `SurfacedEvidencePointer` records from authored production data.

---

## Files inspected

| Area | Path | Finding |
|------|------|---------|
| Publish helper | `lib/model-update-candidate-publish-helper.ts` | Visibility flip only before this slice |
| Publish route | `app/api/internal/model-updates/candidates/[id]/publish/route.ts` | Calls helper; no route edits required |
| Authoring (#121) | `lib/live-evidence-depth-authoring-path.ts` | `createEvidenceDepthAuthoringHookDeps` bundles resolver + findEligibleLinks |
| Write hook (#118) | `lib/live-evidence-depth-write-hook.ts` | `maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish` |
| Rationale (#119) | `lib/live-evidence-depth-rationale-source.ts` | Stored `whyItMatters` source |
| GraphSlot (#120) | `lib/live-evidence-depth-graphslot-link-source.ts` | UEL `meta.graphSlot` links |
| Materializer | `lib/live-evidence-depth-write-path.ts` | `upsertSurfacedEvidencePointerRecord` required for durable persist |
| Read (#116) | `lib/live-evidence-depth-linkage.ts` | Depth readiness assessment for hook-created fixtures |
| Prior receipts | `docs/agent-runs/receipts/DESKTOP-LIVE-EVIDENCE-DEPTH-*` | Wiring deferred until authoring landed |

---

## Publish wiring added

**Exact publish function wired:** `publishModelUpdateCandidate` in `lib/model-update-candidate-publish-helper.ts`

After successful publish transaction, helper calls:

`maybeMaterializeEvidenceDepthForPublishedModelUpdate` (`lib/live-evidence-depth-publish-route-wiring.ts`)

which calls:

`maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish` (#118)

with deps from:

- `createEvidenceDepthAuthoringHookDeps` (#121 → #119 resolver + #120 findEligibleLinks)
- `createFindSourceEvidenceForEvidenceDepthPublish` (pattern claim evidence quote / contradiction evidence quote)
- `upsertSurfacedEvidencePointerRecord` + `createUnderstandingEvidenceLinkForUser` (durable persist)

**Supported affected object types:** `pattern_claim`, `contradiction_node` only

**Source of whyItMatters:** `EvidencePointerSurfacingRationale.rationale` via `resolveStoredEvidencePointerSurfacingRationale` / `createResolveStoredSurfacingRationaleForModelUpdatePublish` — never `ModelUpdate.userFacingSummary`

**Source of graphSlot links:** UEL rows on source object with explicit `meta.graphSlot` via `createFindEligibleLinksForEvidenceDepthHook` (#120)

**Source of sourceText:** `PatternClaimEvidence.quote` (fallback `PatternClaim.summary`) or `ContradictionEvidence.quote` (fallback sides/title); `sourceOrigin` = `Recent Pattern` / `Active Tension`

---

## Expected blockers handled

| Condition | Status | Publish succeeds? |
|-----------|--------|-----------------|
| Unsupported `affectedObjectType` | `skipped_unsupported_source` | YES |
| No stored rationale row | `skipped_missing_rationale` | YES |
| Invalid stored rationale (generic/movement/sourceText-equal) | `skipped_invalid_rationale` | YES |
| No eligible graphSlot UEL links | `skipped_missing_eligible_links` | YES |
| Missing source evidence text | `skipped_missing_source_text` | YES |
| Materializer unexpected throw | `failed_unexpected` (logged) | YES |
| All inputs valid | `materialized` | YES |

**#118 hook change:** when `resolveStoredSurfacingRationale` is injected and returns null, hook no longer falls back to `userFacingSummary` — returns `missing_stored_rationale`.

**Publish success semantics:** unchanged. Materialization is optional; expected skips do not throw.

---

## Route/API vs helper

- **Helper:** wired (primary change)
- **Route:** unchanged (`POST /api/internal/model-updates/candidates/[id]/publish` still calls helper; response body unchanged)
- **UI:** unchanged
- **Today depth gate:** unchanged
- **Inspector:** unchanged

Optional DI on `publishModelUpdateCandidate`:

- `skipEvidenceDepthMaterialization`
- `materializeEvidenceDepthForPublish`
- `checkPublicTargetEligibility`
- `now`

Existing call sites work without new arguments.

---

## Files changed

| File | Change |
|------|--------|
| `lib/live-evidence-depth-publish-route-wiring.ts` | **NEW** — publish-route materialization orchestration |
| `lib/model-update-candidate-publish-helper.ts` | Post-publish materialization call + optional result field |
| `lib/live-evidence-depth-write-hook.ts` | Block userFacingSummary fallback when resolver injected + null |
| `lib/__tests__/live-evidence-depth-publish-route-wiring.test.ts` | **NEW** — 17 cases |
| `lib/__tests__/model-update-candidate-publish-helper.test.ts` | Skip materialization in existing tests |
| `lib/__tests__/live-evidence-depth-write-hook.test.ts` | Resolver-null case |
| `lib/__tests__/live-evidence-depth-authoring-path.test.ts` | Updated blocker expectation |
| `lib/__tests__/live-evidence-depth-rationale-source.test.ts` | Updated blocker expectation |

---

## Tests / checks run

```bash
npx prisma validate
npx tsc --noEmit
npm run build
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
git diff --check
npx vitest run \
  lib/__tests__/live-evidence-depth-publish-route-wiring.test.ts \
  lib/__tests__/live-evidence-depth-authoring-path.test.ts \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-rationale-source.test.ts \
  lib/__tests__/live-evidence-depth-graphslot-link-source.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts \
  lib/__tests__/model-update-candidate-publish-helper.test.ts
```

**Result:** PASS — 143 tests across listed suites; all verification checks pass.

**Route-level test gap:** publish route not extended (helper-level DI tests cover wiring; route is thin pass-through).

---

## Remaining blockers

1. No production caller passes `evidenceDepthAuthoring` on candidate create yet — rationale/links must be authored before publish materializes.
2. No end-to-end runtime validation through live API + Today depth gate with real DB.
3. Publish route does not surface `evidenceDepthMaterialization` diagnostics to clients.
4. `sourceText` resolution uses evidence quote with claim/node fallbacks — may need stricter provenance contract.
5. Production-ready still NO.

---

## Next branch recommendation

**`desktop-live-evidence-depth-runtime-validation-001`**

Purpose: create/validate a real stored pointer through publish/API path and confirm:

- `/api/today/evidence-pointers` returns depth-safe object graph
- Today shows stored pointer only when depth-ready
- fallback remains when not depth-ready

---

## Classification

| Item | Value |
|------|-------|
| **PASS/FAIL** | **PASS** |
| Product code changed | YES |
| UI changed | NO |
| Runtime/visual required | NO |
| Commit recommendation | Ready for review; do not commit until Kay approves slice |
