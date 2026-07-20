# 03 — Live detection quarantine

## Change

`lib/contradiction-detection.ts`:

1. Extracted marker/reference matching into `nominateContradictionMarkersFromData` → `ContradictionMarkerNomination[]`.
2. `detectContradictionsFromData` always returns `[]`.
3. `detectContradictions` still queries references/nodes (preserves `referenceStatuses` gate for future CEQR-004 wiring) then returns no persistable detections.

## Behavioural outcomes

| Case | Result |
|------|--------|
| `"but I"` + constraint ref | No `DetectedContradiction` |
| `"however I"` / `"even though"` | No detection |
| `"I didn't..."` / `"I failed..."` + goal ref | No detection |
| Plausible goal/behaviour pair | Abstains (no semantic runtime) |
| Multiple matching refs | No fan-out candidates |
| High token overlap | No eligibility |
| Existing-node textual similarity | No evidence-update authorization |
| Short / no-marker / no-ref | Empty (unchanged) |

## Explicit non-goals

- No call to `adjudicateContradiction`
- No Objectivity Referee execution
- No message-route changes
- No materialisation changes
- No fake `semanticApproved` escape hatch on `DetectedContradiction`
