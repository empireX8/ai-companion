# 03 — Contradiction adjudication contract

**Versions**

| Constant | Value |
|----------|-------|
| Schema | `contradiction-adjudication-schema-v1` |
| Prompt | `contradiction-adjudication-prompt-v1` |

## Input

Two `KernelSourceUnit`s (Side A / Side B) plus injectable `StructuredModelRunner`.

Each unit carries: sourceId, sessionId, messageId, complete sourceText, role/type, optional existingObjectId, stable label.

## Structured model result fields

Normalized propositions A/B with actor, subject, timeframe, negation, modality, qualifications; context/scope; simultaneous-truth flag; changed-belief / intention-vs-outcome / goal-vs-obstacle / emotional-vs-reasoning flags; classification; confidence; exact evidence claims; rationale; alternative interpretation; what would change classification; abstention reason.

## Classification enum

- `clear_contradiction`
- `plausible_unresolved_tension` (not a ContradictionNode)
- `compatible_states` (not a ContradictionNode)
- `insufficient_or_misaligned_context` (not a ContradictionNode)

## Model instructions (prompt)

Abstention preferred over weak classification; Class B/C/D are not ContradictionNodes; temporal change / goal+obstacle / intention+incomplete outcome / emotional+reasoning are not automatic contradictions; rhetorical “but I” and token overlap are not proof; do not force different subjects/actors/scopes/sessions; never lower the meaning standard to preserve candidate volume.

## Eligibility boundary

`clear_contradiction` is a **semantic** result only. It is **not** sufficient to create a DB candidate in CEQR-001 (referee not implemented; CEQR-004/005 not wired; no runtime persistence).

Envelope exposes `persistenceDecision: null` and never `createCandidate: true`.
