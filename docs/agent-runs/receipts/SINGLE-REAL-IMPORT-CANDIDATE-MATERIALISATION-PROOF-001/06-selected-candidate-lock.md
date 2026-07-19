# 06 — Selected candidate lock

## Locked choice

| Field | Value |
|-------|-------|
| Shortlist slot | **Candidate A** |
| Review key | `reference_item:3a6163dd-0f85-4bf5-8eb8-924579f1db62` |
| ReferenceItem ID | `3a6163dd-0f85-4bf5-8eb8-924579f1db62` |
| Claim (plain English) | Prefers chicken burgers to beef burgers |
| Statement (UI text) | `I think prefer chicken burgers to beef burgers 😳` |
| Type | `preference` |
| Confidence | `low` |
| Locked at | Phase 2 preflight (read-only) |

## Final before-state (immediately pre-human-action)

Captured via:

```bash
node docs/agent-runs/receipts/SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001/readonly-selected-candidate-before-state.mjs \
  --candidate reference_item:3a6163dd-0f85-4bf5-8eb8-924579f1db62
```

| Check | Observed |
|-------|----------|
| Selected row exists | **Yes** |
| Status | **`candidate`** |
| Provenance session origin | **`IMPORTED_ARCHIVE`** |
| Pending total | **54** |
| ReferenceItem pending | **29** |
| ContradictionNode pending | **25** |
| PatternClaims | **7** |
| Active ReferenceItems | **0** |
| Duplicate active ReferenceItem for this preference | **None** |
| Already visible via active ReferenceItem provider / Map context | **No** |
| Related UELs / ModelUpdates for this id | **0 / 0** |
| Mutation performed this phase | **No** |

### Provenance lock

| Field | Value |
|-------|-------|
| sourceSessionId (conversation) | `7dd386eb-e6ba-493a-856d-fc8815895248` |
| sourceMessageId | `d1060934-f19d-4693-b255-d23570af50e1` |
| Import batch ID | `cmp2ftxhj0000qlsyxi55jo20` |
| Conversation label | Revealing life-changing news |

### Import list position (canonical query order)

- Position **#29** of 54 (0-based index 28)
- On first page (`limit=50`)
- Neighbours: after “My goal is peek body nutrition”; before “I need to finish this book though”

## Exact expected outcome after Kay Accept

| Check | Expected |
|-------|----------|
| Same ReferenceItem ID | still `3a6163dd-0f85-4bf5-8eb8-924579f1db62` |
| Status | `candidate` → **`active`** |
| Pending total | **54 → 53** |
| ReferenceItem pending | **29 → 28** |
| ContradictionNode pending | **25 unchanged** |
| PatternClaims | **7 unchanged** |
| Provenance FKs | unchanged |
| Duplicate ReferenceItem created | **No** |
| Unrelated candidate statuses | unchanged |
| Active reference provider (`status=active` list) | **returns this exact id** |
| Canonical Map mind-context / Context rail | **receives this item** (quality gate + fresh `updatedAt` in top-3 merge) |
| ModelUpdate created | **Not expected** — do not claim |
| UnderstandingEvidenceLink created | **Not expected** — do not claim |
| Today / Timeline appearance | **Not expected** |

## Boundaries

- Agent does **not** accept, reject, or mutate.
- No commit / push / PR / merge in this phase.
- Genuine-account proof begins only after Kay’s single Accept + after-state script PASS.
