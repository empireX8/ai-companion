# 09 — Runtime provider and database nonmutation gate

## Explicit statements

- CEQR-001 through CEQR-004 are landed.
- Objectivity Referee interface dependency is satisfied.
- This task is CEQR-005.
- Exact design chosen: **A**.
- Exact Side A and Side B span lineage is representable.
- Existing 25 receive no backfill.
- Both-null is legacy incomplete.
- One-sided lineage is invalid.
- No span can be fabricated.
- No full-message fallback exists.
- No production persistence was wired.
- No migration was applied.
- No provider/referee call occurred (unit tests use injected fakes only).
- No candidate was created or updated.
- Existing 25 remain unchanged.
- CEQR-006 was not started.
- Durable production persistence remains blocked.
- Production readiness is **NO**.

## Narrow route deviation

Contradiction API `CONTRADICTION_WITH_EVIDENCE` selects now include the new nullable span ID scalars for TypeScript assignability after schema generation. This is not persistence wiring and does not create/update candidates.

## Proof artifacts

- `account-gate-before.json` / `account-gate-after.json` — `mutationsPerformed: false`, `matchesExpected: true`
- Lineage module has no PrismaClient / materialisation / ensureEvidenceSpan calls
- Materialisation / detection / import routes untouched
