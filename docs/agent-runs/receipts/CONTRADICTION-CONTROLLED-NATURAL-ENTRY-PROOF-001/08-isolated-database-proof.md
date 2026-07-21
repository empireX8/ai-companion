# 08 — Injected transactional persistence proof

**Title clarification:** this is an **injected transaction boundary** proof, not persistence against an actual isolated database engine.

Harness uses in-memory Maps + a fake `$transaction` with rollback:

- Session / Message / EvidenceSpan / ContradictionNode maps
- Writer-visible message content may deliberately diverge from the lineage resolver (hash/content integrity probe)
- Proof user id: `ceqr010-proof-user-isolated` (never Kay account)
- Explicit `cleanup()` clears all test-created rows

| Claim | Value |
| --- | --- |
| Injected transactional persistence boundary | YES |
| Actual isolated database persistence | NO |

No prismadb singleton. No real account connection in the proof harness.
