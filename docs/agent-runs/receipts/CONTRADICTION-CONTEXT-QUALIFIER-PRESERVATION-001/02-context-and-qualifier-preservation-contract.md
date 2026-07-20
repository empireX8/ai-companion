# 02 — Context and qualifier preservation contract

## Controlling principle

Contradiction classification must compare the propositions the evidence actually supports, including their material qualifiers.

Preserve before classifying:

1. actor
2. subject
3. timeframe
4. context
5. scope
6. negation
7. modality
8. frequency
9. condition
10. exception
11. uncertainty
12. intention versus action
13. partial compliance
14. quoted or attributed speech
15. emotional/physiological state versus chosen reasoning or behaviour

A clear contradiction requires two propositions that cannot both be true under materially matching actor, subject, timeframe, scope, context, and modality.

## Core stop condition

**PARTIAL COMPLIANCE MUST NOT BE CLASSIFIED AS `clear_contradiction`.**

Example:

- Side A: “I need to review after I read to retain.”
- Side B: “I did review it after every read, but I did not do the question exercises.”

Required reading: review behaviour partially completed; question drills omitted; tension / incomplete process / obstacle — not “did not review.”

## Prompt contract (`contradiction-adjudication-prompt-v2`)

The adjudication prompt now explicitly instructs the model to:

- preserve all material qualifications before normalization
- distinguish universal / habitual / occasional / isolated claims
- distinguish desire, intention, obligation, attempt, capacity, action, outcome
- distinguish present, past, future, and changed-belief claims
- preserve conditions, exceptions, and scope limits
- preserve partial compliance
- preserve negation and nested negation
- preserve attribution and quoted speech
- avoid upgrading “usually” → “always”, “want/should/try” → completed behaviour
- avoid reducing partial failure to total failure
- abstain when context cannot be safely preserved
- explain which qualifiers materially affected classification (in `rationale`)
- state what missing information would change classification (`whatWouldChangeClassification`)

## Structured fields (unchanged shape)

Existing proposition fields + compatibility flags remain the carrier for preserved qualifiers. Deterministic validation requires non-blank:

- `normalizedProposition`, `actor`, `subject`, `timeframe`, `modality`, `qualifications` (each side)
- `contextAndScope`

## Classification rule

| Class | Value | ContradictionNode-shaped? |
|-------|-------|---------------------------|
| A | `clear_contradiction` | Semantically yes — still not persistence-approved |
| B | `plausible_unresolved_tension` | No |
| C | `compatible_states` | No |
| D | `insufficient_or_misaligned_context` | No |

Even Class A remains: not referee-approved; not persistence-approved; not candidate-creation authorization.

- `persistenceDecision` = `null`
- `createCandidate` = `undefined`
- Objectivity Referee = `not_run` unless injected fake tests the interface
