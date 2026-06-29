# Orvek AI Build Loop — Agent Runs

> **v0.1 harness** — repo-level structure for running bounded product slices without Kay manually orchestrating every phase.

---

## Purpose

MindLab slices fail in two different ways:

1. **Product wrong** — tests pass, screenshots fail (generic labels, legacy routes, confusing tabs).
2. **Loop wrong** — Kay re-explains intake, spec, wiring, verification, and acceptance every time.

This folder holds the **loop structure**: queue, receipt templates, prompts, and mechanical checks so agents produce consistent artifacts and stop at the right gates.

---

## Two scores (do not conflate)

### Product Surface Score (0–5)

| Score | Meaning |
|-------|---------|
| **0** | Broken — crashes, missing data, bad routes |
| **1** | Technically wired — data/tests pass, human value poor |
| **2** | Inspectable — evidence links, routes, object details work |
| **3** | Coherent — tabs have clear roles; no duplicate/confusing sections |
| **4** | Reference-aligned — matches local v0 visual formula |
| **5** | Intelligence-grade — sharp, evidence-backed, human-readable (Z.ai / Reality-Tracking bar) |

### Build Loop Score (0–5)

| Score | Meaning |
|-------|---------|
| **0** | Kay manually orchestrates every step |
| **1** | Receipt templates exist; Kay still drives every phase transition |
| **2** | Agent produces intake/spec/wiring automatically; **stops at screenshot gate** |
| **3** | Agent review/fix loop (1–2 rounds) before human stop |
| **4** | Agent runs queued slice end-to-end; stops only for screenshots + commit |
| **5** | Agent batches multiple queued slices; Kay does batch screenshot review |

**This harness targets Build Loop 2.** Product Surface improves only when slices execute well *and* product acceptance runs.

---

## Hard rules

- **No PASS without product acceptance** — screenshot/click checklist signed by Kay (or explicit `BLOCKED`).
- **Tests are necessary, not sufficient** — green CI does not imply product-acceptable.
- **Every slice leaves receipts** — use templates in `templates/`; store completed runs under `docs/agent-runs/runs/` (optional subfolder per slice).
- **Bounded scope** — one slice from `slice-queue.md` at a time; no scope creep.

---

## Workflow (v0.1)

```
Pick slice from slice-queue.md
  → 00 intake receipt
  → 01 target UI/spec (synthesize reference + contract; do not blind-copy v0)
  → 02 wiring matrix
  → implement (bounded)
  → 03 implementation receipt
  → 04 verification receipt
  → audit (prompts/orvek-auditor.md)
  → 05 product acceptance (Kay — blocking)
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

- `AGENTS.md` — hard rules
- `docs/agent-workflow.md` — implement → audit → verify → closeout
- `docs/agent-runs/slice-queue.md` — active queue
