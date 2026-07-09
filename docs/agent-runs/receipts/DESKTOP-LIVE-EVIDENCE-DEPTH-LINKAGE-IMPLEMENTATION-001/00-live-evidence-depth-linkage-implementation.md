# Desktop Live Evidence Depth Linkage Implementation 001

**Branch:** `desktop-live-evidence-depth-linkage-implementation-001`  
**Baseline:** `4ba5818` (staging — PR #115 SurfacedEvidencePointer materialization/write path)  
**Authoritative receipts consulted:** #112 linkage contract, #113 write contract, #114 storage migration, #115 write path  
**UI changed:** NO  
**Product code changed:** YES (read/linkage helper + API route + tests)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Implement the read/linkage layer that projects stored `SurfacedEvidencePointer` rows + UEL `graphSlot` edges into depth-safe `OrvekObject` graphs — without Today UI consumption, without adding pointer ids to Today resurfaced rows, and without loosening depth gates.

---

## Read/linkage helper added

**Module:** `lib/live-evidence-depth-linkage.ts`

| Export | Purpose |
|--------|---------|
| `readSurfacedEvidencePointersForUser(userId, deps)` | List active/publicEligible pointers → traverse UEL → hydrate → build graph |
| `buildDepthSafeSurfacedEvidencePointerGraph(...)` | Core graph builder with rejection reasons |
| `assessSurfacedEvidencePointerReadiness(...)` | Per-pointer validation + `assessEvidenceInspectorDepth` |
| `resolveSurfacedEvidencePointerLinks(...)` | UEL traversal + public eligibility + `meta.graphSlot` |
| `projectSurfacedEvidencePointerToOrvekObject(...)` | `SurfacedEvidencePointer` → receipt `OrvekObject` |
| `mergeSurfacedEvidenceDepthObjects(baseApi, graph)` | Provider `getObject` registration only — does not touch `todayResurfacedIds` |
| `createSurfacedEvidenceDepthLinkageDeps(db)` | Prisma-backed default deps (list pointers, UEL, eligibility, hydrate) |

**Dependency injection:** All DB/eligibility/hydration via `deps` — tests use mocks without live DB.

---

## API route

**Added:** `GET /api/today/evidence-pointers` (`app/api/today/evidence-pointers/route.ts`)

- Auth: Clerk `auth()` (same convention as `app/api/today/intelligence-updates/route.ts`)
- Returns: `{ pointerObjects, linkedObjects, depthSafePointerIds, rejectedPointers, inspectorDepthListReady }`
- **Not consumed by Today UI** — read-only endpoint for stored depth graph

---

## Provider / hybrid hydration

**Added:** `mergeSurfacedEvidenceDepthObjects` in linkage module (standalone helper).

**Deferred:** No changes to `hybrid-workbench-api.ts` or `data-provider.tsx` — depth objects merge only when caller passes graph explicitly. Tests prove `getObject` resolves depth-safe pointer + linked ids without altering `todayResurfacedIds`.

---

## SurfacedEvidencePointer → OrvekObject mapping

| Pointer field | OrvekObject field |
|---------------|-------------------|
| `id` | `id` |
| — | `type: "receipt"` |
| `sourceText` (title derived) | `title` (first sentence, non-generic) |
| `sourceText` | `sourceText` |
| `sourceOrigin` | `sourceOrigin` |
| `surfacedAt` | `date`, `lastUpdated` |
| `whyItMatters` | `whyItMatters` |
| `whyResurfaced` | `whyResurfaced` (optional) |
| UEL `graphSlot=related` targets | `relatedIds` |
| UEL `graphSlot=context` targets | `contextIds` |
| `detailHref` | `detailHref` (continuity only — insufficient alone) |

**Forbidden:** generic filler, fake ids, invented links, LLM rationale on read.

---

## UEL graphSlot traversal / filtering

1. Query UEL by `sourceObjectType` + `sourceObjectId` matching pointer source.
2. Require `meta.graphSlot` via `graphSlotFromUelMeta` — links without graphSlot excluded.
3. Filter targets with `isEvidenceLinkTargetPublicEligible`.
4. Hydrate each eligible target; exclude unhydrated/near-empty (`isNearEmptyInspectorObject`).
5. Map surviving targets to `relatedIds` / `contextIds` by graphSlot.
6. Final gate: `assessEvidenceInspectorDepth` / `canUseLiveEvidenceInspectorDepthList`.

---

## Target hydration rules

Default DB hydrator (`hydrateLinkedTargetFromDb`) maps:

| `targetType` | Minimum fields |
|--------------|----------------|
| `usermap_conclusion` | `title`, `summary`, `whyItMatters` |
| `pattern_claim` | `summary` as title/summary/whyItMatters |
| `contradiction_node` | `title`, `sideA`/`sideB` as supporting |
| `investigation` | `title`, `organizingQuestion` |
| `model_update` | `userFacingSummary` (user_visible + meaningful) |
| `fieldwork_assignment` | `prompt`, `reason` |

Unauthorized/private rows → `null` (link excluded). Near-empty hydration → pointer rejected.

---

## Stored fixture depth parity

**YES — in tests only.** Fixture `receipt-pattern-claim-1` with related + context targets passes `canUseLiveEvidenceInspectorDepthList` after `mergeSurfacedEvidenceDepthObjects`.

**Live production data:** **NO** — write path not wired; no user rows materialized yet. Today thin receipts still fail depth parity (unchanged).

---

## Today UI unchanged

- `components/orvek-v0/pages/today.tsx` — **not modified**
- `todayResurfacedIds` — **unchanged** by linkage merge helper
- No pointer ids added to Today aside/resurfaced rows
- Reference route remains mock-only (`createMockOrvekDataApi` test)

---

## What remains unimplemented

| Item | Branch |
|------|--------|
| Wire materializer at publish/surfacing | Optional follow-up or write-path hook |
| Hybrid auto-merge of depth graph in workbench shell | Could use `mergeSurfacedEvidenceDepthObjects` when stored rows exist |
| Today UI consumption of depth-safe pointers | `desktop-live-today-evidence-pointer-ui-depth-gated-001` |
| Production backfill of stored pointers | Separate branch |

---

## Files changed

| File | Change |
|------|--------|
| `lib/live-evidence-depth-linkage.ts` | Read/linkage service + provider merge + DB deps |
| `lib/__tests__/live-evidence-depth-linkage.test.ts` | 16 linkage tests |
| `app/api/today/evidence-pointers/route.ts` | Authenticated read API |

---

## Checks / tests run

| Check | Result |
|-------|--------|
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| Vitest (8 suites, 82 tests) | PASS |

---

## Verdict

**PASS** — read/linkage layer lands with UEL graphSlot traversal, eligibility filtering, target hydration, depth-safe OrvekObject projection, provider merge helper, and authenticated read API. Today UI and depth gates unchanged; test fixture passes `canUseLiveEvidenceInspectorDepthList`.

---

## Recommended next branch

**`desktop-live-today-evidence-pointer-ui-depth-gated-001`**

Consume depth-safe stored pointers in Today only when `inspectorDepthListReady` is true for real user data — still gated, no generic enrichment of thin live rows.

---

## Commit recommendation

```
Implement stored evidence pointer read/linkage and depth-safe projection.

Adds linkage service, GET /api/today/evidence-pointers, and provider merge
helper without Today UI consumption or depth gate loosening.
```

---

*End of receipt.*
