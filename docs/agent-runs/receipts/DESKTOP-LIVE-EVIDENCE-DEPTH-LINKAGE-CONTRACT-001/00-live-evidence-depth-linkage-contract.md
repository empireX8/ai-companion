# Desktop Live Evidence Depth Linkage Contract 001

**Branch:** `desktop-live-evidence-depth-linkage-contract-001`  
**Baseline:** `9047494` (staging — PR #111 live evidence depth data enrichment audit)  
**Authoritative receipts consulted:** #109 reference evidence inspector trace, #110 inspector depth parity, #111 enrichment audit, #108 readiness audit  
**Durable contract:** [`docs/live-evidence-depth-linkage-contract.md`](../../../live-evidence-depth-linkage-contract.md)  
**UI changed:** NO  
**Product code changed:** NO (documentation only)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Blocker this contract solves

PR #111 concluded **conclusion B**: live Evidence Pointer receipts cannot pass `canUseLiveEvidenceInspectorDepth` because the backend exposes only `V0TodayReceiptRow { id, quote, meta, href }` with no stored surfacing rationale, no explicit durable linkage on the receipt object, and no provider hydration of pattern/contradiction/context targets. This contract defines **exactly what must be stored, returned, mapped, and hydrated** before any adapter enrichment or UI consumption.

---

## Existing path summary (unchanged)

```
Today Evidence Pointer row → select(id) → ObjectDetail  [reference UI — do not change]
```

Live pipeline today:

`fetchTodayReentrySnapshot` → `buildTodaySurfacingCards` → `buildTodayReceiptCards` (receiptHref only) → `mapTodayDataToV0Props` → `receiptRowToOrvekObject` → thin `OrvekObject`.

Depth gate (`lib/orvek-v0/production/evidence-inspector-depth-parity.ts`) requires receipt `type`, meaningful title/sourceText/provenance, **stored `whyItMatters`**, **≥1 `contextIds` or `relatedIds`**, and graph closure to non-near-empty targets.

---

## Contract conclusion (summary)

### A. Backend / store fields

Defined in durable doc §3:

- **`TodayEvidencePointerReceipt`**: stable `id`, `sourceText`, `sourceOrigin`, `surfacedAt`, **stored `whyItMatters`**, optional `whyResurfaced`, `links[]`, optional `libraryReceiptId` / `detailHref`.
- **`TodayEvidencePointerLink`**: `targetId`, `targetType` (`UnderstandingLinkTargetType`), `role` (`UnderstandingLinkRole`), `graphSlot` (`related` | `context`), `publicEligible`, optional UEL `sourceType`/`sourceId`.
- **`TodayEvidencePointerLinkedObject`**: hydrated target payloads for provider registration.

**Missing today:** stored surfacing rationale; explicit receipt linkage on API; stable receipt ids (current index-based ids are ephemeral).

### B. API response

`GET /api/today/evidence-pointers` or extension of `TodayReentrySnapshot`:

```ts
{ items: TodayEvidencePointerReceipt[]; linkedObjects: TodayEvidencePointerLinkedObject[] }
```

UEL traversal rules documented for `sourceType=pattern_claim|contradiction_node` with public eligibility filters.

### C. Adapter mapping (future only)

- Contract fields → `OrvekObject.whyItMatters`, `whyResurfaced`, `contextIds`, `relatedIds`, `sourceText`, `sourceOrigin`, `date`.
- `href` should prefer parseable `detailHref` over `/library/receipt-*` for inspector bridge.
- Register `linkedObjects` in `buildTodayProductionDataApi` objects map with **id-aligned** `relatedIds`/`contextIds`.

### D. Provider hydration

Every eligible link target must resolve via `getObject` and pass `isNearEmptyInspectorObject`. Id conventions per type documented (raw pattern/contradiction ids; `context-{id}` for mind context; etc.).

### E. Eligibility / privacy

Reuse `understanding-evidence-link-public-eligibility.ts`; omit ineligible links; denylist generic `whyItMatters` strings; no fabrication from `detailHref` or `receiptHref` alone.

### F. Write-time vs read-time

| Must be stored at write time | Never synthesize at read |
|------------------------------|--------------------------|
| `whyItMatters` | generic hero/card copy |
| `whyResurfaced` (when used) | pattern evidence-count boilerplate |
| explicit `links[]` or UEL edges | LLM-generated rationale |

Existing `UnderstandingEvidenceLink` can supply edges and optional `summary`, but **does not replace** stored pointer rationale.

### G. Acceptance criteria

At least one real fixture passes `canUseLiveEvidenceInspectorDepthList`; all linked targets resolve and are non-near-empty; reference route unchanged; UI consumption remains blocked until gate passes on real data.

### H. Future test plan

Listed in durable doc §10 — fixture pass/fail cases for rationale, hydration, eligibility, near-empty, generic text, receiptHref-only.

---

## Recommended next implementation branch

**`desktop-live-evidence-depth-write-contract-001`** (recommended first)

New stored surfacing rationale + explicit durable linkage at write time (migration or documented UEL write semantics + surfacing job). Without write-time `whyItMatters` and stored edges, `desktop-live-evidence-depth-linkage-implementation-001` cannot succeed truthfully.

Then:

2. `desktop-live-evidence-depth-linkage-implementation-001` — API + adapter + provider hydration (no UI)  
3. `desktop-live-today-evidence-pointer-ui-depth-gated-001` — only after real fixture passes depth list gate

---

## Changed files

- `docs/live-evidence-depth-linkage-contract.md` (durable contract)
- `docs/agent-runs/receipts/DESKTOP-LIVE-EVIDENCE-DEPTH-LINKAGE-CONTRACT-001/00-live-evidence-depth-linkage-contract.md` (this receipt)

---

## Checks run

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- Vitest: `evidence-inspector-depth-parity` (12), `today-evidence-pointer-parity` (6), `today-object-graph-parity` (7), `today-adapter-honesty` (8) — **33 passed**

---

**UI changed:** NO  
**Product code changed:** NO  
**Production-ready:** NO
