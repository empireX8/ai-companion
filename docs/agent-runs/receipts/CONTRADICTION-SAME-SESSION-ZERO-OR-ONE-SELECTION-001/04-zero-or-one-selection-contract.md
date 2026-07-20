# 04 — Zero-or-one selection contract

## Module

`lib/contradiction-same-session-selection.ts`

## Outcomes

| Outcome | Meaning |
|---------|---------|
| `selected` | Exactly one validated Class A pair |
| `no_same_session_sources` | No same-session / source-complete pool |
| `no_semantic_match` | Pool adjudicated; zero Class A |
| `ambiguous_multiple_matches` | More than one Class A → abstain |
| `source_validation_failed` | Provenance incomplete/inconsistent |
| `adjudication_failed` | All candidates failed deterministic validation |
| `model_failed` | All candidates failed the model runner |

## Resolution rules

- zero Class A passes → zero selection
- exactly one Class A pass → one semantic selection
- more than one Class A pass → ambiguity abstention → zero selected

## Prohibited

- emit one result per reference
- select the first result merely because it is first
- force a “best” result
- fall back to highest token overlap
- fall back to highest ReferenceItem confidence
- treat marker presence as eligibility
- treat “not hard rejected” as eligibility

## Result flags (CEQR-004)

- `semanticallySelected` may be true for one validated Class A pair
- `persistenceAuthorised` must remain false
- `persistable` must remain false
- `persistenceDecision` remains null
- `createCandidate` remains undefined

## Type boundary

Selection uses `SemanticallySelectedContradictionPair`.

It is **not** assignable to `DetectedContradiction`.
