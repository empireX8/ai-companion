# 06 — Source authority preservation

## Provider may own

- semantic judgment
- normalized propositions
- classifications
- offsets within bounded authoritative sources

## Code owns

- ordered Side-A / Side-B source identity
- authoritative source text
- `exactQuote` derivation
- evidence binding
- deterministic validation
- persistence eligibility gates

## Transport keys

`evidenceSpanSelectionSchema` still exposes only `startOffset` / `endOffset`.

Forged provider `sourceId` / `exactQuote` remain non-authoritative (stripped /
ignored; never consulted by binding).

## Immutability

Raw provider objects remain deep-equal before and after adjudication processing
in focused tests.
