# Desktop Live Evidence Inspector Depth Parity 001

**Branch:** `desktop-live-evidence-inspector-depth-parity-001`  
**Baseline:** `9279b18` (staging — PR #109 reference evidence inspector trace)  
**Authoritative data contract:** `docs/agent-runs/receipts/DESKTOP-REFERENCE-EVIDENCE-INSPECTOR-TRACE-001/00-reference-evidence-inspector-trace.md` (consulted; all depth requirements below derive from it)  
**UI changed:** NO  
**Product code changed:** YES (parity helper module + hidden parity metadata + tests)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Why the click path was not changed

PR #109 proved the accepted reference path — Today Evidence Pointer row → `select(id)` → `selectedId` + `inspectorTab: "evidence"` → `ObjectDetail` in `components/orvek-v0/evidence-panel.tsx` — was never the gap. The aborted UI-consumption branch used an equivalent click path and still failed runtime review because the **live object shape** fed a near-empty Inspector. This slice therefore touches no UI file: `components/orvek-v0/pages/today.tsx`, `components/orvek-v0/evidence-panel.tsx`, the workbench shell, the store, and `/dev/orvek-v0-reference` are all unchanged (guarded by test).

---

## What was added

### New module: `lib/orvek-v0/production/evidence-inspector-depth-parity.ts`

Exported helpers:

| Helper | Purpose |
|--------|---------|
| `assessEvidenceInspectorDepth(object, getObject)` | Full assessment: `{ objectId, inspectorDepthSafe, blockers[], resolvedContextIds, resolvedRelatedIds, unresolvedLinkedIds, nearEmptyLinkedIds }` |
| `hasReferenceDepthEvidenceShape(object, getObject)` | Boolean form of the above |
| `canUseLiveEvidenceInspectorDepth(api, objectId)` | Provider-level single-id gate |
| `canUseLiveEvidenceInspectorDepthList(api, ids)` | All-or-nothing list gate (≥1 row, every row depth-safe) — the gate future Today UI consumption must use |
| `filterInspectorDepthSafeEvidencePointerIds(api, ids)` | Depth-safe subset of ids |
| `resolveEvidenceInspectorDepthTarget(api, objectId)` | `LiveEvidenceInspectorDepthTarget { objectId, inspectorTab: "evidence", sourceText, provenanceLabel, whyItMatters, contextIds, relatedIds }` or `null` |
| `isNearEmptyInspectorObject(object)` | Graph-closure shell-object detector |
| `hasMeaningfulEvidenceTitle`, `hasMeaningfulWhyItMatters` | Field-level checks |

Blocker enum (`EvidenceInspectorDepthBlocker`): `missing_object`, `not_receipt_type`, `generic_title`, `generic_source_text`, `missing_provenance`, `missing_why_it_matters`, `no_context_or_related_ids`, `unresolved_linked_ids`, `near_empty_linked_objects`.

### Hidden metadata in `lib/orvek-v0/production/today-object-graph-parity.ts`

`LiveTodayGraphParity` gained two fields (populated by `assessLiveTodayObjectGraphParity`, flowing through the existing `todayObjectGraphParity` provider field — no UI reads them):

- `evidencePointerInspectorDepthReady: boolean`
- `inspectorDepthSafeEvidencePointerIds: string[]`

The depth helpers are also re-exported from `today-object-graph-parity.ts` alongside the existing parity exports. **No existing gate was loosened**: `canUseLiveTodayEvidencePointer`, `resolveLiveEvidencePointerTarget`, `hasInspectableEvidencePointerContent`, and the hybrid merge path are byte-identical. `buildParitySafeTodayObjectMap` still merges source-safe receipts into the hybrid graph (receipt integrity), which is unchanged behaviour and does not mark them UI-ready.

---

## Exact depth-parity requirements (the gate)

A live evidence object is inspector-depth-safe only if **all** hold:

1. `type === "receipt"` (the reference receipt object type).
2. Meaningful non-generic `title` (non-blank, not literal `"Receipt"`).
3. Meaningful non-generic `sourceText` (existing source-safe rule reused).
4. Provenance per existing rules: `date`/`lastUpdated` or non-generic `sourceOrigin` (reused `hasEvidencePointerProvenance`).
5. Non-empty `whyItMatters` — drives the reference "Why it matters" section.
6. At least one entry in `contextIds` or `relatedIds` — drives "Relevant background / context" / "Related objects".
7. **Graph closure:** every declared `contextIds`/`relatedIds` entry resolves through the provider `getObject`.
8. No resolved target is **near-empty**: beyond id/title/type it must carry at least one field `ObjectDetail` renders as a section (`summary`, `whyItMatters`, `whyResurfaced`, receipt `sourceText`, `recommendation`, `projection`, `reportSummary`, `before`/`after`, `supporting`, `conflicting`, `whatWouldChange`, `options`, `decisionContext`, `hypotheses`, `missingEvidence`, `receiptIds`). A shell target = dead nested link = blocked.
9. No fabricated ids/edges: the helper only reads fields the object truthfully declares; resolved id lists are always subsets of declared lists (tested).
10. If live data cannot truthfully supply links, the result is blocked (`null` target / `false` gate), never enriched.

Exact reference IDs (`ctx-self`, `ctx-values`, …) are **not** required — only the shape/behaviour class: resolvable ids pointing at render-rich objects. `whyResurfaced` is treated as optional (only `r5` has it in reference).

## Source-safe vs inspector-depth-safe

| Level | Module | Requirements | Sufficient for |
|-------|--------|--------------|----------------|
| **source-safe** | `today-evidence-pointer-parity.ts` (unchanged) | receipt type + non-generic sourceText + provenance | hybrid graph merge, receipt integrity, `evidencePointerListReady` |
| **inspector-depth-safe** | `evidence-inspector-depth-parity.ts` (new) | source-safe + meaningful title + `whyItMatters` + ≥1 resolvable non-near-empty context/related target | any future Today Evidence Pointer UI consumption (`evidencePointerInspectorDepthReady`) |

Depth-safe is strictly narrower; a test asserts a mixed list is source-safe-ready but not depth-ready.

---

## Do current live objects pass? **NO.**

`receiptRowToOrvekObject` in `lib/orvek-v0/production/today-api.ts` builds live receipts with only `id`, `type`, `title`, `sourceText`, `sourceOrigin`, `date`, `lastUpdated` (+ optional inspector bridge ids). No `whyItMatters`, no `contextIds`, no `relatedIds` exist anywhere in the live Today snapshot mapping. Verified by test: a real `buildTodayProductionDataApi` receipt is source-safe (`canUseLiveTodayEvidencePointer === true`) but fails depth parity with blockers `missing_why_it_matters` + `no_context_or_related_ids`, and the graph parity reports `evidencePointerInspectorDepthReady: false`, `inspectorDepthSafeEvidencePointerIds: []`.

Reference `r6`/`r5`/`r2` pass the gate cleanly (blockers `[]`), which validates the gate against the accepted fixture contract.

---

## What fails and why (summary)

| Case | Result | Blocker(s) |
|------|--------|-----------|
| Reference `r6`/`r5`/`r2` | PASS | — |
| `r6` with `whyItMatters` removed | FAIL | `missing_why_it_matters` |
| Unresolvable `contextIds`/`relatedIds` | FAIL | `unresolved_linked_ids` |
| Receipt with only sourceText/origin/date (current live shape) | FAIL | `missing_why_it_matters`, `no_context_or_related_ids` |
| Generic `"Receipt"` title/sourceText/origin | FAIL | `generic_title`, `generic_source_text`, `missing_provenance` |
| Linked target = shell object (id/title/type only) | FAIL | `near_empty_linked_objects` |
| Live-shaped receipt with truthful `whyItMatters` + rich resolvable targets | PASS | — |

---

## Tests

New: `lib/__tests__/evidence-inspector-depth-parity.test.ts` (12 tests) covering all required cases, including: no fabricated ids (resolved ⊆ declared; linkless object blocked, not enriched), depth metadata strictly narrower than source-safe, current production adapter receipts blocked, Today/evidence-panel sources do not import the depth gate, reference route mock-only, reference click path (`select(r.id)`, `REFERENCE_RESURFACED = ["r6", "r5", "r2"]`) unchanged.

No existing tests needed modification (the new `LiveTodayGraphParity` fields are additive; no test asserted exact object shape).

**Checks run (all PASS):**

- `npx tsc --noEmit`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `git diff --check`
- Vitest — 150 tests, 10 files: `today-evidence-pointer-parity` (6), `today-adapter-honesty` (8), `today-production-api` (7), `today-object-graph-parity` (7), `evidence-panel-provider-lookup` (9), `inspector-surface-wiring` (13), `desktop-hard-swap-regression-sweep` (10), `evidence-inspector-depth-parity` (12), `today-surface` (14), `hybrid-workbench-api` (64)

## Changed files

- `lib/orvek-v0/production/evidence-inspector-depth-parity.ts` (new)
- `lib/orvek-v0/production/today-object-graph-parity.ts` (additive: imports, 2 hidden parity fields, re-exports, doc comments on source-safe vs depth-safe)
- `lib/__tests__/evidence-inspector-depth-parity.test.ts` (new)
- this receipt

Hero / See why / report CTA / delta log paths: untouched. Hybrid root overlay behaviour: untouched. No global `displayContract: "production"`.

---

## Remaining risks / uncertainties

1. "Near-empty" is defined conservatively from the current `OrvekObject` schema; if new renderable fields are added to `ObjectDetail`, the detector should be extended in step.
2. The gate validates one level of graph closure (receipt → linked targets). Reference targets' own links (e.g. `m-loop-1.relatedIds`) resolve in the zip fixture, but live second-level closure is untested — acceptable because a rich first-level target already renders a meaningful Inspector view, and deeper levels can be tightened later if runtime shows thin second clicks.
3. Whether live data can ever truthfully supply `whyItMatters`/`contextIds`/`relatedIds` is a backend/data question this slice cannot answer.

## Recommended next branch

**Not UI consumption.** No current live object passes the depth gate, so `desktop-live-today-evidence-pointer-ui-depth-gated-001` would ship an always-reference UI at best and pressure toward fabricated links at worst.

Recommend: **`desktop-live-evidence-depth-data-enrichment-audit-001`** — audit only:

- What real stored data (patterns, tensions, journal context, surfacing rationale) could truthfully populate `whyItMatters`, `contextIds`, `relatedIds` on live receipts?
- Can `receiptHref`/`detailHref` parsing plus intelligence updates supply resolvable, non-near-empty related targets without inventing edges?
- Output: exact live-data-to-depth-field mapping, or a documented conclusion that the Evidence Pointer aside must stay reference until backend surfacing exposes rationale/link data.

UI consumption remains deferred until at least one truthful live object passes `canUseLiveEvidenceInspectorDepthList`.

---

**UI changed:** NO  
**Product code changed:** YES  
**Production-ready:** NO
