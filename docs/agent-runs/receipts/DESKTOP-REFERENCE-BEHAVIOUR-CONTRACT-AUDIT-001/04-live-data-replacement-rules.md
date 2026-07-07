# Live-Data Replacement Rules

**Baseline:** `8938091`  
**Production-ready:** NO

---

## Core rule

> **Live data may replace reference data only when it preserves equivalent product affordances** — not when it merely exists in the provider.

Replacement requires **behaviour parity**, not **data presence**.

---

## Anti-regression checklist (all future live slices)

Before merging any live presentation path, verify:

| # | Criterion | Fail example (aborted slice) |
|---|-----------|-------------------------------|
| 1 | **Language clarity** ≥ reference | Raw API labels ("Conclusion Added · Related map item") without narrative framing |
| 2 | **Click behaviour** ≥ reference | Evidence rows styled as list but non-interactive |
| 3 | **Inspector linkage** ≥ reference | "See why it moved" → object with no before/after |
| 4 | **Report/evidence linkage** ≥ reference | Live hero stats with no inspectable receipt path |
| 5 | **No fake evidence/movement/memory** | Mock recent movement presented as live conversation output |
| 6 | **No global `displayContract: production`** on root hybrid | Whole-app production flag while surfaces still reference |
| 7 | **No route-first regression** | `router.push` to legacy pages instead of store navigation |
| 8 | **Selected vs global separation** | User thinks global `mu-1` explains selected unrelated object |
| 9 | **Explore honesty** (PR #97/#99) | Live chat shows mock Grounded In or fake conversation movement |
| 10 | **Disabled actions honest** | Buttons look primary but do nothing without explanation |

---

## What live data must contain before replacing reference affordances

### Today hero / primary card

- [ ] Hero title/summary in product language (not raw update type labels alone)
- [ ] Evidence pointer stat linked to inspectable receipts OR clearly read-only with explanation
- [ ] "See why it moved" only when target object has before/after OR copy reframed as summary-only
- [ ] Primary actions wired via `resolveTodayWorkbenchCommands` with distinct intents

### Evidence pointer (aside)

- [ ] Each row: `getObject(id)` resolves receipt with `sourceText`
- [ ] Click → Inspector Evidence tab with full receipt detail
- [ ] Non-inspectable rows: explicit read-only label, not button styling

### Delta log / movements on Today

- [ ] Before/after columns populated from stored movement record OR "Prior read unavailable" honestly
- [ ] "See why" targets registered objects with movement tab content

### Recent model movement (Inspector global)

- [ ] Live feed items with before/after + `select` behaviour
- [ ] Report button opens live report overlay OR honestly deferred
- [ ] Do not delete section without replacement

### Report overlay

- [ ] Live report body from stored evidence
- [ ] Cited receipts open in Inspector
- [ ] Related objects clickable

### Map / Timeline / Decisions (surface live gates)

- [ ] Per-surface readiness replaces **presentation branch**, not just merges data underneath
- [ ] Header/stats copy matches merged data (no reference "243 receipts" with live categories)
- [ ] Empty/sparse states use honest copy, not full mock `GROUPS`

### Explore live chat

- [ ] Grounding chips only from real linked evidence IDs
- [ ] Conversation movement from session API only
- [ ] CTA disabled/read-only when no conversation movement
- [ ] Inspector movement tab: conversation block ≠ global block

---

## Proposed safer implementation slices (sequenced)

| Order | Branch suggestion | Scope | Preserves |
|-------|-------------------|-------|-----------|
| 1 | `desktop-live-today-object-graph-001` | Register live Today objects (receipts, movements with before/after) in provider **without** switching Today UI branch | Inspector linkage |
| 2 | `desktop-live-today-evidence-pointer-001` | Swap aside Evidence pointer list only when every row inspectable | Evidence pointer contract |
| 3 | `desktop-live-today-hero-001` | Swap hero card when hero + See why + evidence stat parity proven | Today primary card |
| 4 | `desktop-live-today-delta-log-001` | Swap Delta log when movement records include before/after | Movement cards |
| 5 | `desktop-inspector-live-recent-movement-001` | Replace `mu-1..3` with live timeline/intelligence feed | Global movement section |
| 6 | `desktop-report-overlay-live-bridge-001` | Live report content for `rep-weekly` | Report opening |
| 7 | `desktop-surface-live-mode-gating-002` | Per-surface readiness flags **after** Today/Inspector parity proven | Map/Timeline/Decisions headers |
| 8 | `desktop-explore-movement-cta-live-001` | Actionable CTA only when `exploreMovement` populated | Explore honesty |
| 9 | `desktop-topbar-live-gating-001` | TopBar chips backed by live data or honest deferred | Cross-surface chrome |
| 10 | `desktop-today-primary-actions-live-001` | Differentiate Continue / Capture / Review intents | Primary action chips |

**Do not repeat:** `desktop-surface-live-mode-gating-001` approach (broad UI branch flip on data presence alone).

---

## Gating pattern requirement (future)

Per-surface live readiness is valid **only when paired with behaviour contracts**:

```ts
// Insufficient alone:
surfaceReadiness.today === "live"

// Required additionally:
todayLiveBehaviourReady(api) === true
// checks: inspectable receipts, movement parity, action commands, copy normalization
```

Do not use `displayContract: "production"` as a global gate.

---

## Failed slice post-mortem (behaviour-preserving lesson)

| What happened | Why it broke acceptance |
|---------------|----------------------|
| `isTodayLiveReady` flipped Today UI while hybrid merged partial Today graph | Showed live intelligence hero without movement records |
| Broadened Today merge (`today.report`, movements without before/after) | Surfaced API summaries as if complete model movement |
| Left Inspector global fixtures visible next to live selections | User interpreted fixtures as explaining live selection |
| Explore CTA still opened Movement tab with unrelated content | Regressed conversation honesty |
| PO lost coherent language/cards that reference mode provides | Product worse despite more live data |

**Correct sequencing:** object graph → evidence pointer → hero → delta log → inspector feed → surface headers → primary actions.

---

## Cross-surface accepted behaviours (even if P1/P2)

Documented as **accepted for now** — live replacement optional later:

| Surface | Accepted reference behaviour | Audit tag |
|---------|------------------------------|-----------|
| **TopBar** | "Model moved · 4 places" → Map; "Synced 2h ago" → Timeline + select `t1` | P0-2 honesty follow-up |
| **Map** | Reference header stats (243 / 7) with reference categories | P0-4 |
| **Timeline** | Mock `GROUPS` when not production | P1-3 |
| **Decisions** | Reference list groups; some actions disabled in production mode | P1-2, P1-8 |
| **Overlays** | Capture/Search use reference object catalog | P1-5 |
| **Primary actions (reference)** | All select `d1` | P1 (accepted quirk) |

These do not block documenting reference contract; they block **production-ready** claims.

---

## Verification expectations for future slices

Each implementation slice must:

1. Pass existing guard suites (hard-swap, quarantine, free-explore honesty)
2. Add behaviour tests asserting click → Inspector/report parity
3. Include PO runtime script mirroring reference affordances
4. Update engineering ledger only after runtime pass

---

## Production-ready: NO

Reference behaviour is the product contract at `8938091`. Live-data work remains incremental substitution with parity gates — not wholesale presentation swaps.
