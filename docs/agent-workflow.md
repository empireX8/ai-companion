# Agent Workflow — MindLab Operating Loop

> This document defines the standard operating loop for agent-driven development in the MindLab repo.

---

## The Loop

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Kay defines architecture / task                       │
│         │                                               │
│         ▼                                               │
│   Agent implements bounded slice                        │
│         │                                               │
│         ▼                                               │
│   Audit agent reviews git diff                          │
│         │                                               │
│         ▼                                               │
│   Verification runs (tsc, tests, build, checks)         │
│         │                                               │
│         ▼                                               │
│   Closeout ledger records truth                         │
│         │                                               │
│         ▼                                               │
│   Kay merges only if clean                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step

### 1. Kay Defines Architecture

Kay provides:
- A named phase or task (e.g. "Phase 2I — Candidate Lifecycle Schema Design")
- The exact scope: files to create/modify, allowed changes, forbidden changes
- Product context and constraints
- Verification criteria

The **Architect Agent** may be used to refine this into a bounded implementation slice.

### 2. Agent Implements Bounded Slice

The **Implementation Agent**:
- Reads the architect's slice definition
- Makes the smallest sufficient change
- Adds or updates tests when appropriate
- Does not touch files outside the slice
- Does not refactor unrelated code
- Runs verification before signalling completion

### 3. Audit Agent Reviews Diff

The **Audit Agent**:
- Reads the current `git diff` (uncommitted changes only)
- Checks for:
  - **Scope compliance:** files changed outside the named slice
  - **Product drift:** changes that violate MindLab's product truth
  - **Fake/static output:** mock insight or placeholder data
  - **Evidence-gate bypass:** claims not traceable to stored evidence
  - **No-write violations:** schema, route, or surface changes without permission
  - **Unrelated changes:** refactors, formatting, or cleanup outside scope
  - **Test quality:** new tests are meaningful, not tautological
- Returns `PASS`, `FAIL`, or `PASS WITH RISKS`
- On `FAIL`, provides a repair prompt

### 4. Verification Runs

The agent runs the standard verification suite:

```bash
git diff --check          # No whitespace errors
npx tsc --noEmit          # TypeScript compiles cleanly
npx vitest run            # All tests pass
npm run build             # Production build succeeds
bash scripts/check-trust-language.sh   # No banned product language
bash scripts/check-legacy-surfaces.sh  # Legacy surfaces are clean
```

Or run the full gate in one command (`npm run verify` is an alias for `bash scripts/verify-mindlab.sh`):

```bash
npm run verify
```

If any step fails, the **Test Repair Agent** fixes only the verification failure — no scope expansion.

### 5. Closeout Ledger Records Truth

The **Closeout Agent** writes a factual entry to `docs/engineering-ledger.md`:
- Phase name
- Files changed (list)
- Verification results (pass/fail per command)
- What remains partial or incomplete
- Next exact step

No exaggeration. No speculation.

### 6. Kay Merges Only If Clean

Kay reviews the closeout entry and the diff. Merge happens only if:
- All verification steps pass
- Audit returned `PASS` or `PASS WITH RISKS` (with acknowledged risks)
- The closeout entry is accurate

---

## When Things Go Wrong

| Situation | Response |
|-----------|----------|
| Audit returns `FAIL` | Implementer or test-fixer repairs, then re-audit |
| Verification fails | Test Repair Agent fixes only the failure |
| Scope creep detected | Revert out-of-scope changes, re-slice |
| Product drift detected | Architect re-evaluates, Kay decides |

---

## Agent Handoff Format

When one agent hands off to another, the handoff includes:

```
PHASE: <name>
SLICE: <exact files and changes>
ALLOWED: <what is permitted>
FORBIDDEN: <what is not permitted>
VERIFICATION: <commands to run>
CONTEXT: <relevant docs, code references>
```

This ensures no ambiguity between agents.
