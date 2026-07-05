# 02 Map Data Contract Failure Audit

## Context

- Branch: `desktop-map-production-data-parity-bridge-001`
- Base: staging after #85 merge
- A prior Map production parity bridge attempt (hybrid overlay + EvidencePanel provider lookup) failed product-owner visual review and was **not merged**.
- Today hybrid bridge remains landed and visually passed.
- Current runtime on branch: **Today-only hybrid**; Map still on `createMockOrvekDataApi()` reference baseline.

## Root cause of the failed Map bridge

The bridge treated **“production Map data exists”** as sufficient to replace the reference Map object graph. The merge gate (`mapHasContent && !mapLoadError`) only checked **presence**, not **presentation readiness** for the reference Map contract.

That allowed raw `UserMapConclusion` rows, mixed ontology rails, and unvalidated movement fields to flow into `MapPage` and (with provider lookup) into `EvidencePanel`, while the UI still assumes **curated reference-shaped** `OrvekObject` fields.

Contributing failure modes:

| Failure observed | Mechanism |
|------------------|-----------|
| Map shape drifted from accepted reference | Hybrid injected `mapCategories` from production ontology, replacing hardcoded reference `CATEGORIES` in `map.tsx` when `mapCategories.length > 0`. Real conclusions populate different rails/counts; production uses rail id `model_updates` vs reference `updates`; reference **uncertainty** rail duplicates items across categories — production does not. |
| Raw / long text in cards | `summary` from DB is passed through unchanged as `summary` + `recommendation` in `railItemToOrvekObject` / `buildDetailOrvekObject` (`map-api.ts`). Reference zip uses short model-readable strings + separate `whyItMatters` / `supporting` arrays. |
| Before/After same or meaningless | See dedicated section below. |
| Inspector became a content dump | Production `OrvekObject` carries full `summary`, duplicated `recommendation`, raw evidence link labels in `supporting`, and invalid movement fields. `EvidencePanel` renders these blocks verbatim (`ObjectDetail`). Provider lookup correctly resolved ids but exposed **unsafe field content**. |
| Category counts changed | `buildHeaderStats` + per-rail ontology assignment replace reference header stats (`243` / `7`) and reference rail counts with live DB-derived counts. |
| Unstable flash / refresh “fixed it” | Hook returned full mock baseline while Today/Map fetches ran, then swapped to production Map overlay when fetches completed — visible layout/content flip. Errors or partial fetch during transition could surface runtime issues before settling back to mock on failure/empty paths. |

**Primary root cause:** adapter + merge pipeline optimizes for **data availability**, not **reference Map presentation contract**.

---

## 1. Production Map data shape (fetch/adapt pipeline)

### Fetch inputs

| Input | Source |
|-------|--------|
| Conclusions list | `fetchYourMapConclusions()` → `GET /api/user-map/conclusions` |
| Conclusion detail | `fetchInspectorUserMapDetail(id)` → `GET /api/user-map/conclusions/[id]` |
| Evidence links | `fetchInspectorEvidenceLinks(...)` → conclusion evidence endpoint |
| Mind context | `fetchMindContextSnapshot()` + `buildMindContextDisplayItems(snapshot, 3)` |
| Movement preview | `fetchMapMovementPreview()` → today intelligence updates (limit 3) |
| Open questions preview | `fetchMapOpenQuestionsPreview()` → active questions (limit 4) |

### API list/detail record (public projection)

From `UserMapConclusionPublicApiListItem` / `DetailItem` (`public-intelligence-safe-slice.ts`):

- `id`, `title`, `summary` (raw DB string, no display normalization)
- `area`, `status`, `confidenceLevel`, `evidenceCount`, `updatedAt`
- Detail adds: `sourceDiversity`, `timeSpreadDays`, `createdAt`

**Not exposed** on public detail: `supersedesId`, `supersededById`, prior conclusion text, curated before-read.

### Adapter output (`mapMapDataToV0Props` → `buildMapProductionDataApi`)

- **Ontology rails:** 8 keys in `V0_MAP_ONTOLOGY_RAIL_ORDER` with prefixed object ids (`conclusion-*`, `goal-*`, `context-*`, `question-*`, `movement-*`)
- **OrvekObject graph:** per-rail objects + detail object with `summary`, `recommendation`, `supporting`, `conflicting`, `before`, `after`, `relatedIds`, `inspectorObjectType`
- **Map API fields:** `mapCategories`, `mapSelectedId`, `mapHeader`, loading/error flags, `emptyCopyBySlot`
- **Sets `displayContract: production`** on standalone `buildMapProductionDataApi` (hybrid attempt stripped this globally but still merged map fields)

---

## 2. Fields display-ready for reference Map

Reference Map expects **short, model-readable, slot-separated** content (see `orvek-data.ts` map objects):

