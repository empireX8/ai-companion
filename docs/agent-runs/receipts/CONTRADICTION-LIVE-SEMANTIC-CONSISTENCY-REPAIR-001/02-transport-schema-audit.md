# 02 — Transport schema audit

## Pre-repair (schema-v2)

Flat Zod object:

- `classification: enum | null`
- compatibility flags: unconstrained `boolean`
- `abstentionReason: string | null`
- evidence: `startOffset` / `endOffset` only (CEQR-016)

OpenAI-strict wrapper made `proposedObjectType` required-nullable only.

## Gap

JSON Schema supplied to the provider could represent:

`classification = clear_contradiction` AND `changedBeliefOverTime = true`

Deterministic validation caught it after parse — too late to prevent the
provider from emitting the forbidden combination.

## Zod refinements

Not used as the sole provider-boundary repair: refinements do not appear in the
provider-facing JSON Schema.

## AI SDK / OpenAI constraints discovered

- Root must be a JSON Schema `object`
- Root-level `anyOf` / `oneOf` are not OpenAI-strict compatible
- Nested `anyOf` under a required property is compatible
- Zod `discriminatedUnion` emits `oneOf` (unsupported) → use `z.union` (`anyOf`)
- `const: false` for booleans is present in emitted JSON Schema
