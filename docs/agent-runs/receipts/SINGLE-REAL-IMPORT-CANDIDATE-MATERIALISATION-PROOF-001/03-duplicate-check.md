# 03 — Duplicate check

## Method (read-only)

For each shortlisted `ReferenceItem` candidate, compare statement text (token overlap ≥ ~0.4–0.45 on words length > 3) against:

- Existing non-candidate ReferenceItems (`active` / `superseded` / `inactive`)
- All PatternClaims for Kay
- All UserMapConclusions for Kay
- Non-candidate ContradictionNodes (`open` / `explored` / `resolved` / `accepted_tradeoff` / `snoozed`)
- ModelUpdates (`userFacingSummary`)
- Direct FK-related UELs / ContradictionReferenceLinks for the candidate id

Also: Kay currently has **0** `active` ReferenceItems account-wide.

## Account inventory at check time

| Object family | Count / note |
|---------------|--------------|
| Pending import ReferenceItems | 29 |
| Pending import ContradictionNodes | 25 |
| Active ReferenceItems | **0** |
| PatternClaims | **7** (all `active`) |
| UserMapConclusions | 1 |
| ModelUpdates | 1 |
| Related UELs on shortlist rows | **0** each |
| ContradictionReferenceLinks on shortlist rows | **0** each |

## Results

| Candidate | ID | vs Active RI | vs PatternClaim | vs UserMapConclusion | vs Contradiction | vs ModelUpdate | Verdict |
|-----------|----|--------------|-----------------|----------------------|------------------|----------------|---------|
| A Chicken burgers | `3a6163dd-…` | none | none | none | none | none | **PASS — no duplicate** |
| B Tuxedos | `9195acb3-…` | none | none | none | none | none | **PASS — no duplicate** |
| C ADN naming | `8f47cb85-…` | none | none | none | none | none | **PASS — no duplicate** |

## Rejected from shortlist (examples)

| Reason class | Example / note |
|--------------|----------------|
| Sensitive heuristic hit | 1 of 29 candidates flagged (not shortlisted) |
| Relational / dating wording | e.g. “prefer a bw who think like this…” — accurate but higher social sensitivity; excluded |
| Solitude preference | Accurate but more personal than needed for first proof |
| Constraint corrections (“I never said…”) | Accurate to source but weak as durable mind-context preference; excluded |
| Goals overlapping PatternClaim themes | Prefer clean preference proofs over goal themes near existing claims |

## Conclusion

All three shortlisted candidates are **unlikely to duplicate** an existing durable typed object. Accepting any one promotes the **same** ReferenceItem row; it does not create a second ReferenceItem.