| Field | Reference expectation | Production readiness |
|-------|---------------------|-------------------|
| `title` | Short claim/question title | **Partial** — usually OK if DB title is clean |
| `summary` / `recommendation` | One concise “current understanding” sentence | **Mostly unsafe** — often long import/conversation text |
| `whyItMatters` | Short causal line | **Unsafe for conclusions** — often missing; mind-context uses category label |
| `supporting` | Short bullet summaries | **Unsafe** — raw `evidenceSummaryLabel` strings + path lines |
| `conflicting` | Short bullets | **Partial** — generic status line for disputed only |
| `confidence` | Short label | **Partial** — formatted enum label OK |
| `lastUpdated` | Human-relative copy in reference | **Partial** — production uses formatted ISO datetime |
| `before` / `after` | Distinct prior vs current read | **Unsafe** — see below |
| Rail structure / counts | Curated reference `CATEGORIES` | **Unsafe** — production ontology differs |

---

## 3. Fields raw, duplicated, missing, stale, or unsafe

| Field / behaviour | Issue |
|-------------------|-------|
| `summary` | Passthrough from DB; no max length, no model-readable rewrite |
| `recommendation` | Duplicates `summary` in `map-api.ts` |
| `whyItMatters` | Absent on conclusion rails; detail uses `YOUR_MAP_EVIDENCE_BREADTH_INTRO` fallback in Map slots |
| `supporting` | Evidence link labels; may include long or technical text; goals/context append `Linked path: …` |
| `before` (rail) | Placeholder `"Previously held understanding"` for `recentlyMoved` without real prior read |
| `before` / `after` (detail) | Often duplicate — both sourced from same `summary` field |
| `relatedIds` | Heuristic area/status matching — not evidence-backed graph |
| `mapHeader` | Real counts replace reference mock stats — changes perceived model density |
| `mapCategories` | Production ontology + empty rails with `—` vs reference always-populated mock rails |
| Mind context rows | Memory `title` is raw statement (quality gate exists server-side but still longer than reference cards) |
| Movement preview rows | `userFacingSummary` may be long; weak inspector typing |
| Open question rows | No inspector object id; title-only |

**Stale / import-derived data:** Conclusions come from `userMapConclusion` rows (candidate publish / user-visible lifecycle). Summaries reflect whatever was stored at publish time — often conversation/import phrasing, not re-authored for Map cards. **Re-import alone does not fix** before/after without lifecycle linkage in the public projection.

---

## 4. Why before/after duplicated

Two separate bugs:

### A. Detail slot uses the same source twice

`mapDetailSlot()` in `lib/orvek-adapters/map.ts`:

```typescript
beforeSummary: selectedListItem?.summary ?? null,
afterSummary: detail.summary,
```

List and detail both read **`UserMapConclusion.summary`**. When unchanged between list and detail fetch, Before and After render identical text in `MapPage` (“How this moved”) and in Inspector movement blocks.

### B. Rail movement placeholder is not real movement

`railItemToOrvekObject()` sets:

```typescript
before: item.recentlyMoved ? "Previously held understanding" : undefined,
```

for emerging/superseded/disputed items — generic copy, not a prior model read. Map renders Before/After UI whenever `obj.before || obj.after` is truthy.

### C. Missing supersession chain in public API

Schema supports `supersedesId` / `supersededById`, but public detail projection does **not** fetch or surface the superseded conclusion’s text as `beforeSummary`. Adapter cannot produce valid movement without API/extension work.

---

## 5. Adapter/function responsible for before/after

| Layer | Function | Role |
|-------|----------|------|
| Adapter | `mapDetailSlot()` | Sets `beforeSummary` / `afterSummary` on `V0MapDetailSlot` |
| Production API | `buildDetailOrvekObject()` | Maps to `OrvekObject.before` / `.after` |
| Production API | `railItemToOrvekObject()` | Sets placeholder `before` on recently moved rail items |
| UI | `MapPage` | Renders “How this moved” when `obj.before \|\| obj.after` |
| UI | `EvidencePanel` | Renders `BeforeAfter` from same fields |

---

## 6. Production object types safe to show now

**None are fully safe** for reference Map card replacement without normalization.

Lowest-risk (still need caps/guards):

- **Formatted header stats** (`confidenceLabel`, receipt count, open question count) — if shown without changing reference header layout contract
- **Rail titles only** (truncated) — still risky if body slots fill with raw summary

---

## 7. Production object types that must stay reference/mock until fixed

| Type | Reason |
|------|--------|
| **Conclusions** (`conclusion-*`) | Raw summary, bad before/after, missing `whyItMatters` |
| **Superseded / emerging / disputed** | Invalid movement semantics |
| **Model goals** (`goal-*`) | Long summary + path noise in supporting |
| **Mind context** (`context-*`) | Raw memory/pattern statements in title/summary |
| **Open questions** (`question-*`) | Incomplete inspector contract |
| **Movement preview** (`movement-*`) | Preview-only; placeholder before text |
| **Full ontology rail replacement** | Structure/count parity broken vs reference |

