# Desktop Live Evidence Depth Storage Migration 001

**Branch:** `desktop-live-evidence-depth-storage-migration-001`  
**Baseline:** `0364669` (staging — PR #113 live evidence depth write contract)  
**Authoritative receipts consulted:** #112 linkage contract, #113 write contract  
**Durable contracts:** [`docs/live-evidence-depth-linkage-contract.md`](../../../live-evidence-depth-linkage-contract.md), [`docs/live-evidence-depth-write-contract.md`](../../../live-evidence-depth-write-contract.md)  
**UI changed:** NO  
**Product code changed:** YES (schema + migration + schema contract tests only)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Blocker this migration solves

PR #113 concluded **Option B**: existing storage cannot hold stored surfacing rationale or stable Today Evidence Pointer ids. This slice adds the **additive persistence layer** only — no materializer, no API, no adapter, no UI consumption.

---

## Migration / persistence convention found

| Convention | Location |
|------------|----------|
| ORM | Prisma 6 (`prisma/schema.prisma`) |
| Migrations | `prisma/migrations/{timestamp}_{name}/migration.sql` |
| Client generation | `postinstall` → `prisma generate`; not committed |
| Local DB | `npm run db:migrate` / `db:local` (Docker Postgres) |
| Schema contract tests | `lib/__tests/*-schema.test.ts` — read `schema.prisma` + migration SQL without live DB |

Conventions are **clear**. Migration implemented additively.

---

## Storage object added

### Table: `SurfacedEvidencePointer`

### Enums

| Enum | Values |
|------|--------|
| `SurfacedEvidencePointerKind` | `pattern`, `tension`, `journal` |
| `SurfacedEvidencePointerSurface` | `today_evidence_pointer` |
| `SurfacedEvidencePointerStatus` | `active`, `expired`, `dismissed`, `hidden` |

### Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | String @id | yes | Stable pointer id (`receipt-pattern-*`, `receipt-tension-*`) — **no cuid default** |
| `userId` | String | yes | Owner |
| `pointerKind` | enum | yes | Source category (pattern/tension/journal) |
| `surface` | enum | yes | Surface type; default `today_evidence_pointer` |
| `sourceObjectType` | `UnderstandingLinkSourceType` | yes | Durable source kind (e.g. `pattern_claim`) |
| `sourceObjectId` | String | yes | Durable source id |
| `sourceEvidenceId` | String? | no | Optional evidence row id (`PatternClaimEvidence`, etc.) |
| `sourceText` | String | yes | Quote shown in aside |
| `sourceOrigin` | String | yes | Provenance label |
| `whyItMatters` | String | yes | **First-class stored surfacing rationale** — no default |
| `whyResurfaced` | String? | no | Re-surfacing rationale when applicable |
| `libraryReceiptId` | String? | no | `/library/receipt-*` continuity |
| `detailHref` | String? | no | Public object href |
| `publicEligible` | Boolean | yes | Default `false`; write path must set explicitly |
| `status` | enum | yes | Lifecycle; default `active` |
| `materializedFrom` | String? | no | Write provenance (e.g. `model_update_publish`) |
| `meta` | Json? | no | Non-critical extras only |
| `surfacedAt` | DateTime | yes | Surfacing timestamp |
| `createdAt` / `updatedAt` | DateTime | yes | Audit |

**Not stored on this table:** `relatedIds`, `contextIds` — durable edges remain on `UnderstandingEvidenceLink`.

---

## Indexes / constraints

| Constraint | Purpose |
|------------|---------|
| `PRIMARY KEY (id)` | Stable pointer id lookup |
| `UNIQUE (userId, sourceObjectType, sourceObjectId)` | One pointer record per source object per user |
| `INDEX (userId, status, surfacedAt)` | Today read ordering/filtering |
| `INDEX (userId, publicEligible, status)` | Eligibility-filtered reads |
| `INDEX (userId, sourceObjectType, sourceObjectId)` | Source → pointer lookup |

**Additive only** — no `DROP`, no `ALTER` on existing tables, no destructive constraints.

---

## Relationship to UEL / durable links

Per write contract #113 and linkage contract #112:

1. **Pointer record** holds surfacing rationale + source identity.
2. **Graph edges** remain on `UnderstandingEvidenceLink`, keyed by `sourceObjectType` + `sourceObjectId` matching the pointer's source (not the pointer id).
3. **`graphSlot`** (`related` | `context`) stored in UEL `meta` via `uelMetaWithGraphSlot()` — no UEL schema change in this branch.
4. **`UnderstandingLinkSourceType`** unchanged — no `surfaced_evidence_pointer` source type added; UEL does not need to reference the pointer row directly.

Traversal (future read branch): query UEL by pointer `sourceObjectType`/`sourceObjectId`, filter `publicEligible`, map `meta.graphSlot` → `relatedIds`/`contextIds`.

---

## What remains unimplemented

| Item | Branch |
|------|--------|
| Materializer / write path | `desktop-live-evidence-depth-write-path-001` |
| UEL link creation at surfacing | write-path branch |
| Read API / snapshot extension | linkage-implementation branch |
| Provider hydration + adapter mapping | linkage-implementation branch |
| UI consumption | gated until real fixture passes depth parity |
| Backfill of existing users | write-path / optional backfill branch |

**Live data passes depth parity:** **NO** (expected). No rows written; no read path; gates unchanged.

---

## Files changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `SurfacedEvidencePointer` model + 3 enums |
| `prisma/migrations/20260708194800_add_surfaced_evidence_pointer/migration.sql` | Additive CREATE TABLE + indexes |
| `lib/__tests__/surfaced-evidence-pointer-schema.test.ts` | Schema + migration SQL contract tests |

---

## Checks / tests run

| Check | Result |
|-------|--------|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| Vitest (6 suites, 51 tests) | PASS |

---

## Migration safety

| Question | Answer |
|----------|--------|
| Additive? | **YES** — new table + enums only |
| Destructive? | **NO** |
| Default data? | **NO** — empty table until write path runs |
| Generic `whyItMatters` default? | **NO** — column required, no default |
| Live gating broadened? | **NO** |
| UI / Today behaviour changed? | **NO** |

---

## Verdict

**PASS** — additive `SurfacedEvidencePointer` storage landed with schema contract tests. Safe to apply migration via `npm run db:migrate` when deploying write-path work.

---

## Recommended next branch

**`desktop-live-evidence-depth-write-path-001`**

Implement `materializeSurfacedEvidencePointersForUser()` at model-update publish / claim promotion; validate via `assessSurfacedEvidencePointerWrite()`; create eligible UEL rows with `meta.graphSlot`.

---

## Commit recommendation

Ready when requested. Suggested message:

```
Add SurfacedEvidencePointer storage for evidence depth write contract.

Additive Prisma migration and schema contract tests; no materializer,
API, adapter, or UI changes.
```

---

*End of receipt.*
