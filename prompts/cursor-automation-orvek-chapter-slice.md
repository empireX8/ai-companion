# Cursor Automation: orvek-chapter-slice

> **Paste this entire file into Cursor Automations.**  
> **Name:** `orvek-chapter-slice`  
> **Trigger:** Manual  
> **Do not merge.**

---

## Automation config

| Setting | Value |
|---------|--------|
| **Name** | `orvek-chapter-slice` |
| **Trigger** | Manual |
| **Base branch** | `staging` if it exists; otherwise **stop** and report: Kay must create `staging` or `integration` from `main` before automation runs |
| **Working branch** | `chapter-{CHAPTER_ID}/slice-{SLICE_ID}` |
| **One slice per run** | Yes — one slice only; never start a second slice |
| **Merge** | **Never** |

---

## Your job

Run **one chapter-slice** pre-PR pipeline for Orvek / MindLab:

1. Pick the next slice from the chapter queue
2. Produce intake, target UI spec, and wiring matrix
3. **Stop for Kay spec/wiring approval** (unless chapter is pre-approved `Ready`)
4. Implement bounded scope only
5. Verify (max **3** attempts)
6. Audit + product intelligence scorecard
7. Push branch and open PR to `staging` (or integration) if possible
8. Update chapter queue + closeout
9. **Stop** — do not merge; Kay handles screenshots and merge

---

## Read first (in order)

1. `docs/agent-runs/chapter-queue.md`
2. `docs/agent-runs/golden-objects.md`
3. `docs/agent-runs/product-intelligence-benchmark.md`
4. `docs/agent-runs/templates/` — receipts 00 through 07
5. `prompts/orvek-chapter-runner.md`
6. `prompts/orvek-slice-runner.md`
7. `AGENTS.md`

---

## Chapter / slice selection

- Chapter: first **In Progress**, else first **Ready**
- Slice: first not **Done** / **Skipped**
- Example chapter: `CHAPTER-INSPECTOR-001` on `GOLDEN-INSPECTOR-001` (score 2 → 3)
- No priority algorithm — queue order is Kay's

---

## Allowed edits

- Files listed in current slice **wiring matrix** (`02-wiring-matrix.md`)
- Receipts under `docs/agent-runs/receipts/{CHAPTER_ID}/{SLICE_ID}/`
- Tests for current slice behavior only
- `docs/agent-runs/chapter-queue.md` — status updates for current chapter/slice only

---

## Not allowed

- Unrelated product UI
- Schema changes unless explicit in wiring matrix
- Other chapters or other slices
- `main` direct commits
- Merge
- Editing harness files unless the active slice is a LOOP-* meta slice
- Claiming **PASS** without Kay **screenshot / product acceptance**

---

## Hard limits

| Limit | Action |
|-------|--------|
| **800 lines** per slice PR diff | Stop; request split |
| **15 files** touched cumulative in chapter | Stop |
| **3** failed verification runs per slice | Stop |
| **4** slices without golden object score movement | Close chapter **PARTIAL** |
| Scope outside wiring matrix | Stop |

---

## Receipt output path

```
docs/agent-runs/receipts/{CHAPTER_ID}/{SLICE_ID}/
```

Fill: 00 intake, 01 target UI spec, 02 wiring matrix, 03 implementation, 04 verification, 07 scorecard, 06 closeout.  
Kay fills 05 product acceptance after screenshots.

---

## Verification commands

```bash
git diff --check
npx tsc --noEmit
npx vitest run {targeted tests from wiring matrix}
npm run build
bash scripts/verify-mindlab.sh
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-legacy-inspector-routes.ts
```

Retry verification up to **3** times; then stop.

---

## Stops (mandatory)

1. **After intake + spec + wiring** — wait for Kay approval unless chapter charter pre-approved
2. **After implementation + verification + PR** — hand off to Kay / Graptile
3. **After 3 verification failures**
4. **If line or file limits exceeded**
5. **Never** merge or claim product PASS without Kay screenshot acceptance

---

## PR

```bash
git checkout -b chapter-{CHAPTER_ID}/slice-{SLICE_ID}
# ... work ...
git push -u origin chapter-{CHAPTER_ID}/slice-{SLICE_ID}
gh pr create --base staging --title "[{CHAPTER_ID}/{SLICE_ID}] {short title}" --body "..."
```

PR body must link:

- Golden object id
- Receipt folder path
- Scorecard target (e.g. 2 → 3)
- Screenshot checklist for Kay
- Classification: PARTIAL or BLOCKED until Kay accepts

---

## Output summary (end of run)

Report:

- Chapter ID + Slice ID
- Branch name + PR URL (if created)
- Files changed (count + list)
- Verification results (attempt N of 3)
- Golden object tested
- Product Intelligence Score expected movement
- **Classification:** PARTIAL | BLOCKED | FAIL (not PASS until Kay)
- What Kay must do next: spec approval / screenshots / merge

---

## Responsibility reminder

| Actor | Owns |
|-------|------|
| **This automation** | Intake, spec, wiring, bounded impl, verify, local audit, push, PR |
| **Graptile / Grep Loop** | PR review, review/fix cycle, edge/security |
| **Kay** | Queue order, spec approval, screenshot acceptance, product score, merge, chapter closeout |
| **ChatGPT / Z.ai** | Adversarial benchmark review, automation critique, target spec critique |

---

## Automation level

**Level 1** — one chapter-slice pre-PR (this prompt).  
Do not attempt Level 2 (multi-slice chapter) or Level 3 (external review loop integration) in this run.
