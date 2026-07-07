# Inspector, Report, and Evidence Contract

**Baseline:** `8938091`  
**Primary surface:** `components/orvek-v0/evidence-panel.tsx` + `components/orvek-v0/overlays.tsx`

---

## Inspector shell contract

| Element | Accepted behaviour |
|---------|-------------------|
| Title | "Inspector" |
| Selected subtitle | Truncated `obj.title` when selected |
| Status badge (non-Explore) | "Synced" when object selected |
| Status badge (Explore active) | "Live" pulse badge |
| Tabs | **Evidence / Context** · **Model Movement** |
| Empty state | "Nothing selected" + guidance to select any object |

Object lookup uses `useOrvekObjectGraph()` — provider objects preferred, reference zip fallback (`lib/orvek-v0/data-provider.tsx`).

---

## Tab 1 — Evidence / Context (`ObjectDetail`)

When Today Evidence pointer or any list item calls `select(id)`:

| Object type | Accepted content blocks |
|-------------|-------------------------|
| **Receipt** (`r6`, etc.) | Source text blockquote, origin · date, why it resurfaced, related/context links, corrections |
| **Decision** (`d1`) | Summary, recommendation, options, decision context, outcome window, receipts list (clickable → `select`), related objects |
| **Model update** (`mu-*`) | Summary, before/after block with "See full movement" → switches to Movement tab |
| **Map object / fieldwork / investigation** | Type-appropriate blocks per `orvek-types` |

**Accepted linkage pattern:** Receipt rows in Today aside → Inspector shows **verbatim source text** and linked objects user can click (`select`).

**Corrections block:** "Correct the model" chips (Confirm, This is wrong, etc.) on supported types — accepted reference affordance.

**Ask in Explore:** Button calls `setPage("explore")` — store navigation only.

---

## Tab 2 — Model Movement (`MovementView`)

### Layer order (top → bottom)

1. **From this conversation** (Explore reference only)
2. **Live conversation empty** (Explore live, no movement)
3. **Selected object movement** (if any)
4. **Recent model movement** (global list)
5. **Open Model Movement report** button

### A. From this conversation (reference Explore)

**Gate:** `exploreActive && !hasLiveExploreChatFromProvider(data)`

| Element | Accepted content |
|---------|------------------|
| Copy | "This may update your model in {N} places. Confirm what is true." |
| Cards | `EXPLORE_MOVEMENT` reference proposals with Confirm/Edit/Reject |
| Grounded in | Reference chips from `EXPLORE_GROUNDING` — clickable → `select` |

**Must not regress (reference Explore path):** Mock conversation movement block only when **not** live chat.

### B. Live conversation empty (live Explore)

**Gate:** `exploreActive && hasLiveExploreChat && exploreMovement.length === 0`

Copy: `EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY`  
> "No proposed model movement from this conversation yet. Sending a message does not publish updates until they are reviewed."

**Must not regress:** No mock "From this conversation" block in live chat mode.

### C. Selected-object movement

| Condition | Accepted UI |
|-----------|-------------|
| `obj.before \|\| obj.after` | Section titled with `obj.title`; Before/After blocks; optional confidence |
| Selected, no before/after, not Explore-active | `"${obj.title} has no recorded before/after movement yet. Recent movement across the model is shown below."` |
| Explore-active, no before/after | Selected-object note suppressed (conversation layers handle context) |

**Contract:** Missing movement is **honestly stated** for the selected object. Recent list is explicitly **below**, not substituted as the selected object's movement.

**Today coherence requirement:** If Today hero or Delta log sends user to `seeWhy(id)`, either:
- object has before/after (e.g. `mu-1`), **or**
- copy must not imply a complete movement comparison.

Accepted reference: hero "See why it moved" → `mu-1` (has before/after). ✓

### D. Recent model movement (global)

**Always rendered** in accepted staging (including live Explore after send).

| Element | Accepted behaviour |
|---------|-------------------|
| Heading | "Recent model movement" |
| Items | Fixed IDs `mu-1`, `mu-2`, `mu-3` from reference graph |
| Each row | Title, lastUpdated, compact Before/After, click → `select(id)` |
| Footer button | **"Open Model Movement report"** → `openReport("rep-weekly")` |

**Accepted product affordance:** This section provides **global model context** separate from the selected object. Users expect it to exist and be clickable.

**Future live note (P0-3 from UX audit):** Replacing fixtures requires a live movement feed with equivalent before/after + click behaviour — not removal without replacement.

---

## Report opening contract

### Entry points (accepted)

| Source | Action | Report ID |
|--------|--------|-----------|
| Today aside card | `openReport("rep-weekly")` | Weekly Model Movement |
| Inspector Movement tab | `openReport("rep-weekly")` | Weekly Model Movement |
| Decisions page (reference) | `openReport("rep-decision")` | Decision report |
| Inspector (report object) | `openReport(obj.id)` | Per-object |

### Report overlay (`ReportOverlay`)

For `rep-weekly`:

| Block | Accepted content |
|-------|------------------|
| Title | "Weekly Model Movement" |
| Summary | Model shift narrative |
| Receipts cited | Blockquotes from `r5`, `r6`, `r2` |
| What this report points to | Clickable related objects (`mu-1`, `mu-2`, `d1`, etc.) → `select` + close overlay |
| Footer note | Report is generated read; claims link to evidence |

**Must-not-regress:** Report opens as overlay (not route navigation). Related objects and receipts inside report remain Inspector-linkable.

---

## Evidence linkage contract

| Rule | Detail |
|------|--------|
| **Inspectable path required** | If UI shows evidence counts or receipt quotes as clickable, `select(id)` must resolve to an object with meaningful Inspector content |
| **No dead rows** | Evidence pointer aside rows must not be styled as buttons if non-interactive |
| **No fake counts without path** | Hero "N receipts" acceptable when decision object has `receiptIds` navigable from Inspector |
| **Quote integrity** | Resurfaced quotes must match receipt `sourceText` in Inspector |
| **Live replacement bar** | Live Today receipts must register in object graph with same Inspector depth before replacing reference resurfaced list |

---

## Selected vs global movement separation

```
┌─────────────────────────────────────┐
│ Inspector → Model Movement          │
├─────────────────────────────────────┤
│ [Explore conversation layer]        │  ← only Explore; live vs reference gated
├─────────────────────────────────────┤
│ SELECTED OBJECT                     │  ← title = selectedId object
│  before/after OR honest missing note│
├─────────────────────────────────────┤
│ RECENT MODEL MOVEMENT (global)      │  ← always separate section
│  mu-1, mu-2, mu-3                   │
│  [Open Model Movement report]       │
└─────────────────────────────────────┘
```

**Must-not-regress:** Global recent list must not be removed or hidden without live equivalent. Missing selected movement must not silently show global rows **as if** they explain the selection.

---

## Future live-data requirements (before replacing reference movement/report)

Live replacement must provide:

1. **Registered objects** in provider graph with stable IDs
2. **Before/after text** (or explicit honest-empty) per movement surfaced in Today/Inspector
3. **Receipt linkage** (`receiptIds` or equivalent) inspectable from Inspector
4. **Report overlay content** from stored evidence — not static mock narrative unless labelled reference
5. **Click parity:** every Today "See why" target opens matching Inspector movement evidence
6. **Separation preserved:** session/conversation movement ≠ global recent feed ≠ selected object movement

**Production-ready: NO**
