# Desktop Live Evidence Depth Write Path 001

**Branch:** `desktop-live-evidence-depth-write-path-001`  
**Baseline:** `5a44ef6` (staging — PR #114 SurfacedEvidencePointer storage migration)  
**Authoritative receipts consulted:** #112 linkage contract, #113 write contract, #114 storage migration  
**UI changed:** NO  
**Product code changed:** YES (write-path helper + tests only)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Implement the write/materialization path that can create contract-valid `SurfacedEvidencePointer` records and eligible UEL `graphSlot` links — without Today read, adapter enrichment, provider hydration, or UI consumption.

---

## Write path / service added

**Module:** `lib/live-evidence-depth-write-path.ts`

| Export | Purpose |
|--------|---------|
| `materializeSurfacedEvidencePointerForUser(input, deps)` | Main orchestrator — normalize links, assess, optionally persist pointer + UEL |
| `buildSurfacedEvidencePointerId({ sourceObjectType, sourceObjectId })` | Deterministic stable id (`receipt-pattern-{id}`, `receipt-tension-{id}`) |
| `normalizeSurfacedEvidencePointerLinks(...)` | Filter links by `publicEligible` or injected eligibility resolver |
| `assessSurfacedEvidencePointerMaterialization(...)` | Extends #113 `assessSurfacedEvidencePointerWrite` with source/id/sourceText gates |
| `buildUnderstandingEvidenceLinksForSurfacedPointer(...)` | Build UEL write payloads with `meta.graphSlot` |
| `upsertSurfacedEvidencePointerRecord({ input, db, now })` | Prisma upsert on `userId+sourceObjectType+sourceObjectId` unique |

**Dependency injection:** `deps` accepts `now`, `resolveLinkPublicEligibility`, `upsertSurfacedEvidencePointer`, `createUnderstandingEvidenceLink`, `db`. Tests inject mocks — no live DB required.

**Not wired:** No production route or publish hook invokes the materializer yet.

---

## DB persistence

**Implemented:** `upsertSurfacedEvidencePointerRecord` performs real Prisma `surfacedEvidencePointer.upsert` when called with `db` + `upsertSurfacedEvidencePointer` deps.

**UEL writes:** When `createUnderstandingEvidenceLink` dep provided, creates links via injected function; duplicate links (`UnderstandingEvidenceLinkDuplicateError`) are skipped idempotently.

**Dry-run mode:** Calling `materializeSurfacedEvidencePointerForUser` without persistence deps returns validated payloads only (`persistedPointerId: null`, `uelLinksWritten: 0`).

---

## Validation gates

| Gate | Blocker |
|------|---------|
| Missing/generic `whyItMatters` | `missing_why_it_matters`, `generic_why_it_matters` |
| `whyItMatters === sourceText` | `why_it_matters_equals_source_text` |
| Missing/generic `sourceText` | `missing_source_text`, `generic_source_text` |
| Unsupported source type | `unsupported_source_object_type` (pattern_claim, contradiction_node only) |
| Missing source id/type | `missing_source_object_id`, `missing_source_object_type` |
| Unstable/index id | `unstable_pointer_id` (rejects `receipt-{digit}-*`) |
| Invalid id prefix | `invalid_pointer_id` |
| No eligible links | `no_eligible_links` |
| Ineligible links | Excluded in normalization; if all excluded → blocked |
| `publicEligible` on pointer | `true` only when full assessment passes |

Generic denylist includes #113 strings plus write-path additions: `"Recent pattern."`, `"Related evidence."`, `"Evidence pointer."`.

**Forbidden:** fallback links, reference fixture ids, LLM rationale, generic filler mapping.

---

## Stable ID generation

```
pattern_claim     → receipt-pattern-{sourceObjectId}
contradiction_node → receipt-tension-{sourceObjectId}
```

Validated via `isAllowedSurfacedPointerId` and must match `buildSurfacedEvidencePointerId` output. Index/title ids like `receipt-0-evening-stress` rejected.

---

## Public eligibility enforcement

1. Each link may declare `publicEligible: boolean`.
2. If omitted, `deps.resolveLinkPublicEligibility` resolves (defaults to excluded when absent).
3. Only surviving eligible links participate in assessment and UEL payload build.
4. Pointer `publicEligible` set `true` only when materialization passes with ≥1 eligible link.

Future write-path wiring should use `isEvidenceLinkTargetPublicEligible` / `filterEvidenceLinksByPublicTargetEligibility` as the resolver.

---

## UEL graphSlot links

- Built via `buildUnderstandingEvidenceLinksForSurfacedPointer`.
- `sourceType`/`sourceId` = pointer `sourceObjectType`/`sourceObjectId` (not pointer id).
- `meta` = `uelMetaWithGraphSlot(graphSlot, { surfacedPointerMaterialization: true })`.
- No duplicate edge storage on `SurfacedEvidencePointer` row.

---

## What remains unimplemented

| Item | Branch |
|------|--------|
| Hook into model-update publish / claim promotion | Optional follow-up in write-path or linkage branch |
| Read API (`GET /api/today/evidence-pointers`) | `desktop-live-evidence-depth-linkage-implementation-001` |
| Adapter mapping + provider hydration | linkage-implementation |
| Today UI consumption | Gated until `canUseLiveEvidenceInspectorDepthList` passes on stored fixture |
| Backfill of existing users | Separate branch if needed |

**Live data passes inspector-depth parity:** **NO** (expected). No production materialization invoked; no read/hydration path.

---

## Files changed

| File | Change |
|------|--------|
| `lib/live-evidence-depth-write-path.ts` | Materializer, upsert, UEL payload builder, validation |
| `lib/__tests__/live-evidence-depth-write-path.test.ts` | 15 write-path tests (DI, no live DB) |

No UI, adapter, provider, or route changes.

---

## Checks / tests run

| Check | Result |
|-------|--------|
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| Vitest (7 suites, 66 tests) | PASS |

---

## Verdict

**PASS** — write/materialization helper lands with full validation, Prisma upsert support, UEL graphSlot payload preparation, and DI-based tests. Backend is capable of writing depth-ready storage when invoked; nothing reads or displays it yet.

---

## Recommended next branch

**`desktop-live-evidence-depth-linkage-implementation-001`**

Read API + adapter/provider hydration for stored `SurfacedEvidencePointer` records. Still no UI consumption until at least one stored fixture passes `canUseLiveEvidenceInspectorDepthList`.

---

## Commit recommendation

```
Add SurfacedEvidencePointer materialization write path.

Validates non-generic rationale and eligible UEL graphSlot links; supports
Prisma upsert via DI without wiring Today read or UI consumption.
```

---

*End of receipt.*
