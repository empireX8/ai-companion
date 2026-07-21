# 02 — Fixed-type-label trace

**Slice:** CONTRADICTION-CONFIDENCE-CALIBRATION-001 / CEQR-006

## Historical fixed labels (pre-repair)

From Phase A detector trace (`CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001/02-detector-and-classifier-trace.md`):

| ContradictionType | Hard-coded confidence |
| ----------------- | --------------------- |
| `goal_behavior_gap` | `"medium"` |
| `constraint_conflict` | `"low"` |

Materialisation copied that label onto `ContradictionNode.confidence`.

No pair-quality scoring existed — confidence was a **type label**, not an assessment.

## Current live path status

- `detectContradictionsFromData` returns `[]` (CEQR-002 / CEQR-004 quarantine).
- Marker path emits `ContradictionMarkerNomination` with `persistable: false` and **no** confidence field.
- `DetectedContradiction` still types `confidence: "low" | "medium"` for the dead persistable shape — residual typing, not a live scorer.
- Existing 25 imported candidates retain their original stored enum values; **untouched** by CEQR-006.

## CEQR-006 removal posture

| Action | Status |
| ------ | ------ |
| New repaired pathway uses model-reported + referee-adjusted numeric policy | **Done** (`lib/contradiction-confidence-calibration.ts`) |
| Policy consumes ContradictionType / markers / overlap / ReferenceItem type | **Forbidden / tested absent** |
| Delete legacy `DetectedContradiction` type field | **Out of scope** (detection/materialisation unwired; not this slice) |
| Rewrite existing 25 confidence labels | **Forbidden** |

Stop condition from campaign plan (`fixed_type_confidence_removed`) is satisfied for the **repaired** confidence recommendation path: fixed type labels are not inputs to the authoritative policy.
