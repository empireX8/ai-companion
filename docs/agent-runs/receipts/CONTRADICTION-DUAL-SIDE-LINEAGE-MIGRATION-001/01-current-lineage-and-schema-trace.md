# 01 — Current lineage and schema trace

## Design table

| Requirement | Current representation | Gap | Proposed representation | Enforcement layer |
|-------------|------------------------|-----|-------------------------|-------------------|
| Exact Side A span | Absent on ContradictionNode | No FK to EvidenceSpan for Side A | `sideASourceSpanId` + `sideASourceSpan` | Prisma schema + SQL FK Restrict + lineage builder |
| Exact Side B span | Absent on ContradictionNode | No FK to EvidenceSpan for Side B | `sideBSourceSpanId` + `sideBSourceSpan` | Prisma schema + SQL FK Restrict + lineage builder |
| Side A message | Indirect via ReferenceItem / kernel unit only | Not first-class on CN | Resolved through EvidenceSpan.messageId | Lineage builder validates message ownership |
| Side B message | Legacy `sourceMessageId` (generic, Side-B-anchored in practice) | Generic; not exact span | Keep legacy; repaired authority is `sideBSourceSpanId` | Lineage builder; legacy fields untouched |
| Side A session | Indirect via ReferenceItem.sourceSessionId | Not first-class on CN | Via EvidenceSpan → Message.sessionId | Lineage builder same-session gate |
| Side B session | Legacy `sourceSessionId` | Generic single-session pointer | Keep legacy; repaired authority via Side B span chain | Lineage builder |
| Dual-null legacy | N/A (fields absent) | Existing 25 need schema-compatible nulls | Both span IDs nullable | Migration additive + CHECK both-or-neither |
| Partial lineage | N/A | Must reject one-sided writes | CHECK both-or-neither + `invalid_partial` classifier | SQL CHECK + `classifyStoredContradictionLineage` |
| Distinct opposing spans | N/A | Same span must not serve both sides | CHECK distinct IDs + identical-span identity fail | SQL CHECK + builder |
| Exact offsets/quotes | Kernel `ExactEvidenceClaim` only (ephemeral) | Not persisted / not lineage-ready | Builder validates offsets against message content | `buildValidatedDualSideLineage` |
| Content hash | EvidenceSpan.contentHash exists for other domains | CN does not reference spans | Hash exact quote slice; later ensure/upsert descriptors | `hashExactQuoteSlice` |
| Referee continuation | Interface landed; continuationAllowed | Not consumed by lineage contract | Gate PASS / PASS_WITH_LOWER_CONFIDENCE only | Builder referee gate |
| Persistence | `DetectedContradiction` + materialisation (legacy) | Must not appear repaired | Pure lineage result; persistable=false | Module naming + non-wiring tests |

## Field classification

### Legacy / generic (retained; not repaired exact lineage)

- `ContradictionNode.sourceSessionId`
- `ContradictionNode.sourceMessageId`
- `ContradictionEvidence` (sessionId / messageId / quote; no side role; no span FK)

These remain valid for the pre-repair cohort. They are **not** claimed as symmetric exact Side A/B span lineage.

### Repaired exact lineage (new in CEQR-005)

- `ContradictionNode.sideASourceSpanId` / `sideASourceSpan`
- `ContradictionNode.sideBSourceSpanId` / `sideBSourceSpan`
- EvidenceSpan reverse arrays `contradictionNodesAsSideA` / `contradictionNodesAsSideB`

## Kernel / selection objects traced

| Object | Role in CEQR-005 |
|--------|------------------|
| `KernelSourceUnit` | Side A/B source text + session/message IDs |
| `ExactEvidenceClaim` (`evidenceClaimA` / `evidenceClaimB`) | Model-proposed offsets + exact quotes |
| `SemanticallySelectedContradictionPair` | Exactly one selected pair; persistable=false |
| `ContradictionAdjudicationResult` | semantic_accepted + clear_contradiction + validation |
| `ObjectivityRefereeResult` | continuationAllowed for PASS / PASS_WITH_LOWER_CONFIDENCE |
| `DetectedContradiction` | Legacy materialisation input — **not** lineage output |
| Materialisation input | Unchanged; not wired |

## EvidenceSpan Message cascade impact

EvidenceSpan currently deletes with Message (`onDelete: Cascade`). New CN FKs use `ON DELETE RESTRICT`. Therefore deleting a Message that still supports a repaired ContradictionNode via span FKs will fail at the EvidenceSpan delete step rather than silently nulling or cascading away repaired lineage. Prefer restrictive behaviour over silent loss.
