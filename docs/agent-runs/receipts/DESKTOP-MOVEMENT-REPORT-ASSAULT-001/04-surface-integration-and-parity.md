# Checkpoint 4 — Surface Integration and Parity

**Result:** **PASS WITH RISKS**

---

## Shared hydration wiring

| Surface | Integration |
|---|---|
| **Hybrid hook** | Fetches `/api/today/movement-depth`; passes `movementDepthById` to Today + Timeline APIs |
| **Today adapter** | Delta log uses stored before/after; report slot uses live `modelUpdateId` when report ready |
| **Today production API** | Enriches model-update objects; registers report-ready objects at same id |
| **Timeline adapter** | Stops inferring after from `userFacingSummary`; uses depth index |
| **Timeline production API** | Registers model-update inspector objects + movement depth |
| **Report overlay** | Handles live movement report objects; Inspector handoff button |
| **Inspector** | Unchanged route — `/api/what-changed/[id]` + movement tab via existing bridge |

**Layouts:** **NOT redesigned**

---

## Honest empty states

| Case | Behavior |
|---|---|
| Missing before/after | See why / movement row / report CTA withheld |
| Missing rationale | Report readiness blocked; no fabricated why text |
| Sparse update | Timeline shows null before + prior-read-unavailable copy |
| Reference `rep-weekly` | Stripped when no live report object |

---

## Updated parity reclassification (movement/report units)

### 45-state surface inventory (movement/report related)

| State | Before | After |
|---|---|---|
| Today — delta log before/after | FALLBACK / blocked | **PARTIAL** when depth API returns snapshots |
| Today — full report CTA | FALLBACK (`rep-weekly` slot) | **PARTIAL** when canonical report ready |
| Today — See why moved | blocked without snapshots | **PARTIAL** with recorded before+after |
| Timeline — model change before/after | MOCK-like (summary as after) | **PARTIAL** honest null or stored |
| Inspector — model update movement | PARTIAL (empty before/after) | **PARTIAL+** when snapshots stored |
| Report overlay — live object | FALLBACK zip only | **PARTIAL** via model update id |

**Wholly LIVE:** still **0 / 45** (report readiness requires rationale + evidence + browser proof)

### Inspector coverage (35 units) — movement/report touch

| Unit | Before | After |
|---|---|---|
| model-update (#21) | PARTIAL | **PARTIAL+** (stored snapshots + rationale path) |
| timeline-event / Model Update (#23) | PARTIAL | **PARTIAL+** |
| report / What Changed (#4) | PARTIAL (reference) | **PARTIAL** (live id path exists; reference unchanged) |

**Inspector totals:** PASS **0** | PARTIAL **30+** | FAIL **1** | UNPROVEN **4**

---

## Checkpoint verdict

**PASS WITH RISKS** — shared capability advances Today, Timeline, Inspector, and report overlay together; browser replay and reference report types remain partial.
