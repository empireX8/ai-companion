# Desktop Reference Evidence Inspector Trace 001

**Branch:** `desktop-reference-evidence-inspector-trace-001`  
**Baseline:** `18bb948` (staging — PR #108 live Today readiness audit; verified clean tree at trace time)  
**Mode:** Trace / receipt only  
**Product code changed:** NO  
**UI changed:** NO  
**Production-ready:** NO

---

## Why this trace was needed

The aborted branch `desktop-live-today-evidence-pointer-ui-consumption-001` passed all automated checks but failed runtime review. It treated the Evidence Pointer contract as:

> live receipt row → `select(id, "evidence")` → Inspector shows a quote

Runtime comparison against the reference showed the accepted behaviour is an **object-level evidence context**: source text plus why-it-matters, why-resurfaced, relevant background/context rows, related-object rows, and correction controls — all clickable into further Inspector contexts. The live receipt objects built by `receiptRowToOrvekObject` (`lib/orvek-v0/production/today-api.ts`) carry none of the graph fields, so the live Inspector view was drastically thinner than reference even though the tab and click path were "correct".

**Aborted branch lesson:** the click path was never the problem — the **data contract** was. Parity gates checked `sourceText` + provenance but not graph depth (`whyItMatters`, `relatedIds`, `contextIds`, …).

---

## Exact reference route / data path

| Step | File | Fact |
|------|------|------|
| Route | `app/dev/orvek-v0-reference/page.tsx` | Renders `<Workbench />` inside `data-testid="orvek-v0-reference-route"`; no props |
| Shell | `components/orvek-v0/workbench.tsx` | `Workbench()` → `dataApi ?? createMockOrvekDataApi()`; wraps `WorkbenchProvider` → `OrvekDataProvider` → `Layout` (with `inspector={<EvidencePanel />}`) |
| Data API | `lib/orvek-v0/mock-api.ts` | `createMockOrvekDataApi()` returns `{ getObject, getObjects }` from `lib/orvek-v0/orvek-data.ts` (`OBJECTS` map, lines 947–955). **`todayResurfacedIds` is undefined** |
| Today page | `components/orvek-v0/pages/today.tsx` | `resurfacedReceipts = getObjects(isProduction ? (todayResurfacedIds ?? []) : (todayResurfacedIds ?? REFERENCE_RESURFACED))` (lines 148–150) |
| Reference row ids | `components/orvek-v0/pages/today.tsx` line 131 | `REFERENCE_RESURFACED = ["r6", "r5", "r2"]` — **confirmed; no other ids** |

Note: the root hybrid app runs the same `TodayPage` with `isProductionDisplay === false`, so at root the reference branch behaves identically unless the provider supplies `todayResurfacedIds` (hybrid merge does **not** — it deletes Today view props).

---

## Exact Today Evidence Pointer render + click path

Aside section (`today.tsx` lines ~829–888), label `TODAY_RECEIPTS_SECTION_LABEL` ("Evidence pointer"):

- Row body: `“{r.sourceText ?? r.title}”` + `{r.sourceOrigin ?? "Receipt"} · {r.date ?? r.lastUpdated}` + arrow icon.
- Reference mode: `inspectable = !isProduction || …` → always `true`, so rows are always buttons.
- Click (line 874): **`select(r.id)`** — not `openInspectorSelection`, not an explicit tab argument.

Store (`components/orvek-v0/store.tsx` lines 50–53):

```50:53:components/orvek-v0/store.tsx
  const select = useCallback((id: string | null, tab?: InspectorTab) => {
    setSelectedId(id)
    setInspectorTab(tab ?? "evidence")
  }, [])
```

Store fields changed on click: `selectedId = "r6" | "r5" | "r2"`, `inspectorTab = "evidence"` (default). Nothing else.

---

## Exact Inspector / provider / evidence-panel path

| Step | File | Fact |
|------|------|------|
| Inspector shell | `components/orvek-v0/evidence-panel.tsx` → `EvidencePanel()` | Reads `selectedId`, `inspectorTab` from `useWorkbench()`; `obj = getObject(selectedId)` via `useOrvekObjectGraph()` |
| Provider lookup | `lib/orvek-v0/data-provider.tsx` → `resolveOrvekObjectFromGraph` | `data.getObject(id) ?? getZipObject(id)` — provider first, zip fixture fallback |
| Evidence tab body | `evidence-panel.tsx` → `ObjectDetail({ obj })` | Renders all sections below |
| Movement tab body | `evidence-panel.tsx` → `MovementView({ obj })` | Selected-object before/after (or honest "no recorded movement" note) + global `mu-1/mu-2/mu-3` list + report button |

---

## The reference Evidence Pointer DATA CONTRACT (core deliverable)

### Fixture definitions (`lib/orvek-v0/orvek-data.ts`)

**`r6`** (line 64):

| Field | Value |
|-------|-------|
| `type` | `"receipt"` |
| `title` | "Need to see everything expressed." |
| `sourceText` | "Need to see everything expressed before I can stop reopening it." |
| `sourceOrigin` / `date` | "Explore conversation" / "Today" |
| `whyItMatters` | "Links visual expression to the scope-reopening loop." |
| `relatedIds` | `["m-loop-1", "m-claim-1"]` |
| `contextIds` | `["ctx-self"]` |
| `tags`, `evidenceCount` | `["Receipt", "From Explore"]`, `1` |

**`r5`** (line 49):

| Field | Value |
|-------|-------|
| `type` | `"receipt"` |
| `title` | "A previous note about avoiding shipping." |
| `sourceText` | "Maybe I keep refining because shipping makes it real…" |
| `sourceOrigin` / `date` | "ChatGPT archive" / "12 days ago" |
| **`whyResurfaced`** | "Resurfaced because of a similar decision pattern around the prototype." |
| `whyItMatters` | "Connects decision avoidance to fear of public judgement." |
| `relatedIds` | `["m-loop-1", "aq-1", "d-public"]` |
| `contextIds` | `["ctx-constraints"]` |

**`r2`** (line 21):

| Field | Value |
|-------|-------|
| `type` | `"receipt"` |
| `title` | "We need to see everything and see it expressed." |
| `sourceText` | "We need to see everything and see it expressed — every object, every panel — before I trust the shape." |
| `sourceOrigin` / `date` | "ChatGPT archive" / "5 days ago" |
| `whyItMatters` | "Reinforces demand for full feature visibility before commitment." |
| `relatedIds` | `["m-claim-1", "d1"]` |
| `contextIds` | `["ctx-self", "ctx-values"]` |

### Field → section mapping in `ObjectDetail` (`evidence-panel.tsx`)

| Fixture field | Rendered section | Line(s) | Generic chrome or type-specific? |
|---------------|------------------|---------|-------------------------------|
| `type` | `TypeBadge` header | 380 | Generic |
| `title` | h3 header + Inspector subtitle | 382, 66–68 | Generic |
| `subtype`, `lastUpdated ?? date` | Header meta line | 384–389 | Generic |
| `type === "receipt" && sourceText` | **"Source text"** blockquote + `sourceOrigin · date` line | 393–402 | Receipt-specific |
| `whyResurfaced` | **"Why it resurfaced"** | 404 | Any type; only `r5` has it |
| `summary` | "Summary" | 406 | Any type; r2/r5/r6 do **not** have `summary` → not rendered |
| `whyItMatters` | **"Why it matters"** | 408 | Any type |
| `before / after` | "Model movement" + "See full movement" → `setInspectorTab("movement")` | 602–614 | Any type; **absent on r2/r5/r6 → not rendered** |
| `receiptIds` → `getObjects` | **"Receipts · N"** clickable quote buttons → `select(r.id)` | 617–632 | Any type; **absent on r2/r5/r6 → not rendered for the receipts themselves** (rendered on their related objects) |
| `supporting` / `conflicting` | "Supporting & conflicting" +/− lists (plain text, not clickable) | 635–660 | Any type; **absent on r2/r5/r6 → not rendered** |
| `contextIds` → `getObjects` | **"Relevant background / context"** `LinkedRow` buttons → `select(obj.id)` | 663–671 | Any type |
| `relatedIds` → `getObjects` | **"Related objects"** `LinkedRow` buttons → `select(obj.id)` | 674–682 | Any type |
| `whatWouldChange` | "What would change this" (plain text) | 685–696 | Any type; absent on r2/r5/r6 → not rendered |
| `type !== "report"` | "Ask in Explore" button → `setPage("explore")` | 699–710 | Generic |
| `type` in allowlist (incl. `"receipt"`) | **"Correct the model"** chips → `applyCorrection(obj.id, label)` | 713–742 | Type-gated generic (`showCorrections`, lines 366–374) |

**Sections actually rendered for r6/r5/r2 (Evidence tab):** header, Source text, Why it resurfaced (r5 only), Why it matters, Relevant background / context, Related objects, Ask in Explore, Correct the model. Movement tab shows the honest "no recorded before/after" note plus global recent movement (r2/r5/r6 have no `before`/`after`).

### Adjacency map (first-click graph per reference row)

| Selected | Section | Rendered item | Target ID | Target type | Click result | Fixture field |
|----------|---------|---------------|-----------|-------------|--------------|---------------|
| `r6` | Source text | quote + "Explore conversation · Today" | — | — | not clickable | `sourceText`, `sourceOrigin`, `date` |
| `r6` | Why it matters | prose | — | — | not clickable | `whyItMatters` |
| `r6` | Relevant background / context | "Self-concept / identity context" | `ctx-self` | `context` | `select("ctx-self")` → rich context view (summary, receipts r1/r6, supporting, whatWouldChange, corrections) | `contextIds` |
| `r6` | Related objects | "Scope reopening under uncertainty" | `m-loop-1` | `map-object` (loop) | `select("m-loop-1")` → summary, whyItMatters, receipts r5/r6, supporting/conflicting, related aq-1/ctx-constraints/d-public, corrections | `relatedIds` |
| `r6` | Related objects | "You often need visual expression…" | `m-claim-1` | `map-object` (claim) | `select("m-claim-1")` → receipts r1/r2/r6, supporting/conflicting, related d1/aq-1/ctx-self, corrections | `relatedIds` |
| `r5` | Why it resurfaced | prose | — | — | not clickable | `whyResurfaced` |
| `r5` | Relevant background / context | "Constraints" | `ctx-constraints` | `context` | `select("ctx-constraints")` | `contextIds` |
| `r5` | Related objects | "Scope reopening under uncertainty" | `m-loop-1` | `map-object` | `select("m-loop-1")` | `relatedIds` |
| `r5` | Related objects | "Does public visibility trigger overbuilding?" | `aq-1` | `active-question` | `select("aq-1")` → summary, whyItMatters, missingEvidence, receipts r5, related m-loop-1/d-public/f1 | `relatedIds` |
| `r5` | Related objects | "Small public test" | `d-public` | `decision` | `select("d-public")` → recommendation, decisionContext, projection, outcome window + Add outcome, receipts r5, context ctx-constraints | `relatedIds` |
| `r2` | Relevant background / context | "Self-concept…" / "Values / direction" | `ctx-self`, `ctx-values` | `context` | `select(id)` | `contextIds` |
| `r2` | Related objects | "You often need visual expression…" | `m-claim-1` | `map-object` | `select("m-claim-1")` | `relatedIds` |
| `r2` | Related objects | "Use v0 architecture prototype before final design" | `d1` | `decision` | `select("d1")` → full decision context (options A/B/C with pros/cons, decisionContext, projection, receipts r1/r2/r3, related m-claim-1/m-conflict-1/aq-2/f1, whatWouldChange, outcome) | `relatedIds` |

Every nested target above opens **another rich `ObjectDetail` context** (not a thinner view) because each linked fixture itself carries `summary` / `whyItMatters` / `receiptIds` / `relatedIds` / `contextIds` / `supporting` etc. Depth = one shared component + graph-complete fixtures.

---

## Exact difference: reference path vs aborted live row path

| Dimension | Reference row (`r6`/`r5`/`r2`) | Aborted live row (`receiptRowToOrvekObject` output) |
|-----------|-------------------------------|------------------------------------------------------|
| Click | `select(id)` → Evidence tab | `select(id, "evidence")` → Evidence tab (**same, fine**) |
| Object fields | `sourceText`, `sourceOrigin`, `date`, `whyItMatters`, `whyResurfaced` (r5), `relatedIds`, `contextIds`, `tags`, `evidenceCount` | Only `id`, `type`, `title`, `sourceText`, `sourceOrigin`, `date`, `lastUpdated`, optional `inspectorObjectType/Id` |
| Rendered sections | Source text + Why it matters + (Why it resurfaced) + Background/context rows + Related objects rows + corrections | Source text + corrections only — **no Why it matters, no context, no related objects** |
| Nested navigation | 2–3 clickable objects per receipt, each opening a rich context | **Zero** nested clickable objects |
| Provenance depth | Human origin + relative date + tags | Kind label + raw meta split |

The aborted parity gate (`hasInspectableEvidencePointerContent`) accepted the right column because it only checks `sourceText` + provenance. That is the exact gap.

---

## Minimum parity requirements for a future live Evidence Pointer object

For the **existing UI** (`ObjectDetail`, unchanged) to render the reference-depth experience, a live object must provide:

1. `type: "receipt"` — enables Source text block and corrections.
2. `title` — header + Inspector subtitle (human sentence, not a kind label).
3. `sourceText` — verbatim capture text (non-generic).
4. `sourceOrigin` + `date` (or `lastUpdated`) — provenance line under the quote and in the header.
5. **`whyItMatters`** — non-empty explanation string; without it the "Why it matters" section silently disappears.
6. **`relatedIds`** — ≥1 id that `getObject` resolves to a real object **with its own `title`, `type`, and enough fields for a non-empty `ObjectDetail`** (otherwise nested click = thin/empty Inspector → dead-feeling link).
7. **`contextIds`** — background/context objects resolvable the same way (`type: "context"` with `summary`, ideally `receiptIds`/`supporting`).
8. Optional but present in reference: `whyResurfaced` (resurfaced receipts), `tags`, `evidenceCount`.
9. **Graph closure:** every id in `relatedIds`/`contextIds` (and their `receiptIds`) must resolve through the provider graph — the parity gate must validate the neighbourhood, not just the receipt node.

**Parity rule:** a live Evidence Pointer is parity-safe only when its object renders ≥ the reference section set (Source text, Why it matters, Background/context, Related objects, corrections) with zero dead nested links — not merely when it opens the Evidence tab.

---

## Test coverage and gaps

**Existing coverage:**

- `lib/__tests__/today-surface.test.ts` line 220 — asserts `select(r.id)` exists in Today source (click path).
- `lib/__tests__/evidence-panel-provider-lookup.test.ts` lines 65, 79–82 — `r6` zip fallback and `["r6","r5","r2"]` resolution through the graph.
- `lib/__tests__/desktop-hard-swap-regression-sweep.test.ts` — reference route mock-only; no production displayContract.
- `lib/__tests__/today-evidence-pointer-parity.test.ts` — receipt/sourceText/provenance gates (the insufficient ones).
- `lib/__tests__/inspector-surface-wiring.test.ts` — covers the **other** inspector (`components/inspector/panels/SelectedObjectEvidencePanel.tsx`, old route shell), not `evidence-panel.tsx`.

**Gaps (no test asserts today):**

1. That `r6`/`r5`/`r2` fixtures carry `whyItMatters` + `relatedIds` + `contextIds` (the depth contract could regress silently).
2. That `ObjectDetail` renders Related objects / Background context sections from those fields.
3. Any graph-closure check (`relatedIds`/`contextIds` of the reference receipts resolve to objects).
4. Any depth-parity gate for live evidence pointers (current gates stop at sourceText+provenance).

No trace-only guard tests were added in this slice (kept receipt-only per preferred output); gap #1–#3 are cheap guards for the next branch.

---

## Recommended next branch

**`desktop-live-evidence-inspector-depth-parity-001`** — parity/contract work, **not** UI:

- Extend the evidence-pointer parity module with a depth gate, e.g. `hasReferenceDepthEvidenceContext(api, id)` requiring `whyItMatters` + resolvable `relatedIds`/`contextIds` neighbourhood (graph closure).
- Enrich `receiptRowToOrvekObject` / live object registration to carry `whyItMatters`, `relatedIds`, `contextIds` **only from real stored data** (no fabricated relations — if live data lacks them, the pointer stays blocked; do not invent graph edges).
- Add guard tests for gaps #1–#4 above.
- UI consumption remains deferred until the depth gate can pass on real live data.

---

## Checks run

- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS (tree clean; receipt is the only addition)
- Vitest: `today-surface` (14), `inspector-surface-wiring` (13), `evidence-panel-provider-lookup` (9), `desktop-hard-swap-regression-sweep` (10) — **46 passed**

---

## Remaining uncertainties

1. Runtime-vs-code: no runtime session was run in this trace; all findings are code-traced. Reference behaviour at `/dev/orvek-v0-reference` follows directly from `createMockOrvekDataApi` + fixtures, so disagreement risk is low, but PO runtime spot-check of one nested click (e.g. r5 → d-public → Add outcome) would confirm.
2. Whether real live surfacing data can ever supply true `relatedIds`/`contextIds` (pattern/tension links exist via `receiptHref` parsing, but background/context linkage has no live source yet) — this determines whether depth parity is achievable or the Evidence Pointer aside stays reference for longer.

---

**UI changed:** NO  
**Product code changed:** NO  
**Production-ready:** NO
