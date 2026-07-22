# 07 — Raw output immutability boundary

- Live wrapper returns the same provider object by reference
- Adjudicator binds a **new** domain object; does not mutate `runnerResult.object`
- Provider-authored `sourceId`/`exactQuote` are not silently overwritten on the raw object

Raw provider output mutated: **NO**
