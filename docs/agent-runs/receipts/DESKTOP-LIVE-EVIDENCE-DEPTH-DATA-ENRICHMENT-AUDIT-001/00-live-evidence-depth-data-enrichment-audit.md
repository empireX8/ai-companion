# Desktop Live Evidence Depth Data Enrichment Audit 001

**Branch:** `desktop-live-evidence-depth-data-enrichment-audit-001`  
**Baseline:** `5b04aa2` (staging — PR #110 live evidence inspector depth parity gate)  
**Authoritative receipts consulted:** #109 reference evidence inspector trace, #110 live evidence inspector depth parity, #105 evidence pointer parity, #107 adapter honesty, #108 readiness audit  
**UI changed:** NO  
**Product code changed:** NO  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Why this audit exists

PR #110 proved the inspector-depth gate works: reference `r6`/`r5`/`r2` pass; current live `receiptRowToOrvekObject` output fails with `missing_why_it_matters` and `no_context_or_related_ids`. Before any UI consumption or adapter enrichment, this audit asks: **can real stored/live data truthfully supply those fields today**, without fabrication?

---

## Exact live data sources inspected

### Today re-entry fetch path (`lib/today-reentry.ts`)

`fetchTodayReentrySnapshot()` parallel-fetches:

| Endpoint | Produces |
|----------|----------|
| `GET /api/journal/entries?limit=1` | Latest journal entry |
| `GET /api/contradiction?top=3&mode=read_only` | Top contradictions |
| `GET /api/patterns` | Pattern claims (grouped sections) |
| `GET /api/today/intelligence-updates` | Model updates (`TodayIntelligenceUpdateItem`) |
| `GET /api/user-map/conclusions` | Map conclusions list |
| `GET /api/watch-for` | Fieldwork items |
| `GET /api/active-questions` | Investigations |
| `GET /api/actions` | Surfaced actions |
| `GET /api/timeline/model-layers?window=7d` | Timeline movements |

Then `buildTodaySurfacingCards({ journalEntries, contradictions, patterns })` in `lib/today-surface.ts` builds `TodaySurfacingCard[]`. **No `includeUnderstandingLinks=true` flag is used** on patterns or other endpoints.

### Evidence Pointer row derivation

1. `buildTodayReceiptCards(snapshot)` (`lib/today-reentry.ts:504`) — **only cards with `receiptHref` set**
2. `mapTodayDataToV0Props()` (`lib/orvek-adapters/today.ts:340`) — maps to `V0TodayReceiptRow`
3. `receiptRowToOrvekObject()` (`lib/orvek-v0/production/today-api.ts:101`) — maps to `OrvekObject`
4. `todayResurfacedIds` = receipt row ids from step 2

### Richer APIs **not** on the Today receipt path (inspected, exist elsewhere)

| Route | Richness |
|-------|----------|
| `GET /api/inspector/pattern-claims/[id]` | Full `PatternClaimView`: summary, receipts, evidence counts, action |
| `GET /api/inspector/contradictions/[id]` | Title, sideA, sideB, status, evidenceCount |
| `GET /api/evidence/[id]` | Evidence span content, session origin, profile artifacts; optional `relatedUnderstanding` |
| `GET /api/understanding/evidence-links` | `UnderstandingEvidenceLink` rows (target/source type+id, role, summary, quote) |
| `GET /api/what-changed/[id]/evidence` | Public evidence continuity for model updates |
| `GET /api/user-map/conclusions/[id]/evidence` | Public evidence continuity for conclusions |
| Library `fetchReceiptDetail()` (`lib/library-surface.ts`) | Receipt quotes + `linkedHref` back to `/patterns/{id}` or `/contradictions/{id}` |

None of these are called during Today snapshot → receipt object construction.

### Hybrid object graph (`lib/orvek-v0/production/hybrid-workbench-api.ts`)

Merge order: base mock zip → today parity-safe receipts → map → timeline → decisions → …  
`getObject(id)` resolves today overlay first, then map overlay, etc. **Pattern claims from `/api/patterns` top surfacing are not registered as `OrvekObject` entries** in `today-api`, `map-api`, or a dedicated patterns production API. `decisions-api` may register a thin `linkedClaimId` alias only when an action references the same claim id.

---

## Exact raw live receipt shape (before `receiptRowToOrvekObject`)

### `TodaySurfacingCard` (`lib/today-surface.ts:46`)

```ts
{
  kind: "Recent Journal" | "Active Tension" | "Recent Pattern";
  title: string;
  body: string;
  meta: string;
  detailHref: string | null;
  receiptHref: string | null;
}
```

**No** `whyItMatters`, `whyResurfaced`, `relatedIds`, `contextIds`, or durable object id fields.

### Which cards become Evidence Pointer rows?

| Card kind | `receiptHref` | In Evidence Pointer aside? |
|-----------|---------------|----------------------------|
| Recent Journal | `null` | **NO** — filtered out |
| Active Tension | `/library/receipt-tension-{contradictionId}` | YES (if contradiction exists) |
| Recent Pattern | `/library/receipt-pattern-{patternClaimId}` | YES (if pattern exists) |

### `V0TodayReceiptRow` (`lib/orvek-adapters/today.ts:340`, types at `lib/orvek-adapters/types.ts:94`)

```ts
{
  id: `receipt-${index}-${card.title}`,
  quote: card.body?.trim() || card.title?.trim() || "Receipt",
  meta: `${card.kind} · ${card.meta}`,
  href: card.receiptHref ?? card.detailHref ?? "#",
}
```

### `receiptRowToOrvekObject` output (`lib/orvek-v0/production/today-api.ts:111`)

```ts
{
  id, type: "receipt", title, sourceText, sourceOrigin, date, lastUpdated,
  // optional: inspectorObjectType, inspectorObjectId  (only if parseSelectableObjectFromHref(href) succeeds)
}
```

`parseSelectableObjectFromHref` (`lib/inspector-selection.ts`) recognizes `/patterns/`, `/contradictions/`, `/your-map/`, etc. **It returns `null` for `/library/receipt-pattern-*` and `/library/receipt-tension-*`** (`lib/__tests__/inspector-selection.test.ts`). Because `href` prefers `receiptHref` over `detailHref`, live rows typically **do not** get an inspector bridge from href.

---

## Fields available for `whyItMatters`

| Candidate source | Path | Truthful as `whyItMatters`? | Verdict |
|------------------|------|----------------------------|---------|
| Stored `whyResurfaced` / surfacing rationale | — | — | **Does not exist** in live types or DB models on surfacing path (only reference fixtures `orvek-data.ts`) |
| `TodaySurfacingCard.body` (pattern) | `today-surface.ts:179` | NO | Generic: `"{N} evidence receipts in recent material."` or `"Early signal from recent material."` |
| `TodaySurfacingCard.body` (tension) | `today-surface.ts:107` | NO | Tension side-A/side-B preview — describes the tension, not why this receipt matters in Today |
| `TodaySurfacingCard.title` | pattern `claim.summary`, tension `title` | NO | Duplicates or paraphrases `sourceText`/quote; not a separate rationale field |
| Hero `whyItMatters` for surfacing cards | `today-reentry.ts:199` | NO | Hardcoded generic: `"Surfaced from your recent material."` — on hero, not receipt object; must not be used |
| `PatternClaim.summary` | `/api/patterns`, inspector API | Partial | Truthful pattern read, but **not** a stored "why this evidence pointer resurfaced" rationale; would duplicate title/quote semantics |
| `UnderstandingEvidenceLink.summary` | `prisma` `UnderstandingEvidenceLink.summary` | Potentially | Stored link rationale — **not fetched** on Today path |
| `ModelUpdate.userFacingSummary` | intelligence updates | NO | Applies to movement objects, not receipt rows |
| LLM-generated surfacing copy | — | — | **No stored/generated surfacing rationale field** exists today; would require new backend generation + persistence |

**Conclusion:** No truthful, non-generic `whyItMatters` field is available on the current Today Evidence Pointer receipt pipeline without new stored data or unacceptable generic filler.

---

## Fields available for `relatedIds` / `contextIds`

| Candidate source | Path | Resolves in provider graph? | Rich enough? | Usable? |
|------------------|------|----------------------------|--------------|---------|
| `detailHref` → `/patterns/{id}` | `today-surface.ts:184` | **NO** — raw pattern id not registered in `today-api` or `map-api` object maps | Inspector API has rich `PatternClaimView` but **not hydrated into `OrvekDataApi`** | Link exists in card data but **not graph-closed** |
| `detailHref` → `/contradictions/{id}` | `today-surface.ts:159` | **NO** — same | Inspector API has title+sides (rich if mapped to `summary`) | Same blocker |
| `receiptHref` → `/library/receipt-pattern-{id}` | `public-continuity-registry.ts` | Library detail only; **not** `getObject` target | N/A | Not a `relatedId`; library receipt is not an `OrvekObject` node |
| `UnderstandingEvidenceLink` (pattern → conclusion, etc.) | `/api/understanding/evidence-links` | Eligible targets resolvable **if** hydrated | Depends on target type | **Not fetched** for Today; no deterministic receipt→link mapping without new contract |
| `relatedUnderstanding` on patterns API | `?includeUnderstandingLinks=true` | Would need hydration | Rich targets possible | **Not requested** by Today fetch |
| Mind context items | `map-api` → `context-{id}` | YES in map merge | Rich (`summary`, `whyItMatters`, `supporting`) | **No stored link** from surfacing receipt to mind context id |
| User map conclusions | `map-api` → `conclusion-{id}` | YES in map merge | Rich when detail loaded | **No stored link** from receipt to conclusion on Today path |
| Decisions `linkedClaimId` alias | `decisions-api` `buildLinkedClaimAliasObject` | YES if same id + action in snapshot | Thin: `summary`/`sourceText` only, title `"Linked pattern"` | Coincidental overlap only; not receipt-derived |

**`contextIds`:** Reference uses durable context objects (`ctx-self`, `ctx-constraints`). Live mind-context objects exist (`context-{referenceItemId}` in `map-api`) but **no truthful edge** from Today surfacing receipts to those ids exists in current data. Deriving `contextIds` would require fabrication or new `UnderstandingEvidenceLink` / surfacing metadata.

**`relatedIds`:** The durable object id is knowable from `detailHref` (pattern claim id or contradiction id), but:
1. Today adapter does not copy it onto the receipt object.
2. Even if copied, hybrid `getObject(patternClaimId)` typically returns **undefined** — graph not hydrated.
3. Using `receiptHref` alone does not yield a resolvable `OrvekObject` id.

---

## Target object resolution path (as implemented today)

```
Today row click → select(receiptRowId)
  → getObject(receiptRowId)  [hybrid: today parity-safe receipt map]
  → ObjectDetail(receipt)    [only sourceText + corrections render]
```

Nested links would require `receipt.relatedIds` / `receipt.contextIds` → `getObjects(ids)` → rich targets. **This path is empty for live receipts.**

Inspector-rich data exists at fetch time for library (`fetchReceiptDetail` → `linkedHref`) and inspector APIs, but **none of it is merged into the workbench `OrvekDataApi` graph** used by `EvidencePanel` / `ObjectDetail`.

---

## Required field table

| Required field | Source exists? | Source path/field | Truthful? | Blocker |
|----------------|----------------|-------------------|-----------|---------|
| `type: "receipt"` | YES | `receiptRowToOrvekObject` | YES | — |
| Human `title` | YES | `V0TodayReceiptRow.quote` or card.title | YES | — |
| `sourceText` | YES | `row.quote` | YES | — |
| `sourceOrigin` + `date` | YES | parsed from `row.meta` | YES | — |
| `whyItMatters` | **NO** (non-generic) | — | — | No stored surfacing rationale; only generic card.body or hero filler |
| `whyResurfaced` (optional) | **NO** | — | — | Not in live schema or surfacing pipeline |
| `relatedIds` (≥1) | **Partial** | `TodaySurfacingCard.detailHref` encodes pattern/contradiction id | ID known, **edge not stored on object** | Not copied to receipt; target not in provider graph |
| `contextIds` (optional) | **NO** on receipt path | Mind context exists in map-api | Context objects rich if linked | No truthful receipt→context edge |
| Graph closure (targets resolve) | **NO** | hybrid `getObject` | — | Pattern/contradiction ids not registered in merged graph for Today |
| Target richness | **Partial** | Inspector APIs / library detail | Rich data exists server-side | Not hydrated into `OrvekObject` for provider lookup |

---

## Candidate link source table

| Candidate link source | Resolves via `getObject` today? | Target object type | Target richness (if hydrated) | Usable as context/related? |
|-----------------------|--------------------------------|--------------------|------------------------------|---------------------------|
| `detailHref` `/patterns/{id}` | NO | `pattern_claim` / `map-object` | Rich via inspector API (summary, receipts, evidence) | **Would be** `relatedIds` if graph hydrated — not today |
| `detailHref` `/contradictions/{id}` | NO | `contradiction_node` / `map-object` | Rich (title, sides, evidence count) | Same |
| `receiptHref` `/library/receipt-pattern-{id}` | NO | N/A (library page) | Library has quotes + linkedHref | Not a provider object id |
| Mind context `context-{id}` | YES (map merge) | `context` | Rich (`summary`, `whyItMatters`, `supporting`) | **Blocked** — no stored link from receipt |
| Map conclusion `conclusion-{id}` | YES (map merge) | `map-object` / `usermap_conclusion` | Rich when detail loaded | **Blocked** — no stored link from receipt |
| `UnderstandingEvidenceLink` | Only if hydrated | various | Varies | **Blocked** — not on Today fetch path |
| Decisions `linkedClaimId` | Sometimes | thin receipt alias | `summary` only — borderline | Coincidental, not receipt-derived |

---

## Can current live data pass depth parity without fabrication?

**NO.**

Verified by existing test `lib/__tests__/evidence-inspector-depth-parity.test.ts` — `buildTodayProductionDataApi` with a real surfacing card pattern fixture is source-safe but fails depth parity (`missing_why_it_matters`, `no_context_or_related_ids`).

Truthful mapping only (no invented `whyItMatters`, no fake `ctx-self`, no `relatedIds` without graph closure) cannot produce an inspector-depth-safe Evidence Pointer object from current Today data.

---

## Conclusion: **B — blocked; backend/data contract missing**

Current live data **cannot** be truthfully enriched to pass `canUseLiveEvidenceInspectorDepth` in the existing adapter layer alone. The gap is not mapping cleverness — it is **missing stored surfacing linkage and rationale contract**.

### Exact missing backend/data contract

A future **desktop-live-evidence-depth-linkage-contract-001** (or equivalent) must define and persist:

1. **Surfacing rationale field** — stored, user-visible explanation for why an evidence pointer appears on Today (equivalent to reference `whyItMatters` / optional `whyResurfaced`). Must not be generic filler (`"Surfaced from your material"`, evidence-count boilerplate). Likely sources: `UnderstandingEvidenceLink.summary`, dedicated surfacing metadata, or deterministic non-generic derivation rule documented at write time.

2. **Explicit durable object linkage** — at least one truthful `relatedId` (pattern claim, contradiction, conclusion, investigation, etc.) **stored or derivable without guesswork** from the same record that powers the Evidence Pointer row (not merely `detailHref` sitting on a parallel card field uncopied to the receipt object).

3. **Provider graph hydration contract** — when a receipt carries `relatedIds`/`contextIds`, the hybrid/workbench `OrvekDataApi` must register target objects with fields sufficient to pass `isNearEmptyInspectorObject` (e.g. pattern claim → `summary` + `whyItMatters` or equivalent; contradiction → `summary`/sides; context → `summary`). This likely requires a **patterns/contradictions production object registration** slice or inspector-fetch-on-merge — not just copying ids.

4. **Optional: understanding-link traversal rules** — if `relatedIds`/`contextIds` come from `UnderstandingEvidenceLink`, document eligible source types (e.g. `pattern_claim` → `usermap_conclusion`), public-eligibility filters, and that Today fetch must request links.

5. **Journal evidence pointers** — if journals should appear in the aside, `receiptHref` must be set (today `null`); separate contract decision.

### What is NOT sufficient

- Mapping `card.body` → `whyItMatters` (generic for patterns)
- Mapping hero generic copy → receipt
- Setting `relatedIds` from `detailHref` without hydrating targets into `getObject`
- Using reference fixture ids (`ctx-self`, `m-loop-1`, etc.)
- Treating `receiptHref` as `relatedId`
- LLM-on-read generation without stored rationale (violates evidence-gate honesty)

### Why `desktop-live-evidence-depth-data-enrichment-001` is NOT recommended next

Implementation branch `desktop-live-evidence-depth-data-enrichment-001` would only be safe **after** the linkage contract exists and at least one truthful end-to-end fixture can pass depth parity. Implementing enrichment now would pressure fabrication or thin Inspector links.

---

## Privacy / security note

Today already surfaces pattern summaries and tension previews from the same APIs. Adding `relatedIds`/`contextIds` in the workbench Inspector does not inherently expose new private evidence **if** the same public-eligibility rules used by `/api/understanding/evidence-links` and inspector routes are applied. Investigations/fieldwork links need the existing eligibility gates — not a blocker for the contract, but required in design.

---

## Deterministic vs LLM

| Field | Deterministic today? | LLM needed? |
|-------|---------------------|-------------|
| `sourceText`, provenance | YES | NO |
| `whyItMatters` | NO stored rationale | New stored field or generation pipeline required |
| `relatedIds` from `detailHref` | ID extractable | NO for id — YES for graph richness unless inspector hydration added |
| `contextIds` | NO edge on receipt path | NO unless understanding links exposed |

---

## Checks run

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS (receipt only)
- Vitest (optional): `evidence-inspector-depth-parity` (12), `today-evidence-pointer-parity` (6), `today-object-graph-parity` (7), `today-adapter-honesty` (8) — **33 passed**

## Changed files

- `docs/agent-runs/receipts/DESKTOP-LIVE-EVIDENCE-DEPTH-DATA-ENRICHMENT-AUDIT-001/00-live-evidence-depth-data-enrichment-audit.md` (this receipt only)

---

## Recommended next branch

**`desktop-live-evidence-depth-linkage-contract-001`** — backend/data contract only:

- Define surfacing rationale storage (field + write path + non-generic validation)
- Define receipt → durable object linkage (which object types, which stored edges)
- Define provider hydration requirements for linked targets
- Prove one real fixture can pass `canUseLiveEvidenceInspectorDepth` after contract (test/fixture only)

Do **not** proceed to `desktop-live-evidence-depth-data-enrichment-001` or Evidence Pointer UI consumption until that contract lands.

---

**UI changed:** NO  
**Product code changed:** NO  
**Production-ready:** NO
