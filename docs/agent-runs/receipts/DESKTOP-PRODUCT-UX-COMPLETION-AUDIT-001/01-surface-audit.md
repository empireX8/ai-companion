# Desktop Product UX Completion Audit — Surface Findings

**Baseline:** `8ef094a`  
**Production-ready: NO**

---

## Executive summary

The hard-swap shell is **stable and honest for Free Explore live chat**. The rest of the desktop still reads as a **reference workbench with partial production overlays** — not a cohesive live product. The dominant gap is **surface mode gating**: root hybrid merges production data into the provider, but most v0 pages key off `isProductionDisplay(data)` (`displayContract === "production"`), which the hybrid stack intentionally never sets globally. Surfaces therefore fall back to **reference mock rows, stats, and chrome** even when live data is present in the merged API.

---

## 1. Today

### What works

- **Re-entry architecture exists:** `runTodayWorkbenchCommands`, `resolveTodayWorkbenchCommands`, store actions (`setPage`, `select`, `openReport`, `setOverlay`).
- **Production path is designed:** hero card, now rows, fieldwork section, resurfaced receipts, report block, movement list — all with honest empty copy slots.
- **Section framing is good:** Primary / Attention / Fieldwork / Receipts / Movement labels align with product truth.
- **Inspector handoff:** “See why it moved”, “Open in Inspector” wired when production hero exists.

### What is weak or missing

| Issue | Severity | Detail |
|-------|----------|--------|
| **Reference mode dominates at root** | **Critical** | When `isProductionDisplay(data)` is false (always at root hybrid today), Today renders `REFERENCE_NOW_ROWS`, `REFERENCE_MOVEMENTS`, `REFERENCE_PRIMARY_ACTIONS`, and `referenceLead` — not merged `today.nowRows` / hero even if production Today overlay merged. |
| **Briefing copy defaults** | Medium | Falls back to “Tuesday · since your last visit” / “Current state” / reference meta when `todayCopy` sparse. |
| **Primary actions mostly disabled** | Medium | Production primary actions use `ORVEK_DEFERRED_ACTION_CLASS` when commands empty; reference mode buttons call `select("d1")` regardless of label. |
| **Card coherence** | Medium | In reference mode, attention rows feel like a demo playlist — connected thematically but not driven by live snapshot priority. |
| **Report re-entry** | Medium | Report block exists but depends on production `today.report`; reference mode uses mock movement/report wiring. |

### Re-entry verdict

**Partially acts as re-entry surface.** Architecture and copy frame are right; **live re-entry UX is blocked** until Today can detect merged live snapshot without global `displayContract: production`.

---

## 2. Map

### What works

- **Master-detail layout** matches durable model mental model (ontology rail + detail).
- **Production header** (`ProductionMapHeader`) with loading/error/empty honesty when `isProduction` true.
- **Inspectable objects** — row click → `select(id)` + inspector.
- **Corrections affordance** on detail (Confirm / This is wrong / etc.).
- **Hybrid merge** can populate `mapCategories`, detail skeleton sections, mind context bands when fetch succeeds.

### What is weak or missing

| Issue | Severity | Detail |
|-------|----------|--------|
| **Mixed live/reference mode at root** | **Critical** | When `isProduction` false but `mapCategories` merged: rail shows live objects, header shows **reference stats** (“243 receipts”, “7 open questions”, “mixed / evolving”). Misleading completeness. |
| **Default selection fallback** | Medium | Non-production defaults to `m-claim-1` reference object if selection empty. |
| **Evidence depth** | Medium | Centre detail shallow by design; inspector carries depth — but user may not discover inspector without training. |
| **Empty ontology rails** | Low–Medium | Production mode shows “—” per empty category; many rails may be empty simultaneously → sparse without narrative. |
| **Graph-for-graph’s-sake risk** | Low | Eight ontology categories are rich; without live population the rail feels like taxonomy demo. |

### Map verdict

**Strong reference UX; live model surface incomplete at root** due to display-mode split and reference header bleed.

---

## 3. Timeline

### What works

