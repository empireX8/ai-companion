# Today Behaviour Contract (Accepted Reference State)

**Baseline:** `8938091`  
**Gate:** Root Today renders the **reference branch** because `isProductionDisplay(data)` is `false` (hybrid root does not set `displayContract: "production"`).

---

## Presentation mode at root

| Signal | Accepted root behaviour |
|--------|-------------------------|
| `isProductionDisplay(data)` | `false` |
| Hero / primary card | Reference decision lead `d1` |
| Attention rows | `REFERENCE_NOW_ROWS` (4 fixed rows) |
| Delta log (movements) | `REFERENCE_MOVEMENTS` (3 cards with before/after) |
| Aside report card | Visible — opens Weekly Model Movement report |
| Primary action chips | `REFERENCE_PRIMARY_ACTIONS` (all wired to `select("d1")`) |
| Briefing copy | `todayCopy` fallback strings when unset |

**Important:** Hybrid provider may merge live receipt objects into `getObject` / `getObjects`, but **Today page layout and copy remain reference-presented** until a future slice replaces reference branch with behaviour-equivalent live branch.

---

## Section inventory (reference branch)

### Header

| Element | Accepted language / content |
|---------|---------------------------|
| Briefing line | `todayCopy?.briefingLine` or `"Tuesday · since your last visit"` |
| Title | `todayCopy?.briefingTitle` or `"Current state"` |
| Meta | `"2 current changes are ready and 1 report is ready. Start where the state changed."` (when copy unset) |

### Primary card — **State · decision outcome due**

| Field | Accepted content |
|-------|------------------|
| Title | `d1`: "Use v0 architecture prototype before final design" (clickable → Inspector) |
| Summary | Review-window narrative about prototyping architecture first |
| **Delta** | `"Outcome window closed"` |
| **Evidence pointer** (hero cell) | `"6 receipts"` (stat from `d1.evidenceCount`; **read-only**, not a button) |
| **Why it matters** | `"The current read changed because recent evidence closed the review window."` |
| **Add outcome** | `select(d1)` — opens decision in Inspector (Evidence tab default) |
| **See why it moved** | `seeWhy("mu-1")` → Inspector Model Movement tab on `mu-1` |

### Primary action chips (below hero)

All five buttons call `select("d1")` in reference mode:

| Label | Accepted click (reference) | Intended production mapping (deferred) |
|-------|--------------------------|----------------------------------------|
| Continue from what changed | `select("d1")` | `openReport("rep-weekly")` via `reportId` |
| Add what happened | `select("d1")` | Capture overlay (`overlayId: "capture"`) |
| Review outcome | `select("d1")` | Decisions page |
| Check in on fieldwork | `select("d1")` | Fieldwork route (disabled in production) |
| Capture new signal | `select("d1")` | Capture overlay |

**Accepted quirk (P1):** Reference mode routes all chips to the same decision object. PO finds this **understandable in reference state**; production wiring must preserve clarity when differentiated.

### Next observation / test (attention rows)

Four clickable rows; each `select(row.id)`:

| ID | Kicker | Title |
|----|--------|-------|
| `m-loop-1` | Watch For | Scope-reopening pattern triggered again |
| `f1` | Fieldwork | Small public test — narrow version before reopening |
| `d1` | Outcome review | Ship prototype or keep refining architecture? |
| `aq-3` | Open question | Which features are essential for a first version? |

Every row shows arrow affordance and hover state.

### Delta log (Recent model movement on Today)

Three cards from `REFERENCE_MOVEMENTS`. Each includes:

- **Previously** / **Updated understanding** columns (full before/after prose)
- Evidence line (receipt count narrative)
- **See why** → `seeWhy(id)` → Inspector Model Movement tab

| ID | See why opens |
|----|---------------|
| `mu-1` | Full before/after in Inspector |
| `mu-2` | Full before/after in Inspector |
| `aq-1` | Object without before/after (Inspector shows honest missing-movement note + recent list) |

### Aside — Weekly Model Movement report card

| Element | Behaviour |
|---------|-----------|
| Title | "Weekly Model Movement report" |
| Meta | "Ready · 3 loops, 2 decisions, 1 context update" |
| Click | `openReport("rep-weekly")` → report overlay |

This is the **accepted report entry** from Today aside (not the primary "Continue from what changed" chip in reference mode).

### Aside — **Evidence pointer** section

Label: `TODAY_RECEIPTS_SECTION_LABEL` = **"Evidence pointer"**

Default resurfaced IDs: `REFERENCE_RESURFACED` = `["r6", "r5", "r2"]`

| Behaviour | Contract |
|-----------|----------|
| Row presentation | Quoted receipt text + origin · date |
| Click | `select(r.id)` → Inspector Evidence / Context tab |
| Affordance | Primary-colored left border, hover, arrow icon |
| Empty | "No receipts resurfaced in this window yet." |

**Evidence pointer meaning (accepted):** A resurfaced receipt quote the user can open in Inspector to see source text, related objects, and correction affordances. Not a dead list item.

---

## Navigation mechanics (workbench store only)

| Action type | Handler | No route-first |
|-------------|---------|----------------|
| Inspector selection | `select(id, tab?)` | ✓ |
| Report overlay | `openReport(reportId)` | ✓ |
| Page change | `setPage(...)` | ✓ (sidebar/topbar) |
| Overlay | `setOverlay("capture" \| "search" \| "import")` | ✓ |

Today does **not** use `router.push` for accepted interactions.

---

## Must-not-regress list (Today)

1. Hero **Evidence pointer** cell remains a readable stat tied to the lead object (`N receipts`), not removed or replaced by unlinked live counts.
2. Aside **Evidence pointer** rows remain **clickable** and open Inspector on real receipt objects (`r6`, `r5`, `r2` at minimum in reference graph).
3. **See why it moved** on hero opens `mu-1` with **recorded before/after** in Inspector — hero must not claim movement without Inspector parity.
4. Delta log cards retain **Previously / Updated understanding** structure and working **See why** links.
5. Aside **Weekly Model Movement report** card opens `rep-weekly` overlay with linked receipts and related objects.
6. Attention rows remain fully interactive with clear kicker/title/status language.
7. Reference primary actions remain visually enabled (even if they all select `d1` — changing this requires explicit production intent wiring + PO sign-off).
8. No swap to raw live intelligence-update hero copy unless live object graph provides equivalent Inspector movement + evidence linkage.
9. No introduction of non-clickable evidence rows without explicit read-only labelling.
10. Section labels preserved: State, Next observation / test, Delta log, Evidence pointer, Re-entry trigger (production-only section).

---

## Known accepted limitations (document, do not fix in this audit)

- Primary chips do not yet differentiate intents in reference mode (P1).
- Production Today branch (`isProductionDisplay true`) exists but is **not active at root** — deferred-action disabled buttons are not the accepted reference experience.
- Hybrid may hydrate live receipt objects while reference UI remains — object graph can be richer than visible copy.

**Production-ready: NO**
