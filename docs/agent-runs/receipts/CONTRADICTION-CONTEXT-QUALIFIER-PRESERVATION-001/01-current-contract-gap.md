# 01 — Current contract gap

## Semantic path (CEQR-001, unchanged topology)

```
KernelSourceUnit Side A + Side B
→ buildContradictionAdjudicationPrompt
→ StructuredModelRunner
→ contradictionModelResultSchema
→ parseContradictionModelResult
→ deterministic evidence and semantic-consistency validation
→ ContradictionAdjudicationResult
→ no persistence decision
```

## Gap before CEQR-003

Schema already contained:

- actor, subject, timeframe, negation, modality, qualifications
- contextAndScope
- bothCanSimultaneouslyBeTrue, changedBeliefOverTime, intentionVersusOutcome, goalVersusObstacle, emotionalOrPhysiologicalVersusReasoningStandard

But the contract did **not** sufficiently guarantee that classification-changing context and qualifiers are preserved rather than flattened.

A model could compress:

> “I did review it after every read, but I did not do the question exercises”

into:

> “I failed to follow my review process”

That destroys partial compliance and can falsely turn a tension into `clear_contradiction`.

## Missing deterministic gates

Before CEQR-003, `clear_contradiction` could coexist with compatibility flags (`bothCanSimultaneouslyBeTrue`, `goalVersusObstacle`, etc.), and a non-null classification could coexist with an affirmative `abstentionReason`. Validation did not reject those inconsistencies; it did not silently reclassify either — but inconsistent Class A could still be accepted.

## Design choice

Keep schema shape (v1). Strengthen prompt (v2) + deterministic consistency validation. Do not add keyword-based semantic classifiers. Do not introduce new qualifier-evidence fields unless provenance requires them — existing `qualifications` + dual evidence claims remain sufficient.