- **Semantic framing** — subtitle, lane legend, filters via `TIMELINE_SEMANTIC_FILTERS` in production mode.
- **Not a calendar** — grouped evolution rail (Today / This week / …), event types, movement markers.
- **Distinct from Today** — audit/evolution lens vs re-entry lens (when production mode active).
- **Empty honesty** — production empty copy for sparse windows.

### What is weak or missing

| Issue | Severity | Detail |
|-------|----------|--------|
| **Reference groups when not production** | **High** | Falls back to hardcoded `GROUPS` (`t1`–`t14`, `imp-1`) when `timelineGroups` empty — full mock timeline. |
| **Partial hybrid** | Medium | Can show merged `timelineGroups` without production filter semantics if groups populated but `isProduction` false. |
| **Movement explanation depth** | Medium | Row click opens inspector; centre rail shows title/type/date — before/after mostly in inspector. |
| **Search** | Low | Local filter only; no semantic search backend wired in v0 page. |

### Timeline verdict

**Good semantic design; live evolution story blocked** by same display-mode gating as other surfaces.

---

## 4. Decisions

### What works

- **Stage model** — Active / Chosen / Outcome due / Reviewed progression strip.
- **Workspace layout** — list + detail + receipts/contexts linkage.
- **Production overlay** — `decisionListGroups`, header stats when groups exist.
- **Partial live detection** — `showLiveHeaderStats` uses groups + stats even when not `isProduction` (better than Today).

### What is weak or missing

| Issue | Severity | Detail |
|-------|----------|--------|
| **Reference lists when sparse** | High | Falls back to hardcoded `LISTS` (`d1`, `d2`, `d-public`, etc.) when no merged groups. |
| **Entry module disabled** | Medium | “Talk it through” disabled in production (`isProduction` + `ORVEK_DEFERRED_ACTION_CLASS`); routes to Explore but blocked. |
| **Quick actions disabled** | Medium | Compare options / Add outcome / Review due — several use deferred class in production. |
| **Lineage depth** | Medium | Receipts/contexts shown; full decision lineage and outcome recording not end-to-end productized. |
| **Quick vs deep decisions** | Low | No explicit UX distinction — all rows same visual weight. |

### Decisions verdict

**Best partial live surface after Explore** (header stats heuristic), but still mixes mock lists and disabled entry actions.

---

## 5. Explore

### What works

- **Tab separation clear** — Free Explore / Investigations / Active Questions / Fieldwork Bridge with underline styling.
- **Free Explore live path** — send/draft/stream; Thinking… row; dual gate; PO-confirmed ordering.
- **Grounding honesty (live)** — `useReferenceGrounding = !hasLiveExploreChat`; no mock chips in live root.
- **Inspector integration** — `setExploreActive`, movement tab guidance, hedged live detection copy.
- **Sub-tab production bridges** — hybrid merges for investigations, active questions, experiment/fieldwork when readiness passes.

### What is weak or missing

| Issue | Severity | Detail |
|-------|----------|--------|
| **Reference Free Explore on non-live** | Medium | Reference messages, grounding chips, live detection copy when not in live chat — intentional on reference route; at root before session boot user may briefly see reference patterns. |
| **Sub-tab reference fallbacks** | Medium | e.g. Active Questions yes/no resolution bullets fall back to hardcoded strings when `!hasLiveQuestions`. |
| **“Talk to your model” differentiation** | Medium | Free Explore UX is cleaner than generic chat but quick prompts and Orvek voice still thin vs full model-context surfacing. |
| **Sub-tab actions deferred** | Medium | Explore this / Propose fieldwork / Mark resolved disabled when live questions loaded. |
| **Streaming polish** | Low | Send path works; no incremental token streaming UX beyond Thinking… placeholder. |

### Explore verdict

**Strongest live surface** — send/honesty path is product-credible. Sub-tabs and non-live states still carry reference/demo residue.

---

## 6. Inspector

### What works

- **Two meaningful tabs** — Evidence/Context vs Model Movement.
- **Explore live honesty** — reference “From this conversation” only when `!hasLiveExploreChat`; live empty state honest.
- **Object detail** — supporting/conflicting blocks, corrections, related objects, report links when object selected.
- **Movement before/after** presentation when object has movement fields.

