# 03 — Schema-v4 provider contract

## Identities

| Role | Version |
|------|---------|
| Schema | `contradiction-adjudication-schema-v4` |
| Prompt | `contradiction-adjudication-prompt-v4` |
| CEQR-021 addendum | `contradiction-live-adjudicator-prompt-addendum-ceqr021-schema-v4` |

The CEQR-021 addendum is distinct from production
`contradiction-live-adjudicator-prompt-addendum-v4`. It must not replace the
ordinary live adapter addendum.

## Transport shape

Provider evidence claims carry only:

- `startBoundaryIndex`
- `endBoundaryIndex`

Excluded from provider transport (code-owned after binding):

- `startOffset` / `endOffset`
- `sourceId`
- `exactQuote`

## Semantic hard rules (addendum)

- Prefer complete proposition spans; no isolated nouns/partial clauses.
- Mid-word cuts are absent from the catalog.
- Clear contradiction requires all compatibility flags false.
- Insufficient evidence → abstain with non-blank `abstentionReason`.

## Offline proof posture

Contract proofs run against schema/prompt/addendum identities in code. No
provider adapter is constructed or invoked by this patch.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
