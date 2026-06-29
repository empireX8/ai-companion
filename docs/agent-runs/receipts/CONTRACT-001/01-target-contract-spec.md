# Target Contract Spec - CONTRACT-001

**Date:** 2026-06-29  
**Rule:** Synthesize reference + contract. Do not widen scope beyond the report contract.

---

## Surfaces in Scope

| Surface | Role |
|---------|------|
| `lib/what-changed-reality-report.ts` | Deterministic Reality-Tracking report assembly and guardrail routing |
| `lib/reality-tracking-output-contract.ts` | Shared report status and section contract |
| `lib/__tests__/what-changed-reality-report.test.ts` | Regression coverage for new report behavior |
| `lib/__tests__/what-changed-detail-route.test.ts` | Route fixture alignment for the active gate wording |

---

## Reference Gets Right

- Existing report section topology is stable and should remain intact.
- The What Changed route is a thin delegate and should stay read-only.
- Current tests already cover traceability and banned-language hygiene.

---

## Contract / Reality-Tracking Requires

- Identity labels must not be accepted as conclusions.
- New generated evidence status values must use `VERIFIED`, `INFERRED`, or `UNVERIFIED`.
- Legacy `mixed` remains compatible if already stored, but new output must not emit it.
- The reality gate must say `REALITY GATE: PENDING EVIDENCE`.
- Facts and strongly supported claims must remain evidence-bound; unsupported claims should be downgraded or omitted.

---

## Section List (Target)

| Section | Content | Must not show |
|---------|---------|---------------|
| `facts` | Observed packet facts and identity-label rejection framing | Unsupported trait conclusions |
| `stronglySupportedClaims` | Evidence-bound model read when support is strong enough | Identity conclusions |
| `inferences` | Careful model movement and context inference | Unsupported certainty |
| `speculations` | Explicit uncertainty only | Deep cause claims without evidence |
| `overreachGuardrails` | Identity, diagnosis, and validation guardrails | Passive filler |
| `loopPatternDetection` | Repeat-loop observations | Identity framing |
| `modelMovement` | Stored before/after movement summary | Hidden reasoning |
| `realityGate` | Active pending-evidence gate | `No stronger reality gate is available...` |
| `fieldworkWatchFor` | Next behavioral evidence to collect | Identity re-labeling |
| `reentryAction` | What to inspect before revising again | Trait certainty |
| `whatWouldChangeThisConclusion` | Evidence that would change the conclusion | Empty vagueness |

---

## Navigation Contract

| Linked type | Behavior |
|-------------|----------|
| none | No navigation or route changes in this slice |

**Forbidden:** layout changes, schema changes, route rewrites.

---

## Kay Sign-off

- [x] Contract boundary approved
- [x] Implementation can start

**Approved to implement:** yes

