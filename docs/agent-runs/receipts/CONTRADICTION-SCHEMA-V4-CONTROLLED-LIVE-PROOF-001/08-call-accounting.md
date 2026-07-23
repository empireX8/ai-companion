# 08 — Call accounting

## Expected future live budget (not executed here)

| Counter | Expected |
|---------|----------|
| Adjudicator calls | 3 (one per frozen case) |
| Referee calls | 1 (clear path only) |
| Max total provider attempts | 6 |
| Max retries | 0 |
| Writer calls | 0 |
| Persistence calls | 0 |
| Account gate / real DB calls | 0 |
| Nodes created | 0 |

Provider: `openai`. Models: adjudicator `gpt-4o-mini`, referee `gpt-4o-mini`.
Timeout: 45_000 ms.

## Accounting fields (code)

`Ceqr021CallAccounting` tracks construction, runner invoke, adjudicator,
referee, retries, writer, persistence, account, DB, ingestion, and nodes.
`totalProviderAttempts = adjudicatorAttempts + refereeAttempts`.

## This patch

All counters remain at zero for real provider/account/DB/writer paths.
Offline dry-run may simulate ideal control-flow counts without a live adapter;
those simulations are not live provider attempts.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
