# Desktop Live Evidence Depth Write Hook 001

**Branch:** `desktop-live-evidence-depth-write-hook-001`  
**Baseline:** `ad8942f` (staging)  
**Authoritative receipts consulted:** #115 write path, #116 linkage, #117 Today UI depth gate  
**UI changed:** NO  
**Product code changed:** YES (hook adapter + tests only)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Wire the existing `materializeSurfacedEvidencePointerForUser` materializer into a real backend publish/surfacing path — only when write-time data is honest and eligible. Stop and document blockers when upstream rationale or link metadata is missing.

---

## Write paths inspected

| Path | File | Verdict |
|------|------|---------|
| Model update candidate publish | `lib/model-update-candidate-publish-helper.ts`, `app/api/internal/model-updates/candidates/[id]/publish/route.ts` | **Candidate hook target** — flips `internal_only` → `user_visible`; `affectedObjectType` can be `pattern_claim` / `contradiction_node`. **Blocked today:** no stored surfacing rationale field; `userFacingSummary` is movement copy (`"There is early evidence that…"`). |
| User map conclusion publish | `lib/candidate-publish-helper.ts` | Not a pointer source — `affectedObjectType` is `usermap_conclusion`; movement summary `"New conclusion: …"`. |
| Dark-engine model update persistence | `lib/understanding-dark-engine/model-update-candidate-persistence.ts` | Writes inbound UEL to `model_update` targets; **no outbound** `pattern_claim` → conclusion links with `meta.graphSlot`. |
| Pattern claim lifecycle | `lib/pattern-claim-lifecycle.ts` | Promotes claim status; **no surfacing rationale field** on `PatternClaim`. |
| Today surfacing | `lib/today-surface.ts` | Read-time only — no persistence. |
| Understanding links (read) | `lib/understanding-links.ts` | Outbound UEL from `pattern_claim` exists for map APIs but rows **lack `meta.graphSlot`** today. |

---

## Hook added / route wiring

### Added

**Module:** `lib/live-evidence-depth-write-hook.ts`

| Export | Purpose |
|--------|---------|
| `maybeMaterializeSurfacedEvidencePointerFromPublishEvent` | Main hook — assesses honest publish event, delegates to materializer |
| `maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish` | Model-update publish adapter with movement-copy guards |
| `buildSurfacedEvidencePointerCandidateFromPublishEvent` | Maps hook event → materialization input |
| `getEligibleEvidenceDepthLinksForSource` | Filters UEL rows: requires `meta.graphSlot`, public eligibility |
| `assessEvidenceDepthWriteHookInput` | Pre-materialization gate (rationale, source, links) |
| `assessStoredPublishRationaleForEvidencePointer` | Rejects generic / movement / sourceText-equal rationale |
| `isModelUpdateMovementRationale` | Blocks model-update safe wording as pointer rationale |
| `materializeSurfacedEvidencePointersForPublishedUnderstanding` | Batch helper for multiple publish events |

**Dependency injection:** `findSourceEvidence`, `findEligibleLinks`, `resolveStoredSurfacingRationale`, `resolveLinkPublicEligibility`, `now`, materializer persistence deps — all injectable for tests.

### Not wired (deferred)

**No production route calls the hook yet.**

Recommended next branch: **`desktop-live-evidence-depth-publish-route-wiring-001`**

Wire after upstream provides:
1. A **stored surfacing rationale** field (not `userFacingSummary` movement copy) on publish, **or** a `resolveStoredSurfacingRationale` DB loader.
2. Outbound UEL rows from `pattern_claim` / `contradiction_node` with `meta.graphSlot` (`related` | `context`).

If rationale storage is the blocker first: **`desktop-live-evidence-depth-rationale-source-001`**.

**Suggested call site:** end of `publishModelUpdateCandidate()` transaction success path when `affectedObjectType` ∈ `{pattern_claim, contradiction_node}` — call `maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish` with real DB deps; swallow/log blockers (no throw) so publish is not regressed.

---

## Source of `whyItMatters`

