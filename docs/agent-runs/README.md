# Orvek AI Build Loop — Agent Runs

> **Harness v0.1** · **Product Intelligence Benchmark (LOOP-002)** · **Chapter queue (LOOP-003)**

---

## Purpose

MindLab product work runs as **chapters** — one golden object, one score level, bounded slices — not random one-off fixes.

| Failure | Harness response |
|---------|------------------|
| Product wrong (tests green, UI bad) | Golden object + scorecard |
| Loop wrong (Kay re-orchestrates everything) | Receipts + chapter automation |
| Fake progress | Regression rule + Kay acceptance |

---

## Two scores

### Product Intelligence Score (0–5)

| Score | Meaning |
|-------|---------|
| **0** | Broken |
| **1** | Technically wired |
| **2** | Inspectable |
| **3** | Coherent |
| **4** | Reference-aligned |
| **5** | Intelligence-grade (Z.ai / Reality-Tracking bar) |

`product-intelligence-benchmark.md` · `golden-objects.md`

### Build Loop Score (0–5)

| Score | Meaning |
|-------|---------|
| **0** | Kay orchestrates everything |
| **1** | Templates exist |
| **2** | Agent produces receipts; stops at screenshot gate |
| **3** | 1–2 audit/fix rounds before human |
| **4** | Queued slice end-to-end; stops for screenshots + commit |
| **5** | Batch screenshot review |

---

## Chapter model (LOOP-003)

> **A chapter** = one golden object moved **one** Product Intelligence Score level.

Example: `CHAPTER-INSPECTOR-001` moves `GOLDEN-INSPECTOR-001` from **2 → 3**.

**Primary queue:** `chapter-queue.md`
**Cursor Automation:** `prompts/cursor-automation-orvek-chapter-slice.md` (manual trigger, pre-PR only)

---

## Responsibility split

| Actor | Owns |
|-------|------|
| **Cursor Automation** | Intake, spec, wiring, bounded implementation, verification, local audit, push branch, open PR |
| **Graptile / Grep Loop** | PR review, review/fix/review cycle, edge/security review |
| **Kay** | Queue order, spec/wiring approval, screenshot acceptance, product score, merge, chapter closeout |
| **ChatGPT / Z.ai** | Adversarial benchmark review, automation design critique, target spec critique |

---

## Automation levels

| Level | Scope | When |
|-------|-------|------|
| **1** | One chapter-slice pre-PR | **Target now** |
| **2** | Full chapter across bounded slices | After Level 1 completes 3 real slices |
| **3** | External review-loop integration | After Level 2 completes one full chapter |

---

## Workflow (one slice)

```
chapter-queue.md → pick chapter + slice
  → receipts/00–02 (stop for Kay spec approval)
  → implement → 03–04
  → audit + 07 scorecard
  → push + PR (stop — no merge)
  → Kay screenshots + 05 acceptance
  → 06 closeout → update chapter-queue
```

**Prompts:** `orvek-chapter-runner.md`, `orvek-slice-runner.md`, `orvek-auditor.md`, `orvek-visual-acceptance.md`

**Mechanical checks:**

```bash
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-agent-closeout.ts path/to/06-closeout-receipt.md
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-legacy-inspector-routes.ts
```

---

## Hard rules

- No PASS without Kay product acceptance + scorecard
- Tests necessary, not sufficient
- No product progress if golden object regressed
- Max 800 lines / slice PR; max 4 slices / chapter; max 3 verify failures / slice
- **Never merge from automation**

---

## Related docs

- `chapter-queue.md` — **primary product queue**
- `slice-queue.md` — legacy / LOOP meta-slices only
- `golden-objects.md` · `product-intelligence-benchmark.md`
- `AGENTS.md` · `docs/agent-workflow.md`
