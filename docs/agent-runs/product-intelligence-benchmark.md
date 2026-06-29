# Product Intelligence Benchmark

> **LOOP-002** — objective measure of whether Orvek surfaces are becoming more human-readable, evidence-backed, and Z.ai-level useful.

---

## Why this exists

LOOP-001 measures whether the **build workflow ran** (receipts, verification, screenshot gate).

The Product Intelligence Benchmark measures whether the **product actually improved** on fixed anchors — not whether an agent *claims* progress.

**Green CI is necessary, not sufficient.**

---

## Product Intelligence Score (0–5)

Same rubric as **Product Surface Score** in `README.md`. Use this name when scoring golden objects and intelligence quality.

| Score | Name | Meaning |
|-------|------|---------|
| **0** | Broken | Crashes, missing data, bad routes |
| **1** | Technically wired | Data appears / tests pass; human value poor |
| **2** | Inspectable | Evidence links, routes, object details work |
| **3** | Coherent | Tabs have clear roles; no duplicate/confusing sections |
| **4** | Reference-aligned | Matches local v0 visual formula enough to feel intentional |
| **5** | Intelligence-grade | Close to strong Z.ai output — useful, sharp, evidence-backed, human-readable |

---

## Four measurement pillars

Every product slice is scored against:

| Pillar | Standard | Source |
|--------|----------|--------|
| **1. Reference surface** | Visual/layout formula — section order, cards, labels, spacing | Local v0 reference UI (synthesize; do not blind-copy when Reality-Tracking differs) |
| **2. Intelligence bar** | Epistemic quality — facts vs inference, uncertainty, watch-for, change conditions | Z.ai Reality-Tracking output contract + `lib/reality-tracking-output-contract.ts` |
| **3. Backend truth** | Claims trace to stored evidence; no fake/static insight | Real DB / authenticated APIs on golden object ids |
| **4. Golden object set** | Repeatable comparison across slices | `golden-objects.md` |

---

## Workflow integration

```
00 intake (+ planned score prediction)
01 target UI/spec
02 wiring matrix
03 implement
04 verify
07 product intelligence scorecard  ← benchmark gate (agent + Kay)
05 product acceptance               ← Kay sign-off
06 closeout                         ← must cite golden object + regression
```

Fill `07-product-intelligence-scorecard.md` **before** claiming product progress. Link golden object ids from `golden-objects.md`.

**Chapters (LOOP-003):** A full score step (e.g. 2 → 3) is a **chapter** in `chapter-queue.md`, composed of ≤ 4 slices. Score the golden object at chapter closeout, not only per-slice optimism.

---

## Regression rule (hard)

If any **previously passing gate** on a golden object fails in the current slice:

- Mark **Regression: yes**
- **Do not claim product progress** for that slice — even if another dimension improved
- Document in scorecard + closeout
- Classification caps at **PARTIAL** until regression cleared

---

## Planned slice prediction (pre-implementation)

Before coding, every product slice must state:

| Field | Content |
|-------|---------|
| Expected Product Intelligence Score movement | e.g. 2 → 3 |
| Expected Build Loop Score movement | e.g. 1 → 2 |
| Why this slice should move the score | {hypothesis} |
| What would prove the slice failed | {observable failures} |

Record in `00-intake-receipt.md` and `07-product-intelligence-scorecard.md`.

---

## What prevents fake progress

| Failure mode | Benchmark counter |
|--------------|-------------------|
| Tests pass, UI generic | Golden object screenshot + intelligence questions |
| Data fetched, labels wrong | Scorecard: “why Orvek believes it” |
| One tab fixed, other regressed | Regression tracking on prior gates |
| Agent claims PASS without Kay | 05 + scorecard screenshot proof status |
| Reference copied blindly | Pillar 1 + 2 synthesis in target UI spec |
| Mock insight | Pillar 3 data-path proof on real ids |

---

## Related files

- `chapter-queue.md` — chapter = one score level on one golden object
- `golden-objects.md` — fixed test cases
- `templates/07-product-intelligence-scorecard.md` — per-slice scorecard
- `prompts/orvek-visual-acceptance.md` — Kay checklist (feeds scorecard)
- `prompts/cursor-automation-orvek-chapter-slice.md` — Cursor Automation prompt
- `scripts/check-agent-closeout.ts` — closeout heading enforcement
