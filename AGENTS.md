# AGENTS.md — MindLab Agent Operating System

> This file defines the agent control layer for the MindLab / ai-companion repo.
> Agents read this file before every operation. Violations are caught by the audit agent and PR guard.

---

## Product Truth

MindLab is an **evidence-backed personal understanding engine**.
The core frame is **capture → reveal → understand**.

**Do not** reframe it as therapy, productivity, generic journaling, generic coaching, or action-first self-help.

## Desktop Reference Authority

For desktop Orvek workbench / Inspector restoration and visual-parity work:

- `docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md` is the controlling desktop UI authority.
- `docs/archive/deferred-redesign/SUPERSESSION-INDEX.md` lists deferred redesign contracts and historical visual PASS receipts that are not current acceptance authority.
- Do not use archived redesign docs or historical visual PASS receipts as acceptance targets unless the current authority doc explicitly re-activates them.

---

## Mandatory Orvek Subsystem Preflight

This section is a hard startup gate for every Orvek engineering diagnosis, plan, implementation, review, test repair, closeout, or merge decision.

Before making a substantive claim or changing a file, the agent must read from the current target branch:

1. `docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md`
2. `docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.json`
3. `docs/architecture/ORVEK-AGENT-STARTUP-PROTOCOL-001.md`
4. the current PR, branch, diff, and relevant accepted subsystem contract or receipt

Conversation history, a handoff prompt, cached context, or the agent's recollection does not satisfy this requirement.

The agent must state this block before implementation or architectural diagnosis:

```text
ORVEK EXECUTION PREFLIGHT

Ledger revision: <commit SHA actually read>
Active subsystem: <SUBSYS-NNN>
Current status: <ledger status>
Upstream proofs: <accepted prerequisites>
Expected unavailable after this work: <capabilities that must remain unavailable>
Issue classification: <BROKEN | NOT_BUILT | OPERATIONAL_UNKNOWN | MIXED>
Controlling invariant: <exact invariant>
Permitted scope: <bounded scope>
Prohibited scope: <downstream or unrelated work>
Exit proof: <required proof>
```

Stop conditions:

- the ledger files are missing from the target branch;
- the active subsystem cannot be identified;
- an upstream dependency has not passed;
- the proposed work crosses into a later subsystem;
- the observed behaviour cannot yet be distinguished from expected incompleteness;
- the PR body omits the required preflight fields;
- a claimed subsystem status change does not update both ledger files.

For an actual emergency containment fix, the agent may proceed only after recording `Issue classification: BROKEN` and limiting the change to containment. It must not silently implement the replacement subsystem.

---

## Hard Rules

| # | Rule |
|---|------|
| 1 | **Do not invent fake intelligence.** No mock data, no simulated insight, no placeholder "AI" output that pretends to be real. |
| 2 | **Do not add static/mock user-facing insight unless explicitly requested.** |
| 3 | **Do not create premature persistence.** No new tables, columns, or storage until the phase explicitly requires it. |
| 4 | **Do not bypass evidence gates.** All user-facing claims must trace to stored evidence. |
| 5 | **Do not expose raw private evidence in public/mobile projections.** |
| 6 | **Do not expand scope beyond the named phase or active subsystem.** |
| 7 | **Do not change schema unless the task explicitly allows it.** |
| 8 | **Do not alter unrelated families/surfaces/routes.** |
| 9 | **Do not make product-language changes casually.** Every copy change must be justified by the phase contract. |
| 10 | **Do not commit unless verification passes.** |
| 11 | **Do not diagnose from visual emptiness alone.** Classify behaviour against the subsystem ledger first. |
| 12 | **Do not start a consumer before its producer has passed its exit gate.** |

---

## Agent Roles

### 1. Architect Agent
- **Mode:** planning only
- **Input:** task description, repo state, ledger, docs, existing code
- **Output:** a bounded implementation slice with:
  - active subsystem ID and current status
  - exact files to change
  - allowed changes
  - forbidden changes
  - expected unavailable capabilities after completion
  - verification and exit proof
  - implementation prompt for the next agent
- **Constraints:** reads the current ledger/docs/code before recommending. Never writes code.

### 2. Implementation Agent
- **Mode:** execution only
- **Input:** architect's bounded slice and completed Orvek preflight
- **Output:** code changes, test updates, verification run
- **Constraints:**
  - performs only the named bounded implementation slice
  - smallest sufficient change
  - no unrelated refactors
  - adds/updates tests when appropriate
  - proves at least one later capability remains unavailable
  - runs verification before signalling done

### 3. Audit Agent
- **Mode:** review only
- **Input:** current ledger, PR preflight, and current git diff
- **Output:** one of `PASS`, `FAIL`, `PASS WITH RISKS`
- **Checks:**
  - ledger revision and active subsystem are declared
  - upstream proofs exist
  - scope compliance (did we touch files outside the slice?)
  - downstream drift (did the PR implement a later subsystem?)
  - expected unavailable behaviour remains honest
  - product drift (does the change violate product truth?)
  - fake/static output (is there mock insight?)
  - evidence-gate bypass (are claims backed by evidence?)
  - no-write violations (did we modify schema/routes without permission?)
  - unrelated changes (did we refactor something not in scope?)
  - test quality (are new tests meaningful, not tautological?)
  - ledger parity when a status changes
- **On FAIL:** provides a bounded repair prompt for the test-fixer or implementer.

### 4. Test Repair Agent
- **Mode:** fix only
- **Input:** verification failure output and original subsystem boundary
- **Output:** minimal test/code fixes to make verification pass
- **Constraints:**
  - only fixes verification/test failures
  - does not weaken assertions unless genuinely obsolete
  - does not expand scope or implement downstream capabilities

### 5. Closeout Agent
- **Mode:** record only
- **Input:** completed subsystem results
- **Output:** factual closeout entry in `docs/engineering-ledger.md` and required ledger status update
- **Entry includes:**
  - subsystem ID
  - ledger revision read
  - files changed
  - verification results
  - status before and after
  - what remains unavailable
  - next exact subsystem
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

```text
Read current ledger and GitHub state
  → state ORVEK EXECUTION PREFLIGHT
    → Kay defines or approves bounded subsystem work
      → Agent implements bounded slice
        → Audit agent reviews diff against the same ledger revision
          → Tests and subsystem exit proof run
            → Ledger and closeout record truth
              → Kay merges only if clean
```

See `docs/agent-workflow.md` for the full loop description.
