# Orvek Visual Acceptance

> **Mode:** human-led product gate (Kay); agent prepares scorecard inputs
> **Input:** golden object + `07-product-intelligence-scorecard.md` + chapter slice receipts

After slice PR: Kay runs screenshots before merge. Automation **never** claims PASS.

---

## Purpose

Decide whether a slice is **product-acceptable** on a **golden object**. Feeds Product Intelligence Benchmark — separate from CI.

**No PASS without scorecard + this checklist** (or explicit `BLOCKED`).

---

## Setup

| Field | Value |
|-------|-------|
| Slice ID | {SLICE_ID} |
| Golden ID | {GOLDEN-INSPECTOR-001} |
| Branch | {branch} |
| Record ids | {movement, affected object} |
| Reference surface | v0 inspector formula (`UserMapEvidencePanel`) |
| Intelligence bar | Reality-Tracking / Z.ai movement report |

---

## Intelligence questions (golden object)

- [ ] User can tell **what changed**
- [ ] User can tell **why Orvek believes it**
- [ ] User can **inspect receipts**
- [ ] **Facts / inferences / uncertainties / speculations** separated (Movement tab)
- [ ] Clear **what to watch/do next**
- [ ] Clear **what would change this conclusion**
- [ ] UI feels **intentional**, not dumped
- [ ] **Routes/navigation** preserved (no legacy Patterns page)

---

## Compare — reference (pillar 1)

- [ ] Section order matches target UI spec
- [ ] Visual language matches v0 direct map inspector
- [ ] Tab roles clear (Evidence vs Movement)

---

## Compare — intelligence (pillar 2)

- [ ] Evidence-backed tone; no therapy/motivational fog
- [ ] Thin packet = honest uncertainty
- [ ] No placeholder labels in production UI
- [ ] Movement read useful to a human (Z.ai bar)

---

## Regression check (required)

| Gate ID | Previously PASS | Now | Regression? |
|---------|-----------------|-----|-------------|
| {from golden-objects.md} | | | |

**Any regression:** {yes | no} → if yes, **no product progress claim**

---

## Product Intelligence Score (0–5)

**Before:** {n} → **After:** {n}

| Score | Select if |
|-------|-----------|
| 0–2 | See `product-intelligence-benchmark.md` |
| 3+ | Coherent or better on golden object |

**Rationale:** {paragraph}

---

## Time spent (Kay)

| Activity | Minutes |
|----------|---------|
| Screenshots / clicks | |
| Reference + intelligence review | |
| Manual orchestration (re-explaining to agent) | |
| **Total** | |

**Manual orchestration level (0–5):** {n}

---

## Classification

**{PASS | PARTIAL | FAIL | BLOCKED}**

---

## Output

- Update `07-product-intelligence-scorecard.md`
- Save optional copy as `docs/agent-runs/runs/{SLICE_ID}/05-product-acceptance.md`
- Link from `06-closeout-receipt.md`
