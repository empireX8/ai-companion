# Orvek AI Build Loop — Agent Runs

> **v0.1 harness** + **Product Intelligence Benchmark (LOOP-002)**

---

## Purpose

MindLab slices fail in two different ways:

1. **Product wrong** — tests pass, screenshots fail (generic labels, legacy routes, confusing tabs).
2. **Loop wrong** — Kay re-explains intake, spec, wiring, verification, and acceptance every time.

This folder holds:

- **Loop structure** — queue, receipts, prompts, mechanical checks
- **Product Intelligence Benchmark** — golden objects + scorecards so progress is measured on fixed anchors, not agent optimism

---

## Two scores (do not conflate)

### Product Intelligence Score (0–5)

> Same rubric as **Product Surface Score**. Use when scoring golden objects.

| Score | Meaning |
|-------|---------|
| **0** | Broken — crashes, missing data, bad routes |
| **1** | Technically wired — data/tests pass, human value poor |
| **2** | Inspectable — evidence links, routes, object details work |
| **3** | Coherent — tabs have clear roles; no duplicate/confusing sections |
| **4** | Reference-aligned — matches local v0 visual formula |
| **5** | Intelligence-grade — sharp, evidence-backed, human-readable (Z.ai / Reality-Tracking bar) |

Full benchmark: `product-intelligence-benchmark.md` · Fixed anchors: `golden-objects.md`

### Build Loop Score (0–5)

| Score | Meaning |
|-------|---------|
| **0** | Kay manually orchestrates every step |
| **1** | Receipt templates exist; Kay still drives every phase transition |
| **2** | Agent produces intake/spec/wiring automatically; **stops at screenshot gate** |
| **3** | Agent review/fix loop (1–2 rounds) before human stop |
| **4** | Agent runs queued slice end-to-end; stops only for screenshots + commit |
| **5** | Agent batches multiple queued slices; Kay does batch screenshot review |

---

## Hard rules

- **No PASS without product acceptance** — scorecard + Kay sign-off (or explicit `BLOCKED`).
- **Tests are necessary, not sufficient** — green CI ≠ intelligence-grade.
- **No product progress if golden object regressed** — see regression rule in benchmark doc.
- **Every slice leaves receipts** — templates in `templates/`; runs optional under `docs/agent-runs/runs/`.
- **Bounded scope** — one slice from `slice-queue.md` at a time.

---

## Workflow

```
Pick slice from slice-queue.md
  → 00 intake (+ planned score prediction)
  → 01 target UI/spec
  → 02 wiring matrix
  → 03 implementation receipt
  → 04 verification receipt
  → audit (orvek-auditor.md)
  → 07 product intelligence scorecard  ← benchmark (golden object)
  → 05 product acceptance (Kay)
  → 06 closeout receipt
  → update slice-queue status
```

**Prompts:** `prompts/orvek-slice-runner.md`, `prompts/orvek-auditor.md`, `prompts/orvek-visual-acceptance.md`

**Mechanical checks:**

```bash
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-agent-closeout.ts path/to/06-closeout-receipt.md
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-legacy-inspector-routes.ts
```

---

## Related docs

- `product-intelligence-benchmark.md` — pillars, regression rule, anti-fake-progress
- `golden-objects.md` — GOLDEN-INSPECTOR-001 and future anchors
- `slice-queue.md` — active queue
- `AGENTS.md` — hard rules
- `docs/agent-workflow.md` — implement → audit → verify → closeout
