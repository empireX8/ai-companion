# 04 — Before and after proof contract

## Before-state script

`readonly-selected-candidate-before-state.mjs`

```bash
set -a && source .env && set +a
node docs/agent-runs/receipts/SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001/readonly-selected-candidate-before-state.mjs \
  --candidate reference_item:<CHOSEN_ID>
```

Accepts either an encoded review key (`reference_item:<uuid>`) or a bare ReferenceItem id.

Records (read-only):

- pending candidate total
- ReferenceItem candidate total
- ContradictionNode candidate total
- PatternClaim total
- selected row status + provenance fields
- existing related objects / evidence links / ModelUpdates
- provider-visible Map context preview before acceptance
- `mutationsPerformed: false`

**No write operations are hard-coded into this script.**

## After-state expected (ReferenceItem acceptance only)

When Kay later accepts **one** shortlisted ReferenceItem (future phase — not this phase):

| Check | Expected |
|-------|----------|
| Same ReferenceItem row present | **Yes** (same id) |
| Status | `candidate` → `active` |
| Pending total | **54 → 53** |
| ReferenceItem pending | **29 → 28** |
| ContradictionNode pending | **25 unchanged** |
| PatternClaims | **7 unchanged** |
| Provenance FKs (`sourceSessionId`, `sourceMessageId`) | Intact |
| New duplicate ReferenceItem created | **No** |
| Unrelated candidate statuses | Unchanged |
| Unrelated objects deleted/rewritten | **No** |
| UserMap / existing ModelUpdate | Unchanged |

### Schema gaps — explicitly NOT expected

Because `UnderstandingLinkTargetType` cannot target `reference_item`:

| Artifact | On ReferenceItem accept |
|----------|-------------------------|
| New `UnderstandingEvidenceLink` rows | **Not expected** (`UEL_TARGET_UNSUPPORTED`) |
| New `ModelUpdate` row | **Not expected** (`MODEL_UPDATE_TARGET_UNSUPPORTED`) |
| Timeline movement from this accept | **Not expected** |
| Today card from this accept | **Not expected** |

Lineage remains the existing session/message FKs on the ReferenceItem row.

### Provider-visible after expect

| Surface | Expectation |
|---------|-------------|
| Map → Background / Context | Newly active preference should appear (quality gate + fresh `updatedAt` vs PatternClaims in top-3 merge) |
| Inspector | When that context rail item is selected |
| Decisions | **Not** for preference types (goals only) |
| Today / Timeline | No dedicated consumption path |

## Integrity invariants after any future accept

- Production readiness still **NO** until Kay confirms UI + DB after-state
- Isolated automated tests ≠ genuine-account proof
- Do not treat script-only checks as campaign closeout
