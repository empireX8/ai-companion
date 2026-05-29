# Agent Workflow Smoke Test

This file confirms Cursor can follow the MindLab bounded-slice workflow.

## Operating loop

1. **Kay defines architecture** — phase, slice, allowed/forbidden scope, and verification steps.
2. **Implementation agent** — edits only the bounded slice (smallest sufficient change).
3. **Audit agent** — reviews the uncommitted diff (`PASS` / `FAIL` / `PASS WITH RISKS`).
4. **Test-repair agent** — fixes verification failures within scope when checks fail.
5. **Closeout** — records factual truth in the engineering ledger when requested.
6. **Kay commits** — only when the diff is clean and verification passes.