---

## 8. Stale imported / conversation-derived data?

**Yes.** Public list/detail returns stored `title` + `summary` from `userMapConclusion` without Map-specific rewriting. Data reflects publish/import/candidate pipeline output, not reference Map curation. Movement preview pulls from intelligence updates; mind context from memories/patterns APIs.

---

## 9. Re-import vs adapter normalization

| Approach | Verdict |
|----------|---------|
| **Re-import / rebuild alone** | Insufficient — before/after needs supersession chain fields, not just fresher summaries |
| **Adapter normalization alone** | Necessary minimum: truncate summaries, suppress duplicate before/after, omit movement UI when invalid, strip path noise, require `whyItMatters`-class slot or fallback copy |
| **API extension** | Required for true superseded Before/After (fetch prior conclusion via `supersedesId`) |
| **Combined** | **Adapter normalization + readiness gate first**; targeted API enrichment for movement second; re-import only if source rows are factually wrong |

---

## 10. Safety gate (recommended)

Do **not** merge production Map overlay unless **`isMapPresentationReady(mapApi)`** passes:

1. **Global:** no `mapLoadError`; not loading; at least one object passes per-object checks
2. **Per object (conclusions):**
   - `summary` length ≤ reference budget (e.g. 180–220 chars) after normalization OR use honest empty-slot copy
   - `before` and `after` both absent OR strictly unequal after normalize
   - Never show “How this moved” if `before === after` (normalized compare)
   - `whyItMatters` present OR use `emptyCopyBySlot.mapWhyEmpty` — do not dump raw summary twice
3. **Movement:** `before` must not be placeholder-only string unless `after` is distinct substantive text
4. **Rails:** optional mode — require reference-parity rail **labels** but allow empty rails; block merge if ontology would replace reference shape on hybrid root until PO accepts production counts
5. **Inspector:** same object must pass readiness before provider lookup exposes it

On failure: **keep reference mock Map** (`createMockOrvekDataApi` categories + zip objects) — never partial production replacement.

---

## 11. Recommended next minimal implementation

**Answer: C + B (not D, not A alone)**

| Option | Verdict |
|--------|---------|
| **A. EvidencePanel provider lookup only** | **Reject alone** — fixes id resolution but worsens inspector dump with current production fields |
| **B. Map data safety/readiness gate only** | **Required** — blocks bad merge; does not fix underlying shape |
| **C. Production Map adapter normalization** | **Primary next slice** — truncate/slot summaries, suppress invalid before/after, clean supporting lines, movement validation |
| **D. Full Map bridge later** | **Defer** until C+B pass tests + PO visual on normalized fixtures |

**Minimal sequence:**

1. **C** — Normalize in `map.ts` / `map-api.ts` (presentation layer only; no MapPage layout changes)
2. **B** — Add `isMapPresentationReady()` gate to hybrid merge (when implemented)
3. Tests with real-shaped fixtures (long summary, duplicate before/after, placeholder before)
4. **Then** A (EvidencePanel provider lookup) + guarded hybrid merge (**D**)

---

## Tests required before another visual bridge attempt

- Adapter: summary length cap / normalization
- Adapter: suppress before/after when equal or placeholder-only
- Adapter: superseded movement requires distinct before/after or omits block
- `isMapPresentationReady`: blocks merge on unsafe fixture; allows clean fixture
- Hybrid: unsafe production → reference mock Map unchanged
- Hybrid: Today overlay unaffected when Map gate fails
- MapPage: reference `CATEGORIES` remain when gate fails
- EvidencePanel: provider lookup resolves production id **only** when object passes readiness fixture
- Regression: `map-production-api.test.ts` updated for normalization (not raw passthrough)
- Shell quarantine unchanged

---

## Current production Map display-ready?

**No.** Data is structurally available but **not presentation-safe** for reference Map parity. The failed bridge proved that availability gates are insufficient.

---

## Files inspected

- `lib/orvek-adapters/map.ts`
- `lib/orvek-v0/production/map-api.ts`
- `lib/orvek-v0/production/hybrid-workbench-api.ts`
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`
- `components/orvek-v0/pages/map.tsx`
- `components/orvek-v0/evidence-panel.tsx`
- `lib/public-intelligence-safe-slice.ts`
- `app/api/user-map/conclusions/route.ts`
- `app/api/user-map/conclusions/[id]/route.ts`
- `lib/orvek-v0/orvek-data.ts` (reference baseline)
- `lib/mind-context-surface.ts`
- `lib/your-map-preview-surface.ts`
- `docs/agent-runs/receipts/DESKTOP-MAP-PRODUCTION-DATA-PARITY-BRIDGE-001/00-map-bridge-audit.md`
