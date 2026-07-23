# 07 — Offline test matrix

| Area | Coverage |
|---|---|
| CEQR-019 identities / schema-v3 pin | focused contract test |
| Frozen case hashes | exact per-case + aggregate |
| Dual live guards | YES-only + underlying opt-in |
| Missing guard ⇒ zero provider calls | production entry |
| Permanent claim HOLD statements | claim builder + receipt file |
| Pre-live zero activity counters | receipt builder |
| CEQR-017 canonical hashes | exact SHA-256 |
| CEQR-018 receipt corpus unchanged | per-file SHA-256 |
| morni truncation rejection | lexical boundary |
| Truncated / inconsistent clear blocked | natural-entry writer-block |
| Strict PASS matrix (9 adversarial cases) | classifyCeqr019LiveResult |
| clear no_write never PASS | adversarial #1 |
| missing adjudication ⇒ HOLD | adversarial #2 |
| validation failed ⇒ HOLD_PROVIDER_OUTPUT_INVALID | adversarial #3 |
| truncated span ⇒ FAIL_TRUNCATED… | adversarial #4 |
| false clear on compatible/ambiguous | adversarial #5–6 |
| compatible lexical fail | adversarial #7 |
| exact three-case PASS matrix | adversarial #8 |
| HOLD hint cannot upgrade to PASS | adversarial #9 |
| Canonical cwd / receiptDir lock | production path gate |
| Alternate receiptDir rejected | test helper basename check |
| Existing claim blocks; path cannot bypass | oneshot claim |
| Exception after one adjudicator call | budget capture |
| Schema factory failure ⇒ zero attempts | budget capture |
| Live script production-only | static script scan |
| Ambient env not live-authorised | suite invariant |

Also re-run related offline suites listed in `08-offline-validation.md`.
