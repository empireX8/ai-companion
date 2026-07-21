# 06 — Candidate / import presentation (CEQR-008)

## API

`GET /api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true`

- Opt-in only (`includeDualSource=true|1`)
- Batch resolution via shared projection module
- Existing list fields/actions preserved

## Page

`app/(root)/(routes)/contradictions/candidates/page.tsx`

- Requests `includeDualSource=true`
- Renders `ContradictionDualSourceView`
- Legacy: single calm lineage notice (not 25 alarming errors)
- Complete verified: interpretation vs exact source excerpt separated per side
- Confirm / Dismiss / Confirm all / Dismiss all unchanged
- No confirm/dismiss invoked during account validation
