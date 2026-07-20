# 03 — Deterministic consistency gates

Implemented in `collectSemanticConsistencyErrors` + `requiredPropositionPresent` inside `lib/contradiction-adjudicator.ts`.

**Fail closed. No silent reclassification. No deterministic semantic keyword fallback.**

| Gate | Rule |
|------|------|
| A | `clear_contradiction` cannot coexist with `bothCanSimultaneouslyBeTrue: true` |
| B | `clear_contradiction` cannot coexist with `changedBeliefOverTime: true` |
| C | `clear_contradiction` cannot coexist with `intentionVersusOutcome: true` |
| D | `clear_contradiction` cannot coexist with `goalVersusObstacle: true` |
| E | `clear_contradiction` cannot coexist with `emotionalOrPhysiologicalVersusReasoningStandard: true` |
| F/G | Non-null classification cannot coexist with affirmative `abstentionReason` |
| H | Required proposition context fields cannot be blank (`actor`, `subject`, `timeframe`, `modality`, `normalizedProposition`) |
| I | Material qualifier fields cannot be blank (`qualifications` each side; `contextAndScope`) |
| J | Exact evidence claims continue to validate against correct sources (quote/offset/side) |
| K | Validation rejects internal inconsistency; does not rewrite classification |
| L | No deterministic semantic fallback |

Not implemented (by design): deterministic gates based only on exact string equality of actor/subject/timeframe.

Evidence span validation remains the CEQR-001 path (`validateDualSideEvidenceClaims`).
