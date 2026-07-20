# 02 — Dependency gap table

Audit completed **before** the narrow patch. Actions reflect the patch applied.

| Requirement | Exists (pre) | Tested (pre) | Gap | Required action |
|-------------|--------------|--------------|-----|-----------------|
| A. Provider independence | Yes — no provider imports | Partial | None material | Preserve; assert in tests |
| B. Exact five-outcome union | Yes | Yes (basic) | None | Preserve |
| C. Execution state vs outcome | **No** — `RefereeStatus` conflated not_run with outcomes; no failed/invalid | **No** | Failed throws escaped; malformed accepted as outcome | Add executionState + failed/invalid; safe wrapper |
| D. Outcome-specific validation | **No** | **No** | adjustedConfidence / routedObjectType / rationale unconstrained | Add `validateObjectivityRefereeEvaluation` |
| E. Semantic non-upgrade | Partial — selection Class-A-only | Partial | Class B/C/D could still invoke referee | Invoke referee only for Class A; explicit B/C/D tests |
| F. Validation order | Yes — referee after validation | Partial | Call-count tests incomplete | Prove call count 0 on invalid semantic/spans |
| G. Zero-or-one non-bypass | Yes in CEQR-004 | Yes | Referee ranking risk unclear | Prove ambiguity ignores PASS winner |
| H. Continuation policy | **No** | **No** | PASS looked like status-only; no named continuation helper | Add `refereeAllowsContinuation` (not persistable) |
| I. Inspectable full evaluation | **No** — only status string | **No** | Rationale/confidence/route discarded | Preserve `ObjectivityRefereeResult` |
| J. Failure handling | **No** try/catch | **No** | Throw could crash pipeline | `runObjectivityRefereeSafely` |
| K. Versioning | **No** referee interface version | **No** | — | Add `OBJECTIVITY_REFEREE_INTERFACE_VERSION`; keep kernel v1 |
| L. Persistence boundary | Yes — null/false/undefined | Yes | Risk of naming confusion | Keep persistable false; continuation ≠ persistence |
| M. CEQR-005 relationship | N/A | N/A | Gate not proven | Satisfy interface dependency only |

## Gate choice after table

**PASS_WITH_NARROW_PATCH** — architecture correct; interface alone insufficient until validation, execution state, failure handling, continuation policy, and inspectability landed.
