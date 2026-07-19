# 00 — Intake and boundaries

## Campaign

`SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001`

## Repository / branch / baseline

| Field | Value |
|-------|-------|
| Worktree | `/Users/user/ai-companion-worktrees/desktop-single-real-import-materialisation-proof-001` |
| Branch | `desktop-single-real-import-materialisation-proof-001` |
| HEAD | `7d025bf961d9615f9a9b4adb1bc73c6f70776cbd` |
| Baseline | staging @ `7d025bf` (PR #138 merge) |
| Match | **Exact** — HEAD equals baseline |

## Phase

**Phase 1 — read-only preflight** for one controlled genuine-candidate acceptance test.

## Purpose

Identify exactly three safe, provider-visible `ReferenceItem` candidates Kay may later choose among — **without accepting, rejecting, or mutating anything**.

## Confirmed landed state (intake)

From prior PR #138 + this read-only re-query:

- 54 genuine pending import candidates visible in canonical Import
- 29 `ReferenceItem` + 25 `ContradictionNode`
- Provenance visible; synthetic ic1–ic4 absent from production query
- Kay has not accepted or rejected any candidate
- Isolated accept/reject/materialisation tests pass
- Genuine-account materialisation **not** yet proven
- Production readiness remains **NO**

## Operating boundaries (enforced this phase)

| Boundary | Status |
|----------|--------|
| No commit / push / PR / merge | Observed |
| No accept or reject of Kay’s real candidates | Observed |
| No mutate Kay’s database records | Observed |
| No bulk process candidates | Observed |
| No clean synthetic reference data | Observed |
| No ChatGPT upload interface | Observed |
| No rewrite of import-review unless proven defect | Observed (none found) |
| No select a candidate on Kay’s behalf | Observed — shortlist only |
| Isolated automated proof ≠ genuine account proof | Observed |
| Preserve 7 PatternClaims, imported UserMap, ModelUpdate | Observed |
| Production readiness remains NO | Observed |

## Allowed this phase

- Read-only DB queries against Kay’s account
- Provider/adapter code tracing
- Duplicate checks against existing typed objects
- Receipts + read-only before-state script (no write ops)

## Forbidden this phase

- Any `update` / `create` / `delete` against Kay’s data
- Instructing Kay to press Accept
- Claiming genuine-account materialisation proven
