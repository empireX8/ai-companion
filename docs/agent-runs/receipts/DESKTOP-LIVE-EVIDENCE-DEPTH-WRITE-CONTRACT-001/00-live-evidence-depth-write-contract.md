# Desktop Live Evidence Depth Write Contract 001

**Branch:** `desktop-live-evidence-depth-write-contract-001`  
**Baseline:** `f17deb6` (staging — PR #112 live evidence depth linkage contract)  
**Authoritative receipts consulted:** #109 reference evidence inspector trace, #110 inspector depth parity, #111 enrichment audit, #112 linkage contract  
**Durable contract:** [`docs/live-evidence-depth-write-contract.md`](../../../live-evidence-depth-write-contract.md)  
**UI changed:** NO  
**Product code changed:** YES (write-validation helpers + tests only — no persistence, no adapter, no UI)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Blocker this contract answers

PR #112 defined **what** a live Evidence Pointer must carry for inspector-depth parity (`TodayEvidencePointerReceipt`, links, hydration). This slice answers **where** stored surfacing rationale and durable receipt→object links are **created, stored, and validated** at write time — without UI consumption, adapter enrichment, or risky migration implementation.

---

## Schema / storage inspected

| Location | Finding |
|----------|---------|
| `prisma/schema.prisma` | `UnderstandingEvidenceLink` exists with `sourceType`, `sourceId`, `targetType`, `targetId`, `role`, `summary`, `meta` (Json). **No** `SurfacedEvidencePointer` or surfacing-rationale table. |
| `prisma/migrations/` | Timestamped additive migrations; UEL foundation `20260514171847_add_understanding_engine_phase1a_foundation`. |
| `PatternClaim` / `ContradictionNode` | Claim/tension text only — **no** pointer-level `whyItMatters`. |
| `ModelUpdate` | `userFacingSummary` for movement copy — not receipt surfacing rationale. |
| `SurfacedAction` | Action surfacing — unrelated to Evidence Pointer aside. |

---

## Existing write paths inspected

| Path | File | Creates pointer rationale? | Creates durable links? |
|------|------|---------------------------|------------------------|
| Today surfacing projection | `lib/today-surface.ts` → `buildTodaySurfacingCards()` | **No** — read-time cards with `title`, `body`, `receiptHref` only | **No** — `detailHref` not persisted on receipt |
| Today receipt cards | `lib/today-reentry.ts` / adapter | **No** | **No** |
| Pattern claim lifecycle | `lib/pattern-claim-lifecycle.ts` | **No** | Evidence quotes via `PatternClaimEvidence` only |
| Contradiction materialization | `lib/contradiction-materialization.ts` | **No** | Evidence quotes only |
| Model update publish | `lib/understanding-dark-engine/model-update-candidate-persistence.ts` | **No** pointer record | **Yes** — UEL via `createUnderstandingEvidenceLinkForUser` on publish |
| Fieldwork publish | `lib/understanding-dark-engine/fieldwork-candidate-persistence.ts` | **No** | **Yes** — UEL on publish |
| UEL writer | `lib/understanding-evidence-link-writer.ts` | N/A | Ownership + dedupe; `meta` supported |
| UEL API | `app/api/understanding/evidence-links/route.ts` | N/A | POST creates links |

**Conclusion:** No write path today materializes a Today Evidence Pointer with stored `whyItMatters` or pointer-scoped durable links. UEL may contain outbound edges from `pattern_claim` / `contradiction_node` but they are not written for Today surfacing semantics and Today does not read them.

---

## UEL / UnderstandingEvidenceLink assessment

**Partial fit — insufficient alone.**

| Capability | UEL support | Gap |
|------------|-------------|-----|
| Durable edges source → target | Yes (`sourceType`/`sourceId`, `targetType`/`targetId`, `role`) | Not written at surfacing; no pointer id as source |
| Link rationale | `summary` | Link-local only — **not** pointer `whyItMatters` |
| `graphSlot` (`related` \| `context`) | Via `meta.graphSlot` (no migration) | Not written today |
| Public eligibility | `verifyUnderstandingEvidenceLinkTargetOwnership` + `filterEvidenceLinksByPublicTargetEligibility` | Must be enforced at write |
| Stable pointer id | **No** | Requires new `SurfacedEvidencePointer` record |

Traversal rule (future read): query UEL by `sourceType=pattern_claim|contradiction_node` + `sourceId`, filter eligible, map `meta.graphSlot` → `relatedIds`/`contextIds`.

---

## Required stored fields (write contract)

### Pointer record (`SurfacedEvidencePointer` — proposed, not migrated)

- `id` — stable `receipt-pattern-{id}` / `receipt-tension-{id}`
- `userId`, `pointerKind`, `sourceObjectType`, `sourceObjectId`
- `sourceText`, `sourceOrigin`, `surfacedAt`
- **`whyItMatters`** (required, non-generic, ≠ `sourceText`)
- `whyResurfaced` (optional)
- `libraryReceiptId`, `detailHref` (optional continuity)

### Edge / link fields (UEL or equivalent)

- `sourceObjectType` + `sourceObjectId` (= pointer source)
- `targetType` + `targetId`
- `role`, `graphSlot` in `meta`
- `summary` (optional link rationale)
- `publicEligible` at write (skip ineligible)
- `createdAt` via UEL

---

## Write-time owner / path (proposed)

**`materializeSurfacedEvidencePointersForUser()`** — new function, invoked from:

1. Model update publish when surfacing pattern/tension with non-generic rationale, **or**
2. Pattern claim promotion to active surfacing candidate, **or**
3. Dedicated surfacing materializer after same inputs as `buildTodaySurfacingCards` but **persisting** pointer rows.

At materialization:

1. Validate pointer via `assessSurfacedEvidencePointerWrite()` (`lib/live-evidence-depth-write-contract.ts`).
2. Persist `SurfacedEvidencePointer` (after migration branch).
3. Ensure UEL rows with `uelMetaWithGraphSlot()` via `createUnderstandingEvidenceLinkForUser`.

**Forbidden write owners:** `buildTodaySurfacingCards`, `mapTodayDataToV0Props`, `receiptRowToOrvekObject`, read-time LLM.

---

## Read-time derivation rules

| Field | Write | Read derive | Read forbidden |
|-------|-------|-------------|----------------|
| `whyItMatters` | Required | Never | Generic copy, LLM |
| `whyResurfaced` | When applicable | Never | LLM |
| UEL edges | Required | Traverse + eligibility filter | Invent |
| `linkedObjects` | No (on targets) | Project via inspector/map APIs | Fabricate |
| Top surfacing pick | Persist pointer | Must match stored pointer | Re-pick different object |

---

## Privacy / eligibility rules

- Reuse `lib/understanding-evidence-link-public-eligibility.ts`.
- Ineligible targets omitted at write; pointer fails `no_eligible_links` if zero remain.
- Unauthorized / unhydrated targets excluded from `relatedIds`/`contextIds`.
- No raw private evidence in Today root projections.

---

## Provider hydration requirements (enabled by write, implemented later)

Per linkage contract §4–6:

- Read API: `GET /api/today/evidence-pointers` or `TodayReentrySnapshot` extension.
- Register `linkedObjects` in provider `objects` map with id-aligned `relatedIds`/`contextIds`.
- Targets must pass `isNearEmptyInspectorObject` minimums.
- One-level graph closure required.

---

## Migration / backfill implications

**Migration required** — documented in durable doc §8, **not applied** in this branch:

```prisma
model SurfacedEvidencePointer { ... }
```

**Backfill allowed:** only where non-generic rationale already exists (e.g. specific `ModelUpdate.userFacingSummary` passing `isGenericSurfacingRationale` false).

**Backfill forbidden:** generic hero/card copy; `PatternClaim.summary` alone; invented links; read-time LLM rationale.

---

## Product code added (this branch)

| File | Purpose |
|------|---------|
| `lib/live-evidence-depth-write-contract.ts` | Write input types, generic rationale denylist, `assessSurfacedEvidencePointerWrite`, UEL `graphSlot` meta helpers |
| `lib/__tests__/live-evidence-depth-write-contract.test.ts` | Validation tests (generic/missing rationale, eligible links, stable ids, meta round-trip) |

No persistence, no adapter mapping, no gate loosening, no live pointer visibility.

---

## Acceptance tests defined

### Added (this branch)

- `lib/__tests__/live-evidence-depth-write-contract.test.ts` — write assessment only

### Future implementation branches

| Test | Expectation |
|------|-------------|
| Stored `whyItMatters` non-generic | `writeReady: true` |
| Missing / generic rationale | `missing_why_it_matters` / `generic_why_it_matters` |
| Durable link resolves | UEL + `graphSlot` → depth graph |
| Unauthorized link excluded | `no_eligible_links` or omitted id |
| Unhydrated / near-empty target | depth gate blocked |
| Provider hydration | `canUseLiveEvidenceInspectorDepthList` true on real fixture |
| `receiptHref`/`detailHref` alone | depth blocked |
| Today UI | reference-only until fixture passes |

---

## Checks / tests run

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| `npx vitest run` (5 parity + write-contract suites) | PASS — 40 tests |

---

## Verdict

**B — new storage and write path required.**

Existing UEL can store durable edges with `meta.graphSlot` but **cannot** satisfy the contract without:

1. New `SurfacedEvidencePointer` (or equivalent) table for stored `whyItMatters` / stable pointer ids.
2. New write path at surfacing/model-update time that materializes pointers and eligible UEL links.
3. Future read API + adapter + hydration (linkage-implementation branch).

Current live pipeline remains blocked for inspector-depth parity. No UI or adapter changes in this branch.

---

## Recommended next branch

**`desktop-live-evidence-depth-storage-migration-001`**

Add additive `SurfacedEvidencePointer` Prisma migration + client, then:

**`desktop-live-evidence-depth-write-path-001`** — materializer + UEL writes at publish/surfacing.

---

## Changed files

- `docs/live-evidence-depth-write-contract.md` (new)
- `docs/agent-runs/receipts/DESKTOP-LIVE-EVIDENCE-DEPTH-WRITE-CONTRACT-001/00-live-evidence-depth-write-contract.md` (this receipt)
- `lib/live-evidence-depth-write-contract.ts` (new)
- `lib/__tests__/live-evidence-depth-write-contract.test.ts` (new)

---

## Commit recommendation

Ready to commit when requested. Suggested message:

```
Define live evidence depth write contract and validation helpers.

Documents where surfacing rationale and durable receipt links must be
written; adds write-time assessment helpers without persistence or UI.
```

---

*End of receipt.*
