# 10 — Clear case result

## Case

`clear_contradiction_candidate`

Fixture texts (authoritative):

- Side A: `I do not drink alcohol at all.` (length 30)
- Side B: `I drank several beers last night.` (length 33)

## Provider transport (observed)

| Field | Value |
|-------|-------|
| classification | clear_contradiction |
| confidence | 0.95 |
| Side A offsets | 0–30 |
| Side B offsets | 0–30 |
| transportParseResult | parsed |
| rawProviderObjectUnchangedByReferenceAndValue | true |

Sanitized receipt transport retains offsets / classification / confidence only.
The sanitized transport does not echo compatibility flags. The deterministic
validation error specifically evidences `changedBeliefOverTime: true`; this
receipt does not separately assert the hidden values of the other flags.

## Failure

| Field | Value |
|-------|-------|
| status | failed_safely |
| earliestFailedGate | deterministic_validation |
| deterministicValidationStatus | failed |
| deterministicBindingResult | unknown / not reached |
| validationErrors | `internal_inconsistency: clear_contradiction cannot coexist with changedBeliefOverTime: true.` (+ internal_inconsistency / validation_failed) |
| semanticClassification after validation | null (rejected) |
| referee | not_run |
| writerInvoked | false |
| writeExecuted | false |
| fabricated_quote (CEQR-015 delta) | **INCONCLUSIVE** |

Authority path for fabricated_quote was not completed: binding did not succeed,
so fabricated_quote cannot be classified RESOLVED or PERSISTS.

## Root-cause audit (code, no provider rerun)

### Where `changedBeliefOverTime` came from

**Directly provider-supplied** in the structured model output.

Evidence:

1. Transport schema (`contradictionModelTransportResultSchema` in
   `lib/orvek-intelligence-kernel/structured-output.ts`) requires
   `changedBeliefOverTime: z.boolean()` — a mandatory provider field, not an
   optional/defaulted value and not derived by code after parse.
2. Deterministic validation reads `model.changedBeliefOverTime` from the parsed
   provider object (`lib/contradiction-adjudicator.ts`).
3. No code path sets or defaults this flag after provider return; the live
   adapter wrapper returns the provider object unchanged.

Likely provider mis-fire: Side B mentions a past event (“last night”). The live
addendum explicitly warns not to mark `changedBeliefOverTime` merely because one
side mentions a past event — the model still set the flag true while also
choosing `clear_contradiction`.

### Exact validation rule that rejected it

`lib/contradiction-adjudicator.ts` — when
`model.classification === "clear_contradiction"`:

```text
if (model.changedBeliefOverTime) {
  errors.push(
    "internal_inconsistency: clear_contradiction cannot coexist with changedBeliefOverTime: true.",
  );
}
```

This is fail-closed deterministic validation before binding / referee / writer.

### Does the prompt already explain the relationship?

**Yes.** Both layers state the rule:

1. Base adjudicator prompt (`contradiction-adjudication-prompt-v3`):
   - “Compatibility flags (must be truthful; clear_contradiction forbids all of
     them being true)” including `changedBeliefOverTime`
   - “Changed belief over time is not automatically a simultaneous contradiction.”
2. Live addendum (`contradiction-live-adjudicator-prompt-addendum-v3`):
   - “If classification is clear_contradiction, then
     bothCanSimultaneouslyBeTrue, changedBeliefOverTime,
     intentionVersusOutcome, and goalVersusObstacle MUST all be false.”
   - “Do not mark changedBeliefOverTime merely because one side mentions a past
     event; require explicit belief-revision language.”

**No patch in CEQR-017.** Next slice may strengthen semantic-field consistency
without weakening validation.