| Source | Used? | Notes |
|--------|-------|-------|
| `EvidenceDepthWriteHookPublishEvent.storedRationale` | **Yes** (explicit events) | Passed through as `whyItMatters` after `assessStoredPublishRationaleForEvidencePointer` |
| `ModelUpdate.userFacingSummary` | **No** (default) | Classified as movement copy via `isModelUpdateMovementRationale` / `MODEL_UPDATE_CANDIDATE_SAFE_SUMMARY_PATTERNS` |
| `resolveStoredSurfacingRationale` dep | **Yes** (when injected) | Intended for future stored surfacing rationale column or derivation artifact |
| `PatternClaim.summary` | **No** | Claim definition, not surfacing rationale; used only for `sourceText` via `findSourceEvidence` |
| Today card body / hero copy | **No** | Not read |
| LLM at read time | **No** | Forbidden |

**Non-generic proof:** Tests use substantive rationale (`"Connects evening overwork to the missing stop point…"`) and reject denylist strings + movement templates.

---

## Stable IDs

Unchanged from write path (#115):

```
pattern_claim      → receipt-pattern-{sourceObjectId}
contradiction_node → receipt-tension-{sourceObjectId}
```

Hook never derives ids from index/title. Duplicate source upserts via materializer `userId+sourceObjectType+sourceObjectId` unique.

---

## UEL `graphSlot` links

1. `getEligibleEvidenceDepthLinksForSource` reads outbound UEL rows for the source object.
2. **Requires** `graphSlotFromUelMeta(row.meta)` — rows without slot are excluded (`links_missing_graph_slot` at source).
3. Public eligibility via `isEvidenceLinkTargetPublicEligible` (or injected checker).
4. Materializer writes UEL with `uelMetaWithGraphSlot(graphSlot, { surfacedPointerMaterialization: true })`.

**Blocker:** Existing dark-engine / map UEL rows do not set `meta.graphSlot` — hook correctly produces zero eligible links until upstream writes slot metadata.

---

## Public eligibility

- Reuses `isEvidenceLinkTargetPublicEligible` for guarded target types (`usermap_conclusion`, `investigation`, `fieldwork_assignment`, `model_update`).
- Ineligible targets excluded; all excluded → `missing_eligible_links` / materializer `no_eligible_links`.
- Pointer `publicEligible: true` only when materialization assessment passes with ≥1 eligible link.

---

## Privacy / leakage safeguards

- No private/unauthorized targets written — eligibility filter before normalization.
- No reference fixture ids (`ctx-self`, `r6`, `r5`, `r2`) in hook inputs.
- No `detailHref` / `receiptHref` as link substitutes.
- Movement copy and generic denylist blocked at hook layer before persistence.
- Route wiring deferred — no accidental production writes with incomplete upstream data.

---

## Tests

**Added:** `lib/__tests__/live-evidence-depth-write-hook.test.ts` (16 cases)

Covers: valid upsert, stable ids, non-generic/missing/generic/equal rationale, no links, missing graphSlot, private exclusion, all-links-excluded, duplicate upsert, related/context slots, depth-list gate via linkage merge, no Today UI changes, model-update movement block, model-update success with injected stored rationale.

**Also run (passing):**

```bash
npx vitest run \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts \
  lib/__tests__/today-evidence-pointer-parity.test.ts \
  lib/__tests__/today-object-graph-parity.test.ts \
  lib/__tests__/today-adapter-honesty.test.ts
```

---

## Checks

```bash
npx prisma validate
npx tsc --noEmit
npm run build
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
git diff --check
```

---

## Classification

**PASS** — hook adapter + tests land; production route wiring correctly deferred with documented upstream blockers.

| | |
|--|--|
| Product code changed | YES |
| UI changed | NO |
| Runtime/visual required | NO |
| Production-ready | NO |

---

## Recommended next branch

1. **`desktop-live-evidence-depth-rationale-source-001`** — if surfacing rationale storage is prioritized first.  
2. **`desktop-live-evidence-depth-publish-route-wiring-001`** — wire hook into `publishModelUpdateCandidate` once rationale + graphSlot links exist.  
3. **`desktop-live-evidence-depth-runtime-validation-001`** — after route wiring; validate real stored pointer through API and Today depth gate.

---

## Commit recommendation

Do not commit on this branch until Kay reviews blocker documentation and next-branch choice. Suggested message when ready:

```
Add live evidence depth write hook adapter with publish guards.

Wire materializer to honest publish events only; defer route integration
until stored surfacing rationale and UEL graphSlot links exist upstream.
```
