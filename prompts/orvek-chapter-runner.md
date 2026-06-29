# Orvek Chapter Runner

> **Mode:** run one slice inside one chapter from `docs/agent-runs/chapter-queue.md`  
> **Do not merge.** Stop at PR boundary.

---

## Role

You advance a **chapter** by completing **one slice** end-to-end (pre-PR). You do not run multiple slices or multiple chapters in one session unless Kay explicitly overrides.

Read first:

1. `docs/agent-runs/chapter-queue.md`
2. `docs/agent-runs/golden-objects.md`
3. `docs/agent-runs/product-intelligence-benchmark.md`
4. `prompts/orvek-slice-runner.md`

---

## Step 1 — Pick work

| Rule | Action |
|------|--------|
| Chapter | First `In Progress`, else first `Ready` |
| Slice | First slice not `Done` / `Skipped` |
| One slice only | Stop after this slice's PR |

Update chapter queue: slice → `In Progress`.

---

## Step 2 — Branch

```text
chapter-{CHAPTER_ID}/slice-{SLICE_ID}
```

Example: `chapter-CHAPTER-INSPECTOR-001/slice-SLICE-001`

Base branch: `staging` if it exists; else stop and ask Kay to create `staging` or `integration` from `main`.

---

## Step 3 — Receipts

Create directory:

```text
docs/agent-runs/receipts/{CHAPTER_ID}/{SLICE_ID}/
```

Fill templates 00–02 **before code**. Copy from `docs/agent-runs/templates/`.

**Stop 1:** After intake + target UI spec + wiring matrix — wait for Kay spec/wiring approval unless charter pre-approved.

---

## Step 4 — Implement slice

Follow `orvek-slice-runner.md`:

- Bounded scope from wiring matrix only
- Max **800 lines** changed in slice diff — if exceeded, **stop** and request split
- Max **15 files** cumulative in chapter — if exceeded, **stop**
- Max **3** verification failures — then **stop**

Fill `03-implementation-receipt.md` before editing.

---

## Step 5 — Verify

Fill `04-verification-receipt.md`:

```bash
git diff --check
npx tsc --noEmit
npx vitest run {targeted}
npm run build
bash scripts/verify-mindlab.sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-legacy-inspector-routes.ts
```

Count verification failures for this slice (max 3).

---

## Step 6 — Audit + scorecard

- Run `prompts/orvek-auditor.md` on diff (max 2 fix rounds)
- Fill `07-product-intelligence-scorecard.md` for chapter golden object
- **Do not claim PASS** — Kay owns `05-product-acceptance.md`

---

## Step 7 — Push + PR (stop boundary)

```bash
git push -u origin chapter-{CHAPTER_ID}/slice-{SLICE_ID}
gh pr create --base staging --title "..." --body "..."
```

- If `staging` missing: push branch anyway; note in closeout that Kay must open PR manually
- **Do not merge**

**Stop 2:** After PR created (or push + handoff). Kay → Graptile review → screenshots → merge.

---

## Step 8 — Update queue + closeout

Fill `06-closeout-receipt.md` in receipt folder.

Update `chapter-queue.md`:

- Slice status → `Done` or `Blocked` or `Partial`
- Chapter `Slices used` / `Files touched`
- If 4 slices done and score &lt; target → chapter `Partial`
- If Kay confirmed score ≥ target → chapter `Done`

---

## Hard stops summary

| Condition | Action |
|-----------|--------|
| Diff &gt; 800 lines | Stop; split slice |
| Scope outside wiring matrix | Stop |
| 3 verification failures | Stop slice |
| 4 slices, score unchanged | Chapter PARTIAL |
| No Kay acceptance | Classification BLOCKED/PARTIAL only |

---

## Handoff to Kay

```
CHAPTER: {id}
SLICE: {id}
BRANCH: chapter-{chapter}/slice-{slice}
PR: {url or not created}
GOLDEN: {id}
SCORE TARGET: {from} → {to}
VERIFICATION: {pass/fail count}
BLOCKED ON: {spec | screenshots | staging branch}
RECEIPTS: docs/agent-runs/receipts/{chapter}/{slice}/
```
