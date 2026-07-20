# 00 — Intake and scope

**Slice:** CEQR-003 — Context and Qualifier Preservation
**Campaign:** CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001
**Receipt campaign:** CONTRADICTION-CONTEXT-QUALIFIER-PRESERVATION-001
**Baseline:** staging @ `ad42a15`
**Branch:** `desktop-contradiction-context-qualifier-preservation-001`

## Landed predecessors

- **CEQR-001** landed — shared Orvek Intelligence Kernel + model-assisted contradiction adjudication foundation
- **CEQR-002** landed — marker-only and token-overlap candidate creation quarantine

## Scope

Strengthen the CEQR-001 adjudication contract so material context and qualifiers are preserved before classification, and internally inconsistent Class A structured output fails closed.

## In scope

- `buildContradictionAdjudicationPrompt` qualifier-preservation instructions
- Deterministic internal-consistency gates (no silent reclassification)
- Non-blank material qualifier / context field checks
- Edge-case contract tests with injected fake model runners
- Prompt version bump for material wording change
- Receipts in this directory

## Out of scope

- CEQR-004 same-session zero-or-one selection
- Runtime model / message / import / materialisation wiring
- Objectivity Referee implementation
- Candidate persistence or status mutation
- Dual-side lineage migration (CEQR-005 remains blocked)
- Prisma schema / migrations
- UI changes
- Reclassification of the existing 25 candidates
- Kay account mutation

## Account gate (must remain unchanged)

| Metric | Expected |
|--------|----------|
| pending candidates | 53 |
| pending ReferenceItems | 28 |
| pending ContradictionNodes | 25 |
| open genuine ContradictionNodes | 0 |
| PatternClaims | 7 |
| ModelUpdates | 1 |
| UnderstandingEvidenceLinks | 50 |
| chicken-burger ReferenceItem | active |

**Production readiness:** NO