### What is weak or missing

| Issue | Severity | Detail |
|-------|----------|--------|
| **Recent movement always mock** | **High** | `getObjects(["mu-1", "mu-2", "mu-3"])` always rendered in “Recent model movement” — reference objects, globally framed but not live-gated. |
| **“Synced” badge** | Medium | Non-Explore selected objects show “Synced” without evidence of live sync — implies freshness not proven. |
| **“Live” badge in Explore** | Low | Accurate for explore-active session but does not mean model updated. |
| **Why in model** | Medium | Evidence tab explains object fields; “why this is in the model” narrative varies by object type — not uniformly strong. |
| **Empty inspector** | Low | Good empty copy when nothing selected. |

### Inspector verdict

**Structurally sound; global movement section and Synced badge undermine honesty** outside Free Explore live path.

---

## 7. Cross-surface continuity

### What works

- **Store navigation** — sidebar `setPage`, top bar shortcuts, Today commands → store actions (no route-first in active v0 pages).
- **Shared object graph** — `getObject` / `select` consistent across surfaces.
- **Report overlay** — `openReport` opens report overlay from Today, Decisions, Inspector.
- **Capture overlay** — top-level Capture entry (overlay, not route).

### What is weak or missing

| Gap | Detail |
|-----|--------|
| **Life Data → Signal loop incomplete** | Capture overlay uses reference `OBJECTS` search — not live library/evidence index. |
| **Signal → Object** | Works when production merges populate graph; otherwise reference ids. |
| **Object → Movement → re-entry** | Movement visible in Inspector/Timeline; Today re-entry from live movement not surfaced when Today stuck in reference mode. |
| **Reports visibility** | Report overlay exists (`rep-weekly`, `rep-decision`) — reference report content, not proven live-backed. |
| **Watch-for / fieldwork loop** | Fieldwork rows on Today; Explore Fieldwork Bridge tab; connections exist but many actions deferred. |
| **Selected object persistence** | Selection persists in store across `setPage` — good; no breadcrumb showing where object came from. |

### Continuity verdict

**Navigation graph is coherent in reference demo; live loop is broken at Today re-entry and global chrome layers.**

---

## 8. Product honesty inventory

| Location | Issue | Type |
|----------|-------|------|
| TopBar | “Model moved · 4 places”, “7 questions · 3 reviews open”, “Synced 2h ago”, “Context profile current” | Reference fixture presented as live status |
| Today (reference mode) | Full mock attention/movement/receipt rows | Demo data at root |
| Map (non-production header) | “243 receipts”, “7 open questions” | Fake stats when live rail may show |
| Decisions (reference header) | “2 outcomes due · 12 reviewed” | Fake stats when not live |
| Inspector | Recent model movement `mu-1..3`; “Synced” badge | Implied live global state |
| Explore (non-live) | Reference grounding chips + detection copy | OK on reference route; risky if shown at root pre-boot conflated with live |
| Overlays (Capture/Search) | Reference object search | Demo-only affordances |

**Free Explore live path is the honesty exception** — PR #97/#99 guards hold.

---

## Central architectural finding

Root `useOrvekHybridWorkbenchDataApi` → `buildHybridWorkbenchDataApi` **merges production overlays** but **does not set** (and actively strips) global `displayContract: production`. v0 pages use:

```typescript
const isProduction = isProductionDisplay(data) // api.displayContract === "production"
```

At root, `isProduction` is **always false**. Surfaces then render reference/mock branches **even when live fields are merged**, producing a **split-brain UX**: live data in provider, reference UI on screen.

Explore partially escapes this via `hasLiveExploreChatFromProvider`. Decisions uses a partial heuristic for header stats. **Today is the worst affected** — entire attention/movement sections swap to reference mocks.

**Recommended direction (future slice):** per-surface live readiness flags (e.g. `todayIsLive`, `mapIsLive`) — **not** global `displayContract: production`.

---

**Production-ready: NO**
