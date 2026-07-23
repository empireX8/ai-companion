# 04 — Frozen synthetic case contract

Three cases, order fixed, hashes asserted in offline tests.

## A. CLEAR CONTRADICTION

- id: `clear_contradiction_candidate`
- Side A: `I do not drink alcohol at all.`
- Side B: `I drank several beers last night.`
- SHA-256: `6218eceeae317f5c31a5ca70b4d1f8f8c8e1276cb816f5d161aec77911a9cec6`

Expected live outcome (to be observed later, not claimed offline):

- `classification: clear_contradiction`
- all five compatibility flags false
- `abstentionReason: null`
- complete lexical boundaries on both authoritative spans
- deterministic validation passes

## B. COMPATIBLE / NON-CONTRADICTION

- id: `compatible_contextual`
- Side A: `I avoid coffee in the evening.`
- Side B: `I drink coffee in the morning.`
- SHA-256: `ac9c9dddf6f90528d0d7d28b51833bad8eb593955a541fbfd21a114374113f27`

Must not become `clear_contradiction`. No truncated spans. No writer/persistence eligibility.

## C. AMBIGUOUS

- id: `ambiguous_insufficient`
- Side A: `I might go running later if I feel up to it.`
- Side B: `Sometimes I think about exercise.`
- SHA-256: `04baa1844a613c85e97c2642a5f5383112141d25da6c1d517e1ccbcd251fb09e`

Safe abstention or non-clear classification. No false clear. No writer/persistence eligibility.

## Aggregate

SHA-256: `0c1b25b93f45013b096948691f24ea93cba4316b4f6d575810bcf35ccf7fa8f0`
