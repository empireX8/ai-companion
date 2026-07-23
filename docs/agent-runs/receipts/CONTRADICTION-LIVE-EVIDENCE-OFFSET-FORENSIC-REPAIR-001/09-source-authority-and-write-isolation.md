# 09 — Source authority and write isolation

- `sourceId` copied from authoritative `KernelSourceUnit` only.
- `exactQuote` derived from authoritative slice only.
- Provider-authored `sourceId` / `exactQuote` / raw offsets are non-authoritative.
- Invalid selections → `validation_failed` → `semantic = null`.
- Referee runs only after validation success and only for `clear_contradiction`.
- Writer / persistence / account / real DB remain unreachable from this path.
- CEQR-020 forensic helper must not be imported by production routes (tested).

CEQR-020 live provider attempts: 0. Writer/persistence/account/database: 0.
Production readiness: NO.
