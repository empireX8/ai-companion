# 12 — Ambiguous case result

## Case

`ambiguous_insufficient`

Fixture texts (authoritative):

- Side A: `I might go running later if I feel up to it.` (length 44)
- Side B: `Sometimes I think about exercise.` (length 33)

## Observed live result

| Field | Value |
|-------|-------|
| transport classification | null (abstention) |
| transport confidence | 0.8 |
| transportParseResult | parsed |
| adjudicationOutcome | abstained |
| earliestFailedGate | abstention |
| deterministicBindingResult | not_reached |
| bound source IDs / derived quotes | null |
| proofOutcome | no_candidate |
| referee | not_run |
| writerInvoked | false |
| writeExecuted | false |
| source_id_mismatch (CEQR-015 delta) | **INCONCLUSIVE** |

## Interpretation

Safe abstention with no write. Authority resolution for
`source_id_mismatch` was not reached because binding never succeeded —
therefore INCONCLUSIVE, not RESOLVED and not PERSISTS.
