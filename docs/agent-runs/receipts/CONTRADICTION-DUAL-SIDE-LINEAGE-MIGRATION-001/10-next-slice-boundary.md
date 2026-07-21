# 10 — Next slice boundary

## Remaining blockers before durable production persistence

1. **CEQR-006** — confidence calibration (not started)
2. Persistence-wiring slice — consume `validatedDualSideLineage.spanEnsureDescriptors`, ensure/upsert EvidenceSpans, create ContradictionNode with both span FKs (not started)
3. Duplicate prevention (CEQR-007)
4. Import / Inspector dual-span presentation (CEQR-008 / CEQR-009)
5. Natural-entry proof (CEQR-010)
6. Authorised migration deploy (separate ops; not this worktree’s job)

## Explicitly not started

- CEQR-006
- Live AI Objectivity Referee
- Production referee provider adapter
- Live contradiction materialisation
- Candidate creation
- Existing-25 re-evaluation / Accept / Reject
- Map projection
- Account mutation

## Production readiness

**NO**
