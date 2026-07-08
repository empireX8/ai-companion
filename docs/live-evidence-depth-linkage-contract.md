# Live Evidence Depth Linkage Contract

> **Status:** Contract definition (not implemented)  
> **Baseline:** `9047494`  
> **Authoritative receipts:** DESKTOP-REFERENCE-EVIDENCE-INSPECTOR-TRACE-001 (#109), DESKTOP-LIVE-EVIDENCE-INSPECTOR-DEPTH-PARITY-001 (#110), DESKTOP-LIVE-EVIDENCE-DEPTH-DATA-ENRICHMENT-AUDIT-001 (#111)  
> **Production-ready:** NO

This document defines the backend/store/API contract required for a live Today Evidence Pointer receipt to pass `canUseLiveEvidenceInspectorDepth` and feed the **existing** v0 Inspector path (`select(id)` → `ObjectDetail`) with reference-depth context — without UI changes, fabricated edges, or generic filler.

---

## 1. Problem statement

### Accepted reference behaviour (#109)

Reference Evidence Pointer rows (`r6`, `r5`, `r2` in `lib/orvek-v0/orvek-data.ts`) work because each receipt `OrvekObject` carries:

- `sourceText`, `sourceOrigin`, `date`
- `whyItMatters` (required); `whyResurfaced` (optional, `r5`)
- `relatedIds` and/or `contextIds` pointing at durable objects
- Provider-resolvable linked targets rich enough for `ObjectDetail` sections

### Current live path (#110, #111)

```
fetchTodayReentrySnapshot()
  → buildTodaySurfacingCards()          [lib/today-surface.ts]
  → buildTodayReceiptCards()            [receiptHref only; journals excluded]
  → mapTodayDataToV0Props()             [lib/orvek-adapters/today.ts]
  → V0TodayReceiptRow { id, quote, meta, href }
  → receiptRowToOrvekObject()           [lib/orvek-v0/production/today-api.ts]
  → OrvekObject { type, title, sourceText, sourceOrigin, date }  (+ optional inspector bridge)
```

**Blockers:**

1. No stored surfacing rationale (`whyItMatters` / `whyResurfaced`).
2. Durable object ids exist on `TodaySurfacingCard.detailHref` but are **not exposed** on the receipt contract and **not copied** to `OrvekObject.relatedIds` / `contextIds`.
3. Pattern/contradiction/context targets are **not hydrated** into `OrvekDataApi.getObject` for the Today receipt graph.
4. `receiptHref` (`/library/receipt-pattern-*`) is not a provider object id; `parseSelectableObjectFromHref` returns null for `/library/` paths.

---

## 2. Contract scope

### In scope

- Data fields the backend must expose for Evidence Pointer inspector-depth parity
- API response shape for Today re-entry or a dedicated evidence-depth endpoint
- Adapter mapping rules into `OrvekObject` + provider registration
- Eligibility, graph closure, write-time vs read-time rules
- Acceptance criteria and test plan for a future implementation branch

### Out of scope (this contract)

- Today / Inspector UI changes
- Live Evidence Pointer row consumption
- Global `displayContract: "production"`
- Fabricating `whyItMatters`, `contextIds`, or `relatedIds` at read time
- Reference fixture ids (`ctx-self`, `m-loop-1`, etc.)

---

## 3. Data model / backend fields (Section A)

### 3.1 Core receipt record — `TodayEvidencePointerReceipt`

A **surfaced evidence pointer** is not merely a library receipt row. It is a Today-facing projection of captured evidence **plus** surfacing rationale **plus** explicit durable links.

| Field | Required | Type | Source / storage | Notes |
|-------|----------|------|------------------|-------|
| `id` | yes | `string` | Stable receipt id for Today row + provider | Today currently uses `receipt-${index}-${title}`; contract requires **stable durable id** keyed to source material (see §3.4) |
| `sourceText` | yes | `string` | Quote text shown in aside | Non-generic; not literal `"Receipt"` |
| `sourceOrigin` | yes | `string` | Provenance label | e.g. `"Recent Pattern"`, `"ChatGPT archive"`, `"Explore conversation"` |
| `surfacedAt` | yes | `ISO8601` | Write-time timestamp | Maps to `date` / `lastUpdated` on `OrvekObject` |
| `whyItMatters` | yes | `string` | **Stored at write time** | Non-generic explanation of why this pointer matters **now**; must not duplicate `sourceText` alone |
| `whyResurfaced` | no | `string` | **Stored at write time** when applicable | Equivalent to reference `r5`; only when re-surfacing is intentional |
| `links` | yes (≥1) | `TodayEvidencePointerLink[]` | Stored edges and/or eligible `UnderstandingEvidenceLink` rows | See §3.2 |
| `libraryReceiptId` | no | `string` | Existing `/library/receipt-*` id | Display/continuity only; **not** a `relatedId` |
| `detailHref` | no | `string` | Public object href | Continuity with existing surfaces; not sufficient alone for graph closure |

### 3.2 Link record — `TodayEvidencePointerLink`

Each link is an explicit, eligibility-checked edge from the receipt to a **durable** understanding object.

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `targetId` | yes | `string` | Raw durable id (pattern claim id, contradiction id, etc.) |
| `targetType` | yes | `UnderstandingLinkTargetType` | Prisma enum: `pattern_claim`, `contradiction_node`, `usermap_conclusion`, `investigation`, `fieldwork_assignment`, `model_update`, `surfaced_action` |
| `role` | yes | `UnderstandingLinkRole` | Prisma enum: `supports`, `contradicts`, `context`, `seed`, `outcome`, `correction`, `temporal_anchor`, `derived_from` |
| `graphSlot` | yes | `"related"` \| `"context"` | Maps to `OrvekObject.relatedIds` vs `contextIds` |
| `summary` | no | `string` | Optional link-local rationale from `UnderstandingEvidenceLink.summary` |
| `publicEligible` | yes | `boolean` | Result of `isEvidenceLinkTargetPublicEligible` / equivalent |
| `sourceType` | if from UEL | `UnderstandingLinkSourceType` | e.g. `pattern_claim_evidence`, `evidence_span`, `journal_entry` |
| `sourceId` | if from UEL | `string` | Source row id when edge comes from `UnderstandingEvidenceLink` |

**Relation semantics (recommended mapping to `graphSlot`):**

| `targetType` | Typical `role` | `graphSlot` | Inspector section |
|--------------|----------------|-------------|-----------------|
| `pattern_claim` | `supports` | `related` | Related objects |
| `contradiction_node` | `supports` / `contradicts` | `related` | Related objects |
| `usermap_conclusion` | `supports` / `context` | `related` or `context` | Related / background |
| `investigation` | `context` / `seed` | `related` | Related objects |
| `fieldwork_assignment` | `context` | `related` | Related objects |
| `model_update` | `derived_from` / `temporal_anchor` | `related` | Related objects |
| Mind context (`context_profile` via reference item) | `context` | `context` | Relevant background / context |

Do **not** invent new relation type strings outside `UnderstandingLinkRole` unless a migration adds them.

### 3.3 Linked object payload — `TodayEvidencePointerLinkedObject`

Returned alongside receipts for provider hydration. Must satisfy `isNearEmptyInspectorObject` in `lib/orvek-v0/production/evidence-inspector-depth-parity.ts`.

| Field | Required | Type | Maps to `OrvekObject` |
|-------|----------|------|---------------------|
| `id` | yes | `string` | `id` (provider registration key — see §5) |
| `type` | yes | `OrvekObjectType` | `type` |
| `title` | yes | `string` | `title` |
| `summary` | one of | `string` | `summary` |
| `whyItMatters` | one of | `string` | `whyItMatters` |
| `sourceText` | if receipt-like | `string` | `sourceText` |
| `sourceOrigin` | optional | `string` | `sourceOrigin` |
| `date` / `lastUpdated` | optional | `string` | `date` / `lastUpdated` |
| `supporting` | optional | `string[]` | `supporting` |
| `conflicting` | optional | `string[]` | `conflicting` |
| `receiptIds` | optional | `string[]` | `receiptIds` (nested evidence) |
| `relatedIds` | optional | `string[]` | `relatedIds` (level-2 closure optional) |
| `contextIds` | optional | `string[]` | `contextIds` |
| `inspectorObjectType` | optional | `InspectorSelectableObjectType` | bridge for legacy inspector routes |
| `inspectorObjectId` | optional | `string` | bridge id |

**Near-empty rule:** object must have at least one renderable field per `isNearEmptyInspectorObject` (summary, whyItMatters, sourceText, supporting, etc.).

### 3.4 Stable receipt id strategy

Today generates ephemeral ids (`receipt-0-Evening stress`). Contract requires:

- **Option A (preferred):** `id` = existing public receipt namespace id when surfacing from pattern/tension: `receipt-pattern-{claimId}` or `receipt-tension-{contradictionId}` (matches `buildPublicReceiptHref`).
- **Option B:** `id` = `UnderstandingEvidenceLink` or evidence-span id when surfacing from span-backed pointer.

Ephemeral index-based ids must not be used for depth-safe receipts.

### 3.5 Existing tables — what already exists vs what is missing

| Store | Exists today | Usable for contract? | Gap |
|-------|--------------|----------------------|-----|
| `UnderstandingEvidenceLink` | yes | **Partial** — has `targetType`, `targetId`, `sourceType`, `sourceId`, `role`, `summary`, `quote` | Not queried on Today path; no `graphSlot`; source may not be the Today receipt id |
| `PatternClaim` + `PatternClaimEvidence` | yes | **Partial** — pattern id + evidence quotes | No stored "why surfaced on Today" |
| `ContradictionNode` + evidence | yes | **Partial** | No surfacing rationale field |
| `UserMapConclusion` | yes | For linked targets | No edge from surfacing receipt |
| Mind context / `reference_item` | yes | For `context` targets via map-api | No edge from surfacing receipt |
| Surfacing rationale column | **no** | — | **Must be added** or written into UEL `summary` at surfacing write time with documented semantics |
| Today-specific receipt linkage view | **no** | — | **Must be added** (API projection or materialized surfacing record) |

---

## 4. API contract (Section B)

### 4.1 Recommended endpoint

**Option 1 — extend Today re-entry (preferred for single fetch):**

Add to `TodayReentrySnapshot` (or parallel field):

```ts
evidencePointers: TodayEvidencePointerReceipt[];
linkedObjects: TodayEvidencePointerLinkedObject[];
```

Fetched by extending `fetchTodayReentrySnapshot()` or a dedicated helper called from the same client hook (`useOrvekHybridWorkbenchDataApi`).

**Option 2 — dedicated endpoint:**

`GET /api/today/evidence-pointers`

Response:

```ts
type TodayEvidencePointersResponse = {
  items: TodayEvidencePointerReceipt[];
  linkedObjects: TodayEvidencePointerLinkedObject[];
};
```

### 4.2 Response shape (normative)

```ts
type TodayEvidencePointerReceipt = {
  id: string;
  sourceText: string;
  sourceOrigin: string;
  surfacedAt: string; // ISO8601
  whyItMatters: string;
  whyResurfaced?: string;
  links: TodayEvidencePointerLink[];
  libraryReceiptId?: string;
  detailHref?: string;
};

type TodayEvidencePointerLink = {
  targetId: string;
  targetType: UnderstandingLinkTargetType;
  role: UnderstandingLinkRole;
  graphSlot: "related" | "context";
  summary?: string;
  publicEligible: boolean;
};

type TodayEvidencePointerLinkedObject = {
  id: string;
  type: OrvekObject["type"];
  title: string;
  summary?: string;
  whyItMatters?: string;
  sourceText?: string;
  sourceOrigin?: string;
  date?: string;
  lastUpdated?: string;
  supporting?: string[];
  conflicting?: string[];
  receiptIds?: string[];
  relatedIds?: string[];
  contextIds?: string[];
  inspectorObjectType?: InspectorSelectableObjectType;
  inspectorObjectId?: string;
};
```

### 4.3 Query rules

1. Return only pointers that pass **source-safe** checks (`hasInspectableEvidencePointerContent`).
2. Include `linkedObjects` for every `link` where `publicEligible === true`.
3. Omit ineligible links entirely (do not return `publicEligible: false` links to clients).
4. Do not return pointers with zero eligible links.
5. `whyItMatters` must pass non-generic validation (see §7).
6. Reuse existing public projection helpers where possible:
   - `projectVisiblePatternClaim` / `GET /api/inspector/pattern-claims/[id]`
   - `GET /api/inspector/contradictions/[id]`
   - `map-api` mind context projection for `context_profile`
   - `public-intelligence-safe-slice` for conclusions

### 4.4 UnderstandingEvidenceLink traversal (when used)

**Source anchoring for Today pattern/tension pointers:**

| Surfacing kind | `sourceType` | `sourceId` | `targetType` (outbound links) |
|----------------|--------------|------------|-------------------------------|
| Recent Pattern | `pattern_claim` | `{claimId}` | `usermap_conclusion`, `investigation`, `model_update`, … |
| Active Tension | `contradiction_node` | `{contradictionId}` | same |

Traversal:

1. `GET /api/understanding/evidence-links?sourceType={}&sourceId={}` with public eligibility filter.
2. Map eligible targets to `TodayEvidencePointerLink[]`.
3. Assign `graphSlot`: `context` role → `context`; others default `related` unless product rule says otherwise.
4. Hydrate targets into `linkedObjects` via inspector/map projection APIs.

**Inbound links** (evidence_span → pattern) are **not** sufficient alone; the receipt must still carry stored `whyItMatters` for the pointer itself.

---

## 5. Adapter mapping (Section C)

Future implementation in `lib/orvek-adapters/today.ts` and `lib/orvek-v0/production/today-api.ts` only **after** API returns contract shape.

### 5.1 `TodayEvidencePointerReceipt` → `V0TodayReceiptRow` (interim)

| Contract field | `V0TodayReceiptRow` field |
|----------------|---------------------------|
| `id` | `id` |
| `sourceText` | `quote` |
| `sourceOrigin` + `surfacedAt` | `meta` → `"{sourceOrigin} · {relative date}"` |
| `detailHref` or `libraryReceiptId` href | `href` (prefer `detailHref` for inspector bridge when parseable) |

### 5.2 `TodayEvidencePointerReceipt` → `OrvekObject` (depth-safe)

| Contract field | `OrvekObject` field |
|----------------|---------------------|
| `id` | `id` |
| — | `type: "receipt"` |
| `sourceText` | `title` (human sentence) and `sourceText` |
| `sourceOrigin` | `sourceOrigin` |
| `surfacedAt` | `date`, `lastUpdated` |
| `whyItMatters` | `whyItMatters` |
| `whyResurfaced` | `whyResurfaced` |
| `links` where `graphSlot === "context"` | `contextIds[]` (target ids) |
| `links` where `graphSlot === "related"` | `relatedIds[]` (target ids) |

### 5.3 `TodayEvidencePointerLinkedObject` → provider registration

In `buildTodayProductionDataApi` (or dedicated `registerEvidencePointerGraph`):

```ts
for (const linked of linkedObjects) {
  objects[linked.id] = mapLinkedObjectToOrvekObject(linked);
}
for (const pointer of evidencePointers) {
  objects[pointer.id] = mapReceiptToOrvekObject(pointer);
}
```

**Id alignment:** `contextIds` / `relatedIds` on the receipt must use the **same id strings** registered in `objects`.

**Inspector bridge:** set `inspectorObjectType` / `inspectorObjectId` on receipt only when a real stored bridge exists; do not infer from `receiptHref` alone.

---

## 6. Provider hydration (Section D)

### 6.1 Registration requirements

For every `TodayEvidencePointerReceipt` in the Today graph:

1. Register the receipt `OrvekObject` in `buildTodayProductionDataApi` objects map.
2. Register **every** linked object referenced by eligible links in the **same** objects map (or ensure hybrid merge from map/patterns APIs uses **identical ids**).
3. `hybrid-workbench-api` `getObject(id)` must resolve:
   - receipt id → receipt object
   - each `relatedIds` / `contextIds` entry → linked object

### 6.2 Minimum richness per target type

| `targetType` | Minimum fields for non-near-empty |
|--------------|-----------------------------------|
| `pattern_claim` | `summary` or `whyItMatters` (from `PatternClaimView.summary`) |
| `contradiction_node` | `summary` (title + sides composite) or `whyItMatters` |
| `usermap_conclusion` | `summary` + `whyItMatters` (from map detail projection) |
| `investigation` | `summary` or `whyItMatters` (organizing question) |
| `fieldwork_assignment` | `summary` (prompt + reason) |
| `model_update` | `summary` (`userFacingSummary`) |
| mind context (`context`) | `summary` + `whyItMatters` (per `map-api` railItemToOrvekObject) |

### 6.3 Graph closure depth

**Level 1 (required):** receipt → linked targets resolve and render.

**Level 2 (recommended, not blocking v1):** linked targets may carry their own `relatedIds` / `contextIds` if already stored; nested clicks must not open near-empty views.

Reference `r6` opens `m-loop-1` which itself has receipts and related ids — level 2 is reference-quality but **level 1 + stored whyItMatters** is the minimum gate per #110.

### 6.4 Provider id conventions

Align with existing production APIs:

| Durable type | Recommended provider `id` | Notes |
|--------------|---------------------------|-------|
| `pattern_claim` | raw `{claimId}` | Match `/patterns/{id}` and inspector API |
| `contradiction_node` | raw `{contradictionId}` | Match `/contradictions/{id}` |
| `usermap_conclusion` | `conclusion-{id}` or raw id | Match `map-api` registration |
| mind context | `context-{referenceItemId}` | Match `map-api` |
| `investigation` | raw `{investigationId}` | Match active-questions presentation |
| `model_update` | raw `{modelUpdateId}` | Already in today-api for movements |

Contract implementation must **pick one convention per type** and use it consistently in `relatedIds` / `contextIds` and `getObject`.

---

## 7. Eligibility / privacy (Section E)

1. **User ownership:** all rows scoped by `userId` from auth (existing pattern).
2. **Public eligibility:** apply `filterEvidenceLinksByPublicTargetEligibility` / `isEvidenceLinkTargetPublicEligible` before emitting links.
3. **Guarded target types:** `usermap_conclusion`, `investigation`, `fieldwork_assignment`, `model_update` require visibility checks (existing in `understanding-evidence-link-public-eligibility.ts`).
4. **No raw private evidence in summaries:** linked object `summary` / `whyItMatters` must use public projection helpers; no message dumps, no internal ids as copy.
5. **No link without hydration:** if target cannot be loaded with non-near-empty projection, omit link (do not emit id).
6. **No generic rationale:** reject pointers where `whyItMatters` matches denylist:
   - `"Surfaced from your recent material."`
   - `"Receipt"`
   - pattern card boilerplate: `/^\d+ evidence receipts in recent material\.?$/`
   - `"Early signal from recent material."`
7. **No fabricated edges:** `detailHref` alone does not create a link; an explicit `links[]` entry + hydrated target required.

---

## 8. Write-time vs read-time (Section F)

| Field | Write-time (stored) | Read-time (deterministic) | LLM at read (forbidden) |
|-------|---------------------|---------------------------|-------------------------|
| `sourceText` | yes (evidence quote) | format only | no |
| `sourceOrigin` | yes | format only | no |
| `surfacedAt` | yes | relative date label | no |
| `whyItMatters` | **yes — required** | **never synthesize** | **no** — if missing at surfacing, pointer is not depth-safe |
| `whyResurfaced` | yes when applicable | never synthesize | no |
| `links[].targetId/type` | yes (stored edge or UEL) | traverse UEL with eligibility | no |
| Linked object `summary` | yes (on target row) | project via existing inspector/map APIs | no |
| `meta` string on Today row | — | `kind · date` from stored fields | no |

### 8.1 Where `whyItMatters` must be written

At least one of:

1. **New surfacing metadata** on the write path that creates/refreshes Today Evidence Pointers (recommended): e.g. `SurfacedEvidencePointer.whyItMatters` populated when pattern/tension/journal is promoted to Today aside.
2. **`UnderstandingEvidenceLink.summary`** on a link whose semantics are documented as surfacing rationale **for the pointer** (only if summary is non-generic and stable).
3. **Model update / surfacing job output** persisted at publish time (same rules as #1).

**Not acceptable:** copying `sourceText`, pattern `summary`, generic card `body`, or hero filler.

### 8.2 Do receipt → object edges exist today?

| Edge | Exists? |
|------|---------|
| Pattern claim ← evidence quotes | yes (`PatternClaimEvidence`) |
| UEL pattern_claim → conclusion/etc. | yes (if created) |
| Today receipt row → pattern claim id | **implicit in `detailHref` only; not stored on receipt object** |
| Today surfacing rationale | **no** |

**Migration implication:** backend must begin **storing or projecting** explicit `TodayEvidencePointerReceipt` records (or extend surfacing cards) before adapter enrichment can succeed.

---

## 9. Acceptance criteria (Section G)

A future implementation is contract-complete when **all** hold:

1. At least one **real** dev/staging fixture returns `TodayEvidencePointersResponse` where the receipt passes `canUseLiveEvidenceInspectorDepth(api, receipt.id)`.
2. `assessLiveTodayObjectGraphParity(api).evidencePointerInspectorDepthReady === true` for that fixture (all-or-nothing list gate).
3. Every `relatedIds` / `contextIds` on the receipt resolves via `api.getObject` to a non-near-empty object.
4. `whyItMatters` is non-generic per §7 denylist.
5. No reference fixture ids; no fabricated `ctx-self`-style context.
6. `/dev/orvek-v0-reference` unchanged; Today Evidence Pointer UI still reference until Kay approves UI slice.
7. `receiptHref` alone does not satisfy depth parity.

---

## 10. Test plan (Section H) — future `desktop-live-evidence-depth-linkage-implementation-001`

| Test | Expectation |
|------|-------------|
| Fixture with stored `whyItMatters` + hydrated `pattern_claim` link | `canUseLiveEvidenceInspectorDepth` → true |
| Missing `whyItMatters` | depth blockers include `missing_why_it_matters` |
| Link to unhydrated target id | `unresolved_linked_ids` |
| Ineligible target (fails public check) | link omitted; pointer blocked if zero eligible links |
| Near-empty hydrated target (title only) | `near_empty_linked_objects` |
| Generic `whyItMatters` ("Surfaced from your recent material.") | custom validation fails; depth blocked |
| `receiptHref` only, no `links[]` | depth blocked |
| Provider registration | `api.getObject(relatedId)` returns rich object after `buildTodayProductionDataApi` |
| Today UI source guard | `today.tsx` does not import depth gate for row consumption (until UI slice) |
| Reference `r6`/`r5`/`r2` | still pass (regression) |

---

## 11. Future implementation branches

| Order | Branch | When |
|-------|--------|------|
| 1 | `desktop-live-evidence-depth-write-contract-001` | **Recommended next** — add stored surfacing rationale + explicit linkage at write time (DB migration or UEL write rules + surfacing job) |
| 2 | `desktop-live-evidence-depth-linkage-implementation-001` | After write contract — API projection + adapter mapping + provider hydration (no UI) |
| 3 | `desktop-live-today-evidence-pointer-ui-depth-gated-001` | Only after a real fixture passes `canUseLiveEvidenceInspectorDepthList` |

If write contract discovers existing UEL + inspector hydration is sufficient without migration, branch 1 may shrink to a surfacing write-path patch only.

---

## 12. Migration / backfill

1. **No backfill of generic text** — pointers without stored rationale remain blocked.
2. **Pattern/tension pointers:** backfill `whyItMatters` only where a non-generic source exists (e.g. archived model-update summary, UEL `summary` with manual review).
3. **Links:** backfill `links[]` from `detailHref` + existing UEL traversal where eligibility passes; skip if target cannot hydrate.
4. **Journal pointers:** require product decision to set `receiptHref` and full contract fields before inclusion in aside.

---

*End of contract.*
