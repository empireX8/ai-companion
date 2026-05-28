# AGENTS.md — MindLab Agent Operating System

> This file defines the agent control layer for the MindLab / ai-companion repo.
> Agents read this file before every operation. Violations are caught by the audit agent.

---

## Product Truth

MindLab is an **evidence-backed personal understanding engine**.
The core frame is **capture → reveal → understand**.

**Do not** reframe it as therapy, productivity, generic journaling, generic coaching, or action-first self-help.

---

## Hard Rules

| # | Rule |
|---|------|
| 1 | **Do not invent fake intelligence.** No mock data, no simulated insight, no placeholder "AI" output that pretends to be real. |
| 2 | **Do not add static/mock user-facing insight unless explicitly requested.** |
| 3 | **Do not create premature persistence.** No new tables, columns, or storage until the phase explicitly requires it. |
| 4 | **Do not bypass evidence gates.** All user-facing claims must trace to stored evidence. |
| 5 | **Do not expose raw private evidence in public/mobile projections.** |
| 6 | **Do not expand scope beyond the named phase.** |
| 7 | **Do not change schema unless the task explicitly allows it.** |
| 8 | **Do not alter unrelated families/surfaces/routes.** |
| 9 | **Do not make product-language changes casually.** Every copy change must be justified by the phase contract. |
| 10 | **Do not commit unless verification passes.** |

---

## Agent Roles

### 1. Architect Agent
- **Mode:** planning only
- **Input:** task description, repo state, docs, existing code
- **Output:** a bounded implementation slice with:
  - exact files to change
  - allowed changes
  - forbidden changes
  - verification steps
  - implementation prompt for the next agent
- **Constraints:** reads docs/code before recommending. Never writes code.

### 2. Implementation Agent
- **Mode:** execution only
- **Input:** architect's bounded slice
- **Output:** code changes, test updates, verification run
- **Constraints:**
  - performs only the named bounded implementation slice
  - smallest sufficient change
  - no unrelated refactors
  - adds/updates tests when appropriate
  - runs verification before signalling done

### 3. Audit Agent
- **Mode:** review only
- **Input:** current git diff (uncommitted changes)
- **Output:** one of `PASS`, `FAIL`, `PASS WITH RISKS`
- **Checks:**
  - scope compliance (did we touch files outside the slice?)
  - product drift (does the change violate product truth?)
  - fake/static output (is there mock insight?)
  - evidence-gate bypass (are claims backed by evidence?)
  - no-write violations (did we modify schema/routes without permission?)
  - unrelated changes (did we refactor something not in scope?)
  - test quality (are new tests meaningful, not tautological?)
- **On FAIL:** provides a repair prompt for the test-fixer or implementer.

### 4. Test Repair Agent
- **Mode:** fix only
- **Input:** verification failure output
- **Output:** minimal test/code fixes to make verification pass
- **Constraints:**
  - only fixes verification/test failures
  - does not weaken assertions unless genuinely obsolete
  - does not expand scope

### 5. Closeout Agent
- **Mode:** record only
- **Input:** completed phase results
- **Output:** factual closeout entry in `docs/engineering-ledger.md`
- **Entry includes:**
  - phase name
  - files changed
  - verification results
  - what remains partial
  - next exact step
- **Constraints:** does not exaggerate completion.

---

## Verification Commands

Run these before any commit:

```bash
git diff --check
npx tsc --noEmit
npx vitest run
npm run build
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
```

Or use the convenience script:

```bash
bash scripts/verify-mindlab.sh
```

---

## Operating Loop

```
Kay defines architecture
  → Agent implements bounded slice
    → Audit agent reviews diff
      → Tests run
        → Closeout ledger records truth
          → Kay merges only if clean
```

See `docs/agent-workflow.md` for the full loop description.
