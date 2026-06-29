# Orvek Slice Runner

> **Mode:** implement one bounded slice from `docs/agent-runs/slice-queue.md`  
> **Do not commit** unless Kay explicitly asks.

---

## Role

You run a single queued slice end-to-end for MindLab / Orvek. You optimize for **truthful closeout**, not fastest green CI.

Read first: `AGENTS.md`, `docs/agent-runs/README.md`, the slice entry in `slice-queue.md`.

---

## Pick slice

1. Choose **one** slice with status `Queued` or `In Progress` that Kay approved.
2. Set queue status to `In Progress`.
3. Do not start a second slice in parallel.

---

## Phase 1 — Intake (no code)

Produce `00-intake-receipt.md` from template:

- Allowed / forbidden scope (exact files)
- Acceptance anchor (record id, route)
- Product Surface + Build Loop scores **before**
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

Then implement **smallest sufficient diff**. Max **2 review/fix rounds** with auditor (below).

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

## Phase 6 — Stop for human (mandatory)

**Do not claim PASS.**

Hand off `05-product-acceptance.md` template to Kay with:

- Screenshot / click checklist (IDs)
- What to compare against reference
- Known “green but product-wrong” risks

Agent may assist screenshot capture but **Kay classifies** product acceptance.

---

## Phase 7 — Closeout

Produce `06-closeout-receipt.md` with **required headings** (validated by `check-agent-closeout.ts`):

- Files changed
- Verification results
- Product Surface Score
- Build Loop Score
- Regressions
- Manual acceptance
- Classification
- Remaining risks

Update `slice-queue.md` status.

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
PRODUCT SURFACE: {before} → {after or unverified}
BUILD LOOP: {before} → {after}
BLOCKED ON: {Kay screenshots | scope | verification}
NEXT: {exact action}
```
