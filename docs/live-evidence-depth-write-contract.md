# Live Evidence Depth Write Contract

> **Status:** Write-time contract definition (not implemented in storage/API)  
> **Baseline:** `f17deb6`  
> **Builds on:** [`live-evidence-depth-linkage-contract.md`](./live-evidence-depth-linkage-contract.md) (#112)  
> **Production-ready:** NO

This document defines **where and how** stored surfacing rationale and durable receipt→object links must be **written** before adapter enrichment or UI consumption can succeed.

---

## 1. Verdict

**Option B — new storage and write path required.**

Existing tables are **not sufficient** to pass `canUseLiveEvidenceInspectorDepth` today:

| Need | Existing storage | Gap |
|------|------------------|-----|
| Stored `whyItMatters` | **None** on surfacing path | `PatternClaim.summary` is claim text, not surfacing rationale; hero/card copy is generic |
| Stored `whyResurfaced` | **None** | Only reference fixtures |
| Stable pointer id | Ephemeral `receipt-${index}-${title}` at read | Must be `receipt-pattern-*` / `receipt-tension-*` |
| Durable links | `UnderstandingEvidenceLink` **partial** | Outbound links from pattern/contradiction may exist but are not written for Today pointer semantics; no `graphSlot`; Today does not read UEL |
| Write path | **None** | `buildTodaySurfacingCards()` is **read-time only** — no persistence when a card appears on Today |

**UEL alone cannot satisfy the contract** without (1) a new stored surfacing rationale field and (2) a write path that materializes pointer records when surfacing occurs.

---

## 2. Schema / storage inspected

### 2.1 Prisma models relevant to write contract

| Model | Path | Write-relevant fields |
|-------|------|----------------------|
| `PatternClaim` | `prisma/schema.prisma` | `summary`, `summaryNorm`, evidence via `PatternClaimEvidence` — **no surfacing rationale** |
| `PatternClaimEvidence` | same | `quote`, `source`, `journalEntryId` — evidence quotes only |
| `ContradictionNode` | same | `title`, `sideA`, `sideB`, `status` — **no surfacing rationale** |
| `ContradictionEvidence` | same | `quote`, `source` |
| `UnderstandingEvidenceLink` | same | `targetType`, `targetId`, `sourceType`, `sourceId`, `role`, `summary`, `quote`, `meta` (Json) |
| `ModelUpdate` | same | `userFacingSummary` — movement copy, **not** receipt pointer rationale |
| `UserMapConclusion` | same | `title`, `summary` — link targets |
| `SurfacedAction` | same | action surfacing — unrelated to Evidence Pointer aside |
| `JournalEntry` | same | body/title — journals excluded from aside today (`receiptHref: null`) |

**No `SurfacedEvidencePointer` or equivalent table exists.**

### 2.2 Migration conventions

- Migrations live in `prisma/migrations/` with timestamped folders and `migration.sql`.
- Additive migrations are standard (new table, new optional columns, new enum values).
- UEL foundation: `20260514171847_add_understanding_engine_phase1a_foundation`.

---

## 3. Section A — Stored surfacing rationale

### A.1 Where `whyItMatters` is stored

**Required: new persisted record** — `SurfacedEvidencePointer` (proposed name).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | String @id | yes | Stable: `receipt-pattern-{claimId}` or `receipt-tension-{nodeId}` |
| `userId` | String | yes | Owner |
| `pointerKind` | enum | yes | `pattern` \| `tension` \| `journal` |
| `sourceObjectType` | `UnderstandingLinkSourceType` | yes | e.g. `pattern_claim`, `contradiction_node` |
| `sourceObjectId` | String | yes | Durable source id |
| `sourceText` | String | yes | Quote shown in aside |
| `sourceOrigin` | String | yes | Provenance label |
| `surfacedAt` | DateTime | yes | Write time |
| `whyItMatters` | String | yes | **Stored at surfacing write** — validated non-generic |
| `whyResurfaced` | String? | no | Only when re-surfacing is intentional |
| `libraryReceiptId` | String? | no | Continuity with `/library/receipt-*` |
| `detailHref` | String? | no | Public object href |

**Not acceptable locations for pointer `whyItMatters`:**

- `PatternClaim.summary` (claim definition, not why surfaced now)
- `TodaySurfacingCard.body` (generic count copy)
- `TodayHeroItem.whyItMatters` in `today-reentry.ts` (hardcoded generic strings)
- UEL `summary` on a link **unless** product semantics document that row as the pointer rationale (still requires pointer record for id/stable read path)

### A.2 Where `whyResurfaced` is stored

Same `SurfacedEvidencePointer.whyResurfaced` — optional. Write only when surfacing job detects re-surfacing (e.g. model update references same pattern within window). **Never** synthesize at read.

### A.3 Write path owner (who creates it)

**Primary write path (proposed):** `materializeSurfacedEvidencePointersForUser()` — new function invoked from **one** of:

1. **Model update publish** (`lib/understanding-dark-engine/model-update-candidate-persistence.ts`) when `affectedObjectType` is `pattern_claim` or `contradiction_node` and update is `user_visible` — rationale = `userFacingSummary` **only if** it explains surfacing, not generic movement boilerplate.
2. **Pattern claim promotion** (`lib/pattern-claim-lifecycle.ts`) when status becomes `active` and claim is top surfacing candidate — rationale from **stored** surfacing proposal (dark engine or derivation output), not `summary`.
3. **Dedicated surfacing materializer** (new) run after same inputs as `buildTodaySurfacingCards` but **persists** pointer rows instead of only projecting at read.

**Forbidden:** `buildTodaySurfacingCards()` / `mapTodayDataToV0Props()` — read-only today.

### A.4 Non-generic validation

Use `lib/live-evidence-depth-write-contract.ts`:

- `isGenericSurfacingRationale()` — denylist includes `"Surfaced from your recent material."`, evidence-count boilerplate, etc.
- `whyItMatters` must not equal `sourceText` verbatim.
- Tests: `lib/__tests__/live-evidence-depth-write-contract.test.ts`

### A.5 Forbidden fallbacks

- Hero filler strings from `heroFromSurfacingCard` / `heroFromMovement`
- Pattern card `body` templates
- Copying `sourceText` into `whyItMatters`
- LLM generation at read time

---

## 4. Section B — Durable receipt → object links

### B.1 Which table stores edges

**Primary:** `UnderstandingEvidenceLink` (existing) for durable understanding graph edges.

**Secondary:** Optional embedded link rows on `SurfacedEvidencePointer` only if UEL traversal is insufficient — prefer UEL for single source of truth.

### B.2 Does UEL support the contract?

**Partially yes:**

- Supports `sourceType`: `pattern_claim`, `contradiction_node`, `pattern_claim_evidence`, `evidence_span`, `journal_entry`, etc.
- Supports `targetType`: `usermap_conclusion`, `investigation`, `model_update`, `fieldwork_assignment`, `pattern_claim`, `contradiction_node`, `surfaced_action`
- Supports `role`: `supports`, `context`, `contradicts`, …
- Supports `summary` (link-local rationale)
- Supports `meta` Json — **use for `graphSlot`**: `{ "graphSlot": "related" | "context" }` via `uelMetaWithGraphSlot()` in `lib/live-evidence-depth-write-contract.ts`

**Gaps:**

- No `graphSlot` column — use `meta.graphSlot` (no migration required for slot alone).
- No write today from surfacing job — links created in dark-engine publish (`model-update-candidate-persistence.ts`) but not aligned to Today pointer surfacing.
- Source for Today pointer is often the **pattern/contradiction itself**; outbound UEL from `pattern_claim` → `usermap_conclusion` can serve as `relatedIds` **if** written at publish and traversed at read.

### B.3 Traversal rules (read time, after write)

For pointer with `sourceObjectType=pattern_claim`, `sourceObjectId={id}`:

```
GET /api/understanding/evidence-links?sourceType=pattern_claim&sourceId={id}
→ filter filterEvidenceLinksByPublicTargetEligibility
→ map role + meta.graphSlot → relatedIds / contextIds
```

Default `graphSlot` when `meta` absent: `role === "context"` → `context`; else `related`.

### B.4 Required edge fields at write

| Field | Storage |
|-------|---------|
| source id | UEL `sourceType` + `sourceId` (= pointer `sourceObjectType/Id`) |
| target id | UEL `targetType` + `targetId` |
| role | UEL `role` |
| graphSlot | UEL `meta.graphSlot` |
| rationale | UEL `summary` (optional, link-local) |
| publicEligible | Computed at write via `verifyUnderstandingEvidenceLinkTargetOwnership` + `isEvidenceLinkTargetPublicEligible`; store only eligible links |
| createdAt | UEL `createdAt` |

### B.5 Write path for links

Same owner as pointer materialization — when creating/updating `SurfacedEvidencePointer`, also:

1. Ensure outbound UEL rows exist (create via `createUnderstandingEvidenceLinkForUser` if missing).
2. Set `meta.graphSlot` on create.
3. Skip ineligible targets.

**Existing writer:** `lib/understanding-evidence-link-writer.ts` — reuse; extend call sites in materializer, not in Today read path.

---

## 5. Section C — Public eligibility / privacy

Reuse:

- `lib/understanding-evidence-link-public-eligibility.ts` — `isEvidenceLinkTargetPublicEligible`, `filterEvidenceLinksByPublicTargetEligibility`
- Guarded types: `usermap_conclusion`, `investigation`, `fieldwork_assignment`, `model_update`
- `pattern_claim` / `contradiction_node` as targets: ownership via `verifyUnderstandingEvidenceLinkTargetOwnership`

**Rules:**

1. Do not emit link in pointer materialization if target fails eligibility.
2. If zero eligible links after filter → pointer is **not** `writeReady` (`assessSurfacedEvidencePointerWrite` → `no_eligible_links`).
3. Linked object summaries must use public projection helpers (inspector/map APIs) — no raw message content.
4. Unauthorized target → omit link; do not include id in `relatedIds`/`contextIds`.
5. Unhydrated target → omit link at write or mark pointer blocked until hydration path exists.

**Test (future):** ineligible `investigation` target excluded; pointer fails write assessment.

---

## 6. Section D — Provider hydration contract (read side, fed by write)

Write contract **must** enable future read API (`GET /api/today/evidence-pointers` or `TodayReentrySnapshot` extension) per linkage contract §4.

Hydration is **not** write-branch scope but write must store ids that hydration will register:

- Pointer record supplies `OrvekObject` receipt fields.
- Each eligible UEL target id must match a `linkedObjects[]` entry built from inspector/map projection.

`isNearEmptyInspectorObject` minimums per target type — see linkage contract §6.2.

**One-level closure required:** receipt → linked targets resolve. Level-2 optional.

---

## 7. Section E — Write-time vs read-time

| Field | Write-time | Read-time deterministic | Read-time forbidden |
|-------|------------|----------------------|---------------------|
| `sourceText` | yes (from evidence quote) | format only | — |
| `sourceOrigin`, `surfacedAt` | yes | relative date label | — |
| `whyItMatters` | **yes — required** | never | LLM / generic copy |
| `whyResurfaced` | yes when applicable | never | LLM |
| UEL edges | yes (or verified existing) | traverse + eligibility filter | invent edges |
| `linkedObjects` payloads | no (stored on target rows) | project from DB via inspector helpers | fabricate summaries |
| Top surfacing selection | yes (materialize who surfaced) | must not re-pick different object than stored pointer | — |

### Backfill

- **Allowed:** create `SurfacedEvidencePointer` only where non-generic rationale already exists (e.g. archived `ModelUpdate.userFacingSummary` that passes `isGenericSurfacingRationale` false and is surfacing-specific).
- **Forbidden:** backfill generic text; backfill links without eligibility; backfill `whyItMatters` from `PatternClaim.summary` alone.

---

## 8. Proposed migration (not implemented in this branch)

```prisma
model SurfacedEvidencePointer {
  id               String   @id
  userId           String
  pointerKind      String   // pattern | tension | journal
  sourceObjectType UnderstandingLinkSourceType
  sourceObjectId   String
  sourceText       String
  sourceOrigin     String
  whyItMatters     String
  whyResurfaced    String?
  libraryReceiptId String?
  detailHref       String?
  surfacedAt       DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId, surfacedAt])
  @@index([userId, sourceObjectType, sourceObjectId])
}
```

Optional: `SurfacedEvidencePointerStatus` for superseded pointers.

**No migration applied in PR #113 write-contract branch** — documented for `desktop-live-evidence-depth-storage-migration-001`.

---

## 9. Acceptance tests (future implementation branches)

| Test | Expectation |
|------|-------------|
| `assessSurfacedEvidencePointerWrite` with valid pointer + links | `writeReady: true` |
| Missing `whyItMatters` | `missing_why_it_matters` |
| Generic rationale | `generic_why_it_matters` |
| `whyItMatters === sourceText` | `why_it_matters_equals_source_text` |
| No eligible links | `no_eligible_links` |
| UEL meta graphSlot round-trip | `graphSlotFromUelMeta` |
| Materialized pointer + hydration | `canUseLiveEvidenceInspectorDepthList` true |
| `receiptHref`/`detailHref` alone without stored pointer | depth blocked |
| Today UI | no live row consumption until fixture passes |

**Added in this branch:** `lib/__tests__/live-evidence-depth-write-contract.test.ts` (write validation only).

---

## 10. Future branches

| Order | Branch | Scope |
|-------|--------|-------|
| 1 | **`desktop-live-evidence-depth-storage-migration-001`** | Add `SurfacedEvidencePointer` migration + Prisma client |
| 2 | **`desktop-live-evidence-depth-write-path-001`** | Materializer + UEL writes + validation at publish/surfacing |
| 3 | `desktop-live-evidence-depth-linkage-implementation-001` | Read API + adapter + provider hydration |
| 4 | `desktop-live-today-evidence-pointer-ui-depth-gated-001` | UI only after real fixture passes depth gate |

---

*End of write contract.*
