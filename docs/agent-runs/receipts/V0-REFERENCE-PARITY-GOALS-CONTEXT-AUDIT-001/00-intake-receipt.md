# Intake Receipt

## Request
Audit the staging app against the v0/reference workbench for functional parity and intelligence-context gaps.

## Start State
- `staging` was current.
- `origin/staging` was already up to date.
- Branch created: `v0-reference-parity-goals-context-audit-001`.
- Worktree was clean before audit receipts were written.

## Scope Locks
- Audit only.
- Receipts only under `docs/agent-runs/receipts/V0-REFERENCE-PARITY-GOALS-CONTEXT-AUDIT-001/`.
- No source code, test, schema, middleware, route, generation, or styling changes.
- No repair code will be added in this slice.

## Contract Assumptions
- Orvek is a private intelligence system.
- Model Goals and Mind Context must be inspectable, correctable, and evidence-linked if used.
- Facts require receipts.
- Inferences require supporting receipts and confidence rationale.

## Audit Focus
- Reference parity gaps.
- Model Goals gaps.
- Mind Context / Context Profile gaps.
- Surface responsibility gaps.
- Evidence and receipt gaps.
