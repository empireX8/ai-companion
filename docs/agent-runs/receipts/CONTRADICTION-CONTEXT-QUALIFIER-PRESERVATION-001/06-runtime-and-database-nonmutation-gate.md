# 06 — Runtime and database nonmutation gate

## Runtime wiring

| Path | Modified? | Imports adjudicator/kernel? |
|------|-----------|------------------------------|
| `app/api/message/route.ts` | NO | NO |
| `lib/contradiction-detection.ts` | NO | NO |
| `lib/import-chatgpt.ts` | NO | NO |
| `lib/contradiction-materialization.ts` | NO | NO |

CEQR-002 marker quarantine remains unchanged.

No runtime path invokes CEQR-003 adjudication.

## Schema / data

| Boundary | Status |
|----------|--------|
| Prisma schema | unchanged |
| Migrations | none |
| Kay DB mutation | none |
| Candidate status mutation | none |
| Existing 25 ContradictionNodes | unchanged |
| Decision POST | none |
| Accept/Reject | none |

## Account gate (read-only)

Before and after both `matchesExpected: true`:

- pending candidates: 53
- pending ReferenceItems: 28
- pending ContradictionNodes: 25
- open genuine ContradictionNodes: 0
- PatternClaims: 7
- ModelUpdates: 1
- UnderstandingEvidenceLinks: 50
- chicken-burger ReferenceItem: active

See `account-gate-before.json` / `account-gate-after.json`.

## Standing receipts

- CEQR-001 and CEQR-002 are landed.
- Context and qualifier preservation is strengthened.
- Partial compliance is not Class A.
- Deterministic gates reject internally inconsistent model output.
- Deterministic code does not independently decide semantic contradiction.
- No runtime adjudication wiring exists.
- No persistence approval exists.
- Existing 25 candidates remain unchanged.
- CEQR-004 is not implemented.
- CEQR-005 remains blocked.
- Production readiness is **NO**.
