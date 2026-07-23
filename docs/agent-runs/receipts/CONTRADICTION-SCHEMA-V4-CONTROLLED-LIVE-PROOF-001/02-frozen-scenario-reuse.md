# 02 — Frozen scenario reuse

## Rule

CEQR-021 reuses the exact CEQR-019 synthetic scenarios. Texts and aggregate
hash must match; no substitution, paraphrase, or expansion.

## Scenarios (exact)

### clear (`clear_contradiction_candidate`)

- A: `I do not drink alcohol at all.`
- B: `I drank several beers last night.`

### compatible (`compatible_contextual`)

- A: `I avoid coffee in the evening.`
- B: `I drink coffee in the morning.`

### ambiguous (`ambiguous_insufficient`)

- A: `I might go running later if I feel up to it.`
- B: `Sometimes I think about exercise.`

## Aggregate hash

`0c1b25b93f45013b096948691f24ea93cba4316b4f6d575810bcf35ccf7fa8f0`

Pinned as `CEQR_021_CASES_AGGREGATE_SHA256` (= CEQR-019 aggregate). Hash
mismatch fails closed before any future live path.

## Scope note

Scenario reuse is offline identity pinning only. It does not execute
adjudication or referee calls in this patch.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
