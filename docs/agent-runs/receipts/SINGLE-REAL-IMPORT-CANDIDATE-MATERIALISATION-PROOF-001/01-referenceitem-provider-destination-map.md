# 01 — ReferenceItem provider destination map

## Question

Which accepted `ReferenceItem` types are actually consumed by current canonical Orvek providers — not merely “active in the database”?

## Schema types

`ReferenceType`: `constraint` · `pattern` · `goal` · `preference` · `assumption` · `hypothesis` · `rule` · `source`

Import extraction creates governed types only: `goal` | `preference` | `constraint`.

## Accept mutation truth (`lib/import-candidate-review-actions.ts`)

For `ReferenceItem` accept (`materialiseAcceptedReference`):

| Effect | Happens? |
|--------|----------|
| Same row `status: candidate → active` | **Yes** |
| New `ReferenceItem` row | **No** |
| `ModelUpdate` create | **No** — gap `MODEL_UPDATE_TARGET_UNSUPPORTED` |
| `UnderstandingEvidenceLink` create | **No** — gap `UEL_TARGET_UNSUPPORTED` |
| Lineage retained | Existing `sourceSessionId` / `sourceMessageId` FKs only |

## Providers that read `status=active`

| Provider / query | Type filter | Canonical UI destination |
|------------------|-------------|--------------------------|
| `GET /api/reference/list?status=active` → `fetchMindContextSnapshot` (`lib/mind-context-surface.ts`) → `buildMindContextDisplayItems(..., 3)` in `OrvekMapPage` / `useOrvekHybridWorkbenchDataApi` → Map adapters (`lib/orvek-adapters/map.ts`, `lib/orvek-v0/production/map-api.ts`) | None (quality gate on statement) | **Map → Background / Context rail** (`kind: mind_context`); **Inspector** when that rail item is selected (`context_profile` embedded fields) |
| `app/api/actions/route.ts` | `type: "goal"` only | Decisions build-forward actions — **not** Map Model Goals |
| `lib/reference-memory.ts` | excludes `source` | Chat prompt injection (not Orvek workbench) |
| `app/(root)/(routes)/context/page.tsx` | quality gate | Legacy `/context` page |

## Not consumers of accepted ReferenceItems

| Surface | Proof |
|---------|-------|
| **Today** | No ReferenceItem / `/api/reference` usage in Today adapters/APIs |
| **Timeline** | No ReferenceItem query; accept creates no `ModelUpdate`, so no Timeline movement |
| **Map Model Goals rail** | UserMap conclusions (`developmental_vector` / `current_frontier` / `meaning_system`), not ReferenceItem |
| **Map Patterns rail** | `PatternClaim` / UserMap — not ReferenceItem.type=`pattern` |

## Filters that can hide an accepted item

1. **Quality gate** — `isQualityMindContextStatement` (length ≥ 20, ≥ 4 words, special-char density, no error/shell text).
2. **Map top-N** — `buildMindContextDisplayItems(snapshot, 3)` merges quality memories + active PatternClaims, sorts by `updatedAt`, keeps 3. Accept bumps `updatedAt`, so a newly accepted item should enter the top 3 even when PatternClaims already occupy the rail.
3. **Decisions** — only `goal` + `active`.

## Destination verdict for this campaign

For a governed import `ReferenceItem` (`goal` | `preference` | `constraint`) that passes the quality gate:

- **Exact provider:** mind-context snapshot via `/api/reference/list?status=active` → Map hybrid workbench mind-context injection
- **Exact visible surface:** Orvek **Map → Background / Context** rail; Inspector detail when selected
- **Not expected:** Today, Timeline, Map Goals/Patterns rails, new ModelUpdate/UEL rows

This campaign’s shortlist uses **preference** types → Map Context (+ Inspector), **not** Decisions.
