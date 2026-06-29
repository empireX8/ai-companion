# Orvek Slice Runner

> **Mode:** implement **one bounded slice** inside a chapter (see `orvek-chapter-runner.md`)
> **Do not commit** unless Kay explicitly asks.

---

## Role

You run a single slice for MindLab / Orvek. In chapter mode, the chapter runner picks the slice; you execute slice phases only.

Read first: `AGENTS.md`, `chapter-queue.md`, `golden-objects.md`, `product-intelligence-benchmark.md`, active receipts in `docs/agent-runs/receipts/{chapter}/{slice}/`.

---

## Pick slice

1. If chapter runner assigned a slice, use that **only**.
2. Else legacy: one entry from `slice-queue.md` (LOOP meta only).
3. Do not start a second slice.

Receipt path: `docs/agent-runs/receipts/{CHAPTER_ID}/{SLICE_ID}/` (create from templates).

---

## Phase 1 — Intake (no code)

Produce `00-intake-receipt.md` from template:

- Allowed / forbidden scope (exact files)
- Acceptance anchor + **golden object id** (from `golden-objects.md`)
- Product Intelligence + Build Loop scores **before**
- **Planned slice prediction** (expected score movement, failure criteria)
- Stop if scope is ambiguous — ask Kay for bounds

---

## Phase 2 — Spec + wiring (no code)

Produce:

- `01-target-ui-spec.md` — synthesize reference + Reality-Tracking; **do not blind-copy v0**
- `02-wiring-matrix.md` — every section → route → component → data status

**Stop** if Kay sign-off required and not given.

---

## Phase 3 — Implement

Produce `03-implementation-receipt.md` **before editing**:

- Files to change
- Root cause / current behavior
- What is explicitly out of scope

Then implement **smallest sufficient diff**. Max **800 lines** per slice PR — stop if exceeded. Max **2** review/fix rounds with auditor.

Verification failures: max **3** attempts per slice, then stop.

---

## Phase 4 — Verify

Produce `04-verification-receipt.md`:

```bash
git diff --check
npx tsc --noEmit
npx vitest run {targeted tests}
npm run build
bash scripts/verify-mindlab.sh
# When applicable:
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-legacy-inspector-routes.ts
```

Run data-path proof for acceptance anchor when slice touches inspector/data.

---

## Phase 5 — Audit loop (max 2 rounds)

Run `prompts/orvek-auditor.md` against `git diff`.

| Result | Action |
|--------|--------|
| PASS | Continue |
| PASS WITH RISKS | Document risks; fix if in scope |
| FAIL | Fix once; re-audit (round 2) |
| FAIL after round 2 | Stop; closeout as FAIL/BLOCKED |

---

## Phase 5b — Product intelligence scorecard (before Kay acceptance)

Produce `07-product-intelligence-scorecard.md` for each **golden object** touched:

- Answer intelligence questions (what changed, why Orvek believes it, receipts, epistemic separation)
- Record regression table vs previously passing gates
- Screenshot proof status (captured / blocked)
- **If any regression: yes** — do not claim product progress

---

## Phase 6 — Stop for human (mandatory)

**Do not claim PASS.**

Hand off `05-product-acceptance.md` + `07-product-intelligence-scorecard.md` to Kay with:

- Screenshot / click checklist (IDs)
- Golden object comparison vs reference + Reality-Tracking bar
- Known “green but product-wrong” risks

Agent may assist screenshot capture but **Kay classifies** product acceptance.

---

## Phase 7 — Closeout

Produce `06-closeout-receipt.md` with **required headings** (validated by `check-agent-closeout.ts`):

- Files changed, Verification results
- Product Intelligence Score, Build Loop Score
- Golden object tested, Screenshot proof status, Regression status
- Time spent, Manual orchestration level
- Regressions, Manual acceptance, Classification, Remaining risks

Update `chapter-queue.md` slice status (and `slice-queue.md` only for LOOP meta-slices).

---

## Hard rules

- No fake intelligence, mock insight, or placeholder “AI” output
- No schema unless slice allows
- No scope creep beyond intake receipt
- **Tests passing ≠ product PASS**
- No legacy route leaks in workbench inspector evidence (see `check-legacy-inspector-routes.ts`)

---

## Handoff format

```
SLICE: {ID}
PHASE: {intake|spec|implement|verify|audit|acceptance|closeout}
STATUS: {in progress|blocked|partial|done}
PRODUCT INTELLIGENCE: {before} → {after or unverified}
BUILD LOOP: {before} → {after}
GOLDEN OBJECT: {id}
REGRESSION: {yes|no}
BLOCKED ON: {Kay screenshots | scope | verification}
NEXT: {exact action}
```
