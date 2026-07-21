# Semantic-authority review correction

**Classification before correction:** `FAIL_BLOCKED_WITH_NARROW_SEMANTIC_AUTHORITY_REPAIR`
**Classification after correction:** `PASS_WITH_KNOWN_BASELINE_FAILURES`

## Corrected claims

| Claim | Before (incorrect) | After |
| ----- | ------------------ | ----- |
| Semantic authority | Caller-supplied `semantic` object | `SemanticallySelectedContradictionPair` |
| Propositions | Caller strings | Validated adjudication `normalizedProposition` only |
| Title | Caller-supplied “authoritative” title | Deterministic presentation label from propositions |
| ContradictionType | Caller enum | Derived from Side A `sourceType` (`goal`→`goal_behavior_gap`, `constraint`→`constraint_conflict`) after clear-contradiction eligibility |
| Plan authority | String token `contradiction-persistence-authorised-v1` | Module-private `WeakSet` + deep-freeze |
| Singular `sourceMessageId` | Side B message id | `null` (dual span FKs are provenance) |

## Binding authorities

1. **Selected pair** — semantic authority
2. **CEQR-005 lineage** — exact provenance authority
3. **CEQR-006 confidence** — confidence authority

The persistence gate binds all three. Independently valid inputs that describe different contradictions fail closed.

## Explicit statements

- No live route invokes the writer
- CEQR-007 remains unstarted; contradiction deduplication unproven
- Production readiness remains **NO**
- Version strings are inspectable metadata only — not authorisation credentials
- Authorised plans are internal in-memory capabilities, not serialized transport contracts
