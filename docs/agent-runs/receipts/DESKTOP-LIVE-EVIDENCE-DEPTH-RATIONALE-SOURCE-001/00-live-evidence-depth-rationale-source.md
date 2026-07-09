# Desktop Live Evidence Depth Rationale Source 001

**Branch:** `desktop-live-evidence-depth-rationale-source-001`  
**Baseline:** `3b5c7c5` (staging — PR #118 write-hook adapter)  
**Authoritative receipts consulted:** #118 write hook, #113 write contract, #115 write path  
**UI changed:** NO  
**Product code changed:** YES (schema + rationale source module + tests)  
**Schema/migration changed:** YES  
**Route wiring:** NO  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Add an upstream durable stored surfacing rationale source for Evidence Pointer `whyItMatters` so #118 hook `resolveStoredSurfacingRationale` can load honest pointer-specific rationale — without using `ModelUpdate.userFacingSummary`, Today copy, or read-time generation.

---

## Files inspected

| Area | Path | Finding |
|------|------|---------|
| Pointer output storage | `prisma/schema.prisma` → `SurfacedEvidencePointer` | Materialized output with `whyItMatters` — not upstream authoring store |
| Model update publish | `lib/model-update-candidate-publish-helper.ts` | Only `userFacingSummary` (movement copy) |
| Dark engine proposal | `lib/understanding-dark-engine/model-update-candidate-proposal.ts` | No pointer rationale field on proposal |
| Pattern/contradiction models | `prisma/schema.prisma` | `summary` / tension sides — claim definition, not surfacing rationale |
| Write hook (#118) | `lib/live-evidence-depth-write-hook.ts` | Accepts `storedRationale` + `resolveStoredSurfacingRationale` dep |
| UEL links | `lib/understanding-links.ts` | Outbound links exist but lack `meta.graphSlot` (still blocked) |

---

## Design chosen: Option B — separate upstream table

**Model:** `EvidencePointerSurfacingRationale`

Rationale is keyed by source object identity (`userId` + `sourceObjectType` + `sourceObjectId`), authored before materialization, and distinct from:
- `ModelUpdate.userFacingSummary` (movement copy)
- `SurfacedEvidencePointer.whyItMatters` (materialized output)
- `PatternClaim.summary` (claim definition)

### Schema fields

| Field | Purpose |
|-------|---------|
| `rationale` | Stored pointer-specific whyItMatters |
| `whyResurfaced` | Optional re-surfacing explanation |
| `sourceEvidenceId` | Optional link to evidence row |
| `authoredFrom` | Audit trail (e.g. `internal_review`, `dark_engine_candidate`) |
| `meta` | Optional Json extension |

**Uniqueness:** `@@unique([userId, sourceObjectType, sourceObjectId])` — one rationale row per source per user.

**Migration:** `prisma/migrations/20260709140000_add_evidence_pointer_surfacing_rationale/migration.sql`

---

## Rationale source added

**Module:** `lib/live-evidence-depth-rationale-source.ts`

| Export | Purpose |
|--------|---------|
| `assessEvidencePointerSurfacingRationale` | Validates rationale (missing/generic/movement/sourceText-equal) |
| `assessStoredPublishRationaleForEvidencePointer` | #118-compatible assessment alias |
| `isModelUpdateMovementRationale` | Blocks movement templates (moved from write-hook, re-exported there) |
| `upsertEvidencePointerSurfacingRationale` | Validated upsert by source identity |
| `resolveStoredEvidencePointerSurfacingRationale` | DB read by userId + sourceObjectType + sourceObjectId |
| `createResolveStoredSurfacingRationaleForModelUpdatePublish` | Factory for #118 `resolveStoredSurfacingRationale` dep |

**Where rationale comes from:** Human/agent-authored text persisted via `upsertEvidencePointerSurfacingRationale` at or before publish/promote time. **Not** derived from `userFacingSummary`, Today cards, or LLM at read time.

**Why it is not movement copy:** Upsert and resolver re-validate against `isModelUpdateMovementRationale` + `isGenericSurfacingRationale` denylist. Movement templates (`"There is early evidence that…"`, `"New conclusion: …"`, etc.) are rejected at write and filtered at resolve.

---

## Validation rules

| Rule | Blocker |
|------|---------|
| Missing/blank | `missing_stored_rationale` |
| Generic denylist | `generic_stored_rationale` |
| Model-update movement templates | `movement_copy_rationale` |
| Equals source evidence quote | `rationale_equals_source_text` |
| Unsupported source type | `unsupported_source_object_type` |

`upsertEvidencePointerSurfacingRationale` throws `EvidencePointerSurfacingRationaleValidationError` on failed assessment.

---

## #118 hook integration

- Validation functions moved to rationale-source; write-hook imports and **re-exports** them (guards unchanged).
- Tests prove `createResolveStoredSurfacingRationaleForModelUpdatePublish` enables materialization when stored rationale + eligible links exist.
- Tests prove invalid stored movement-copy in DB is filtered by resolver → hook still blocks.

**No production route wired.** Publish helper does not call upsert or hook yet.

---

## Remaining blockers

1. **No production authoring path** — internal review / dark engine must call `upsertEvidencePointerSurfacingRationale` with human/agent-authored rationale (next integration slice).
2. **UEL `meta.graphSlot` still missing** on outbound links — #118 hook still cannot find eligible depth links in production.
3. **Route wiring deferred** until both rationale authoring path and graphSlot links exist.

---

## Tests

**Added:**
- `lib/__tests__/live-evidence-depth-rationale-source.test.ts` (14 cases)
- `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts` (7 cases)

**Updated:** `lib/live-evidence-depth-write-hook.ts` — validation imports from rationale-source (re-exports preserved)

**Run (all passing):**

```bash
npx vitest run \
  lib/__tests__/live-evidence-depth-rationale-source.test.ts \
  lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts
# 84 tests passed
```

---

## Checks

```bash
npx prisma validate    # OK
npx prisma generate    # OK
npx tsc --noEmit       # OK
npm run build          # OK
bash scripts/check-trust-language.sh    # PASSED
bash scripts/check-legacy-surfaces.sh   # PASSED
git diff --check       # OK
```

---

## Classification

**PASS** — durable upstream rationale storage + validation + resolver land; route wiring correctly deferred.

| | |
|--|--|
| Product code changed | YES |
| UI changed | NO |
| Schema/migration changed | YES |
| Route wiring | NO |
| Production-ready | NO |

---

## Recommended next branch

**`desktop-live-evidence-depth-graphslot-link-source-001`**

Ensure publish/promotion writes UEL outbound links from `pattern_claim` / `contradiction_node` with `meta.graphSlot` (`related` | `context`) so #118 hook `findEligibleLinks` can succeed.

After graphSlot + rationale authoring path exist:

**`desktop-live-evidence-depth-publish-route-wiring-001`**

---

## Commit recommendation

Do not commit until Kay reviews. Suggested message when ready:

```
Add EvidencePointerSurfacingRationale upstream storage and resolver.

Provides durable pointer-specific whyItMatters before materialization;
blocks movement-copy and generic rationale at upsert and resolve time.
```
