# 04 — Semantic consistency contract

## Schema version

- Active: `contradiction-adjudication-schema-v3`
- Historical retained: `…-v1`, `…-v2` (CEQR-017 pin remains v2)

## Prompt / addendum versions

Unchanged:

- prompt: `contradiction-adjudication-prompt-v3`
- live addendum: `contradiction-live-adjudicator-prompt-addendum-v3`

No wording-only repair claimed as sufficient.

## Structural rules

| Variant | classification | compatibility flags | abstentionReason |
|---------|----------------|---------------------|------------------|
| clear | `clear_contradiction` | all `const: false` | `null` |
| classified non-clear | tension / compatible / insufficient | boolean | `null` |
| abstention | `null` | boolean | nonblank string |

## Defence in depth

`collectSemanticConsistencyErrors` still rejects inconsistent domain objects
constructed outside provider parsing. No silent reclassification. No flag
flipping. Raw provider objects are not mutated.
