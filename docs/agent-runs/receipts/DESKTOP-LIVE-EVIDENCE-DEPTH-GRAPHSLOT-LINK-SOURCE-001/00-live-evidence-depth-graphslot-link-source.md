# Desktop Live Evidence Depth GraphSlot Link Source 001

**Branch:** `desktop-live-evidence-depth-graphslot-link-source-001`  
**Baseline:** `bcc36eb` (staging — PR #119 rationale source)  
**Authoritative receipts consulted:** #118 write hook, #119 rationale source  
**UI changed:** NO  
**Product code changed:** YES  
**Schema/migration changed:** NO  
**Route wiring:** NO  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Establish durable upstream UEL `meta.graphSlot` authoring so #118 `getEligibleEvidenceDepthLinksForSource` can find eligible depth links without inferring slot from role or target type.

---

## Files inspected

| Area | Path | Finding |
|------|------|---------|
| UEL writer | `lib/understanding-evidence-link-writer.ts` | Creates links with optional `meta`; no graphSlot until this branch |
| Write hook (#118) | `lib/live-evidence-depth-write-hook.ts` | `getEligibleEvidenceDepthLinksForSource` requires `graphSlotFromUelMeta` |
| Write path (#115) | `lib/live-evidence-depth-write-path.ts` | Materializer writes UEL with `uelMetaWithGraphSlot` |
| Read linkage (#116) | `lib/live-evidence-depth-linkage.ts` | `resolveGraphSlotFromLinkRow` returns null without meta slot |
| Rationale (#119) | `lib/live-evidence-depth-rationale-source.ts` | Stored rationale resolver ready |
| Dark-engine persistence | `lib/understanding-dark-engine/*-persistence.ts` | Creates UEL without graphSlot |
| Model update publish | `lib/model-update-candidate-publish-helper.ts` | No outbound graphSlot links |
| UEL schema | `prisma/schema.prisma` → `UnderstandingEvidenceLink` | `meta Json?` sufficient — no migration needed |

---

## Design chosen

**Option A + B (combined):**

1. **UEL writer extension (Option A):** optional `graphSlot` on `UnderstandingEvidenceLinkWriteInput` persisted via `uelMetaWithGraphSlot` — backward compatible.
2. **Depth-specific helper module (Option B):** `lib/live-evidence-depth-graphslot-link-source.ts` for validated upsert/resolve and #118 `findEligibleLinks` factory.

**No schema migration** — graphSlot lives in existing UEL `meta` Json per write contract §B.2.

---

## Helpers added / changed

### New module: `lib/live-evidence-depth-graphslot-link-source.ts`

| Export | Purpose |
|--------|---------|
| `assessEvidenceDepthGraphSlotLinkInput` | Rejects missing/invalid graphSlot; no role inference |
| `buildEvidenceDepthGraphSlotLinkInput` | Builds UEL write input with explicit meta.graphSlot |
| `upsertEvidenceDepthGraphSlotLinkForUser` | Creates link or updates meta on duplicate (repo unique key) |
| `upsertEvidenceDepthGraphSlotLinksForSource` | Batch upsert for a source object |
| `resolveEvidenceDepthGraphSlotLinksForSource` | Reads UEL rows → eligible hook link candidates |
| `createFindEligibleLinksForEvidenceDepthHook` | #118 `findEligibleLinks` dep factory |
| `listUnderstandingEvidenceLinkRowsForSource` | List outbound UEL rows for source |
| `graphSlotFromRoleOnly` | Documents that role alone never implies slot (always null) |

### Changed: `lib/understanding-evidence-link-writer.ts`

- Added optional `graphSlot?: "related" \| "context"` on `UnderstandingEvidenceLinkWriteInput`
- `createUnderstandingEvidenceLinkForUser` merges into `meta` via `uelMetaWithGraphSlot`

---

## How graphSlot is authored/written

1. Caller passes **explicit** `graphSlot: "related"` or `"context"` to depth helper or UEL writer.
2. Persisted as `meta.graphSlot` via `uelMetaWithGraphSlot(graphSlot, { evidenceDepthGraphSlotMaterialization: true })`.
3. Duplicate `userId+target+source+role` rows update meta.graphSlot instead of creating a second row (matches UEL `@@unique`).

**Slot is NOT inferred from:** role, target type, title, href, Today card shape, or read/linkage paths.

---

## Public eligibility safeguards

- `upsertEvidenceDepthGraphSlotLinkForUser` skips ineligible targets (`{ skipped: true }`) — no UEL write.
- `resolveEvidenceDepthGraphSlotLinksForSource` reuses `getEligibleEvidenceDepthLinksForSource` + `isEvidenceLinkTargetPublicEligible` (injectable in tests).
- Ownership still enforced by `createUnderstandingEvidenceLinkForUser` before create/update.

---

## Route wiring

**NO** — publish routes and dark-engine persistence unchanged. Helpers are ready for authoring-path integration.

---

## Remaining blockers

1. **No production authoring path** calls `upsertEvidenceDepthGraphSlotLinksForSource` or `upsertEvidencePointerSurfacingRationale` together before publish.
2. **Publish route still deferred** — `publishModelUpdateCandidate` does not invoke #118 materializer.

---

## Tests

**Added:** `lib/__tests__/live-evidence-depth-graphslot-link-source.test.ts` (14 cases)  
**Updated:** `lib/__tests__/understanding-evidence-link-writer.test.ts` (graphSlot meta persistence)

Covers: related/context meta, missing/invalid slot, no role inference, ineligible exclusion, duplicate upsert, #118 hook + #119 rationale integration, #116 linkage with helper meta, no UI changes.

**Run (all passing):**

```bash
npx vitest run \
  lib/__tests__/live-evidence-depth-graphslot-link-source.test.ts \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-rationale-source.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts \
  lib/__tests__/understanding-evidence-link-writer.test.ts
# 99 tests passed
```

---

## Checks

```bash
npx prisma validate    # OK
npx tsc --noEmit       # OK
npm run build          # OK
bash scripts/check-trust-language.sh    # PASSED
bash scripts/check-legacy-surfaces.sh   # PASSED
git diff --check       # OK
```

---

## Classification

**PASS** — graphSlot UEL write source + hook resolver factory land; route wiring correctly deferred.

| | |
|--|--|
| Product code changed | YES |
| UI changed | NO |
| Schema/migration changed | NO |
| Route wiring | NO |
| Production-ready | NO |

---

## Recommended next branch

**`desktop-live-evidence-depth-authoring-path-001`**

Wire internal review / dark-engine / candidate creation to persist **both**:
- `EvidencePointerSurfacingRationale` (rationale)
- `upsertEvidenceDepthGraphSlotLinksForSource` (explicit related/context links)

Then **`desktop-live-evidence-depth-publish-route-wiring-001`** to call #118 materializer after publish when both exist.

---

## Commit recommendation

Do not commit until Kay reviews. Suggested message:

```
Add evidence depth graphSlot UEL link source and writer support.

Persists explicit meta.graphSlot at link creation; provides upsert/resolve
helpers and #118 findEligibleLinks factory without role inference.
```
