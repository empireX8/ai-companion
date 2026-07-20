# 05 — Adjudication and referee boundary

## Adjudicator

Uses landed `adjudicateContradiction`:

- Caller supplies injected `StructuredModelRunner`
- No hard-coded provider inside the selection module
- Exact evidence claims must validate
- Only valid `clear_contradiction` is semantic Class-A-shaped
- Class B/C/D and abstention are not eligible
- Validation failures are not eligible
- Model failures are not eligible
- No deterministic semantic classifier

## Objectivity Referee

- Interface already exists
- This slice exercises injected fakes in tests only
- No new live AI Objectivity Referee implementation
- `not_run` is never treated as PASS
- Outcomes remain distinct: PASS / PASS_WITH_LOWER_CONFIDENCE / ROUTE_TO_DIFFERENT_OBJECT_TYPE / REQUEST_MORE_EVIDENCE / ABSTAIN
- Even fake PASS does not bypass missing CEQR-005 persistence lineage
- Even fake PASS does not set `persistenceAuthorised` or `persistable`

## Nomination versus eligibility

Markers, textual similarity, recency, confidence and token overlap may:

- reduce a bounded retrieval pool
- order the pool for processing
- provide diagnostics

They may not:

- set semantic eligibility
- force at least one nomination
- choose the final winner
- rescue a failed adjudication

Markers are not mandatory for pure selection tests that already supply bounded source pairs.
