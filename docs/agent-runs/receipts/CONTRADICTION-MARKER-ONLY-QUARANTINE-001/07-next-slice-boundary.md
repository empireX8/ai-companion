# 07 — Next slice boundary

## Done in CEQR-002

- Marker-only live creation quarantined
- Marker-only import creation quarantined
- Token-overlap affirmative eligibility removed
- Behavioral-regex affirmative eligibility removed
- Nomination helper explicitly non-persistable
- No semantic runtime wiring

## Explicitly not done (do not pull forward early)

| Slice | Scope |
|-------|--------|
| **CEQR-003** | Context and qualifier preservation in adjudicator results |
| **CEQR-004** | Same-session zero-or-one eligible selection; wire semantic adjudication into live/import nomination path |
| **CEQR-005** | Dual-side exact span lineage migration — **blocked** until CEQR-001–004 + referee interface |
| Referee execution | Shared AI Objectivity Referee implementation |
| Confidence calibration | CEQR-006 |
| Duplicate redesign | CEQR-007 |
| UI dual-source | CEQR-008 / CEQR-009 |

## Safe next step

**CEQR-003** (qualifier preservation) and/or preparing **CEQR-004** wiring of the existing CEQR-001 adjudicator onto the quarantined nomination path — without reopening marker-only eligibility.

## Standing invariants

- Existing 25 remain untouched without separate authorisation
- Production readiness remains **NO** until later proof slices
- CEQR-005 remains blocked
