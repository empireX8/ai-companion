# 01 — Current defect trace

## Live message path (pre-CEQR-002)

```
app/api/message/route.ts
  → detectContradictions(userId, messageContent)
  → detectContradictionsFromData
  → marker match (GOAL_MISMATCH_MARKERS / CONSTRAINT_VIOLATION_MARKERS)
  → fan-out across matching goal/constraint references
  → DetectedContradiction[] (persistable)
  → materializeContradictions
```

**Defect:** phrases such as `"i didn't"`, `"i failed"`, `"but i"`, `"however i"`, `"even though"` plus an active goal/constraint reference were treated as sufficient creation signals. Existing-node textual similarity could also attach `existingNodeId` and authorize evidence updates without semantic adjudication.

## Import path (pre-CEQR-002)

```
importExtractedConversations
  → detectContradictions(... referenceStatuses: active+candidate)
  → classifyImportedContradictionPair
      - token overlap ≥ 2 ⇒ not unrelated
      - behavioral-admission regex ⇒ escape unrelated gate
      - no rejection reasons ⇒ eligible: true
  → fan-out guard
  → derivationArtifact(contradiction_candidate)
  → materializeContradictions
```

**Defect:** token overlap and a behavioral-admission regex functioned as positive eligibility. “Not rejected” was treated as semantic approval.

## Post-CEQR-002

| Layer | Behaviour |
|-------|-----------|
| Marker matching | Retained as `nominateContradictionMarkersFromData` — non-persistable nomination only |
| `detectContradictionsFromData` | Always returns `[]` (fail closed) |
| `detectContradictions` | Still loads refs/nodes for future wiring; returns no persistable detections |
| `classifyImportedContradictionPair` | Rejection-only; otherwise `contradiction_semantic_adjudication_required` |
| Materialisation / message route / adjudicator | Unchanged; not wired |

CEQR-001 kernel remains available but is **not** invoked from live or import paths in this slice.
