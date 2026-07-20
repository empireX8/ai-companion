# 06 — Versioning decision

## Decision

| Constant | Action | Rationale |
|----------|--------|-----------|
| `OBJECTIVITY_REFEREE_INTERFACE_VERSION` | **Introduced** as `objectivity-referee-interface-v1` | New inspectable referee contract surface |
| `KERNEL_CONTRACT_VERSION` | **Unchanged** `orvek-intelligence-kernel-v1` | Shared kernel I/O envelope unchanged; referee result added on contradiction adjudication envelope without rewriting core KernelAdjudicationResult fields required by other objects |
| Contradiction schema version | Unchanged v1 | No model-output schema change |
| Contradiction prompt version | Unchanged v2 | No prompt change |

## Justification

Kernel contract version was **not** casually bumped merely because tests were added.

A dedicated referee interface version is required so audit receipts can record which referee contract validated an evaluation, independently of contradiction prompt/schema evolution.

`RefereeStatus` gained `execution_failed` and `invalid_evaluation` as summary values for audit compatibility; full fidelity lives in `ObjectivityRefereeResult.executionState`.
