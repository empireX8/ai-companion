# 05 — Approved evidence spans

## Rule

Approved spans are complete propositions only (with or without terminal
punctuation). Lexically valid fragments (isolated nouns/phrases) are
intentionally excluded from the approved set.

## Approved span set hashes (SHA-256)

| Case | Side | Approved span set hash |
|------|------|------------------------|
| clear | A | `e5fa8c66a288ccd700179bdfc81766b8964b0e2a1d7f49b729e2973059c002f1` |
| clear | B | `3910f0bb52fc0a1f907dec863a780763b195c83a234bb328b8f643440740c2a3` |
| compatible | A | `03c5914f9ffea73ae20ebc30eb7b47abb336074b0fb982e6b951c7a0f76786f4` |
| compatible | B | `c6a2464a80de3d142d714e8f61754119008011bc965fb1a2a6dfa502d8be13f3` |
| ambiguous | A | `d934bf0e7510568c5a65f8caa40e4a22bc00be12a79bb8f45bf71fe13788466c` |
| ambiguous | B | `714306db55d492d16230cc3c7557f85b335811172fc06a30b69e8d16073cc735` |

## Live PASS implication (future, not authorised here)

Clear-case live PASS requires both sides to select approved full-proposition
spans. Unapproved or truncated spans fail closed
(`FAIL_INVALID_OR_UNAPPROVED_EVIDENCE_SPAN`).

## Offline posture

Hashes are pinned and asserted in code. No provider selection is evaluated
against live output in this patch.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
