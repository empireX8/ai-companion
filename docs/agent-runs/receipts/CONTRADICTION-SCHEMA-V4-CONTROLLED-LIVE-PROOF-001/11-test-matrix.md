# 11 — Test matrix

## Offline matrix (this preparation slice)

| Area | Intent |
|------|--------|
| Scenario hash pin | Aggregate + per-case SHA match CEQR-019 |
| Catalog hashes | Six locked catalog hashes assert |
| Approved spans | Six approved-set hashes; fragment exclusion |
| Schema-v4 contract | Boundary-only transport; excluded fields absent |
| Addendum identity | CEQR-021 addendum ≠ production v4 |
| Live PASS classifier | Completed calls alone ≠ PASS; clear needs referee + approved spans |
| Call accounting | Budget 3+1 / max 6; writer/DB/account stay 0 |
| One-shot safety | Dual guards exact; temp claims only; no canonical arm |
| Offline dry run | Fake runner control flow; not live PASS |
| Historical isolation | CEQR-019 artifacts untouched |

## Explicitly out of matrix

- Live OpenAI (or other) provider invocation
- Real account / database queries or mutations
- Writer / persistence / node creation
- Armed claim consumption

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
