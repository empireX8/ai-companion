# 11 — Compatible case result

## Case

`compatible_contextual`

Fixture texts (authoritative):

- Side A: `I avoid coffee in the evening.` (length 30)
- Side B: `I drink coffee in the morning.` (length 30)

## Observed live result

| Field | Value |
|-------|-------|
| classification | compatible_states |
| confidence | 0.9 |
| transportParseResult | parsed |
| deterministicBindingResult | bound |
| authoritative Side A sourceId | matched bound Side A |
| authoritative Side B sourceId | matched bound Side B |
| derived Side A exactQuote | `I avoid coffee in the evening.` |
| derived Side B exactQuote | `I drink coffee in the morni` |
| selected Side A offsets | 0–30 |
| selected Side B offsets | 0–27 |
| deterministicValidationStatus | passed |
| earliestFailedGate | semantic_accepted_non_class_a |
| proofOutcome | no_candidate |
| referee | not_run |
| writerInvoked | false |
| writeExecuted | false |
| fabricated_quote (CEQR-015 delta) | **RESOLVED** |

Class C (`compatible_states`) is not a ContradictionNode candidate — correct
no-write behaviour.

## Evidence-span adequacy / quality limitation (not authority failure)

Side B offsets `0–27` are **valid** against authoritative Side B text length 30
and produce an **exact** authoritative slice:

```text
I drink coffee in the morni
```

That quote is byte-equal to `sourceText.slice(0, 27)`. It is **not** a
`fabricated_quote` and **not** a `source_id_mismatch`.

It is, however, **semantically incomplete** relative to the full fixture
sentence (`…morning.`). Classify this as an **evidence-span adequacy / quality
concern**: the model selected a truncated but authoritative span.

Out of scope for CEQR-017 repair. Candidate for
`CONTRADICTION-LIVE-SEMANTIC-CONSISTENCY-REPAIR-001` alongside clear-case
consistency work — without weakening deterministic source authority.
