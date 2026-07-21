# 01 — Current confidence-path audit

**Slice:** CONTRADICTION-CONFIDENCE-CALIBRATION-001 / CEQR-006
**Mode:** read-only audit before editing (Phase 1)

## Audit table

| Path/source | Current confidence representation | Live or persistable? | Fixed/type-derived? | CEQR-006 action |
| ----------- | --------------------------------- | -------------------: | ------------------: | --------------- |
| Model adjudication (`contradictionModelResultSchema.confidence`) | `number` in `[0,1]` via Zod | Inspectable semantic result only; not persistable by itself | No — model-reported | **Consume** as `modelReportedConfidence` after gates |
| Adjudicator validation (`contradiction-adjudicator.ts`) | Rejects non-number / NaN / out of `[0,1]` | Fail-closed validation only | No | **Require** valid model score |
| Semantic classification gate | Class A `clear_contradiction` only for CN semantics | Non-persistable eligibility hint | No | **Gate** — non-Class-A blocks recommendation |
| Deterministic validation status | `valid` / `invalid` / `not_run` | Non-persistable | No | **Require** `valid` |
| Objectivity Referee `PASS` | Continuation allowed; optional `adjustedConfidence` in `[0,1]` (referee does **not** require lowering) | Continuation only — never persistence | No | **Policy:** use model score unless optional **strictly lower** adjustment; reject increase/equality |
| Objectivity Referee `PASS_WITH_LOWER_CONFIDENCE` | Requires finite adjusted score in `[0,1]` strictly &lt; proposed | Continuation only | No | **Effective score = adjusted**; band/floor use adjusted |
| Referee blocking outcomes (`ROUTE_TO_DIFFERENT_OBJECT_TYPE`, `REQUEST_MORE_EVIDENCE`, `ABSTAIN`) | No confidence recommendation | Blocked | No | **Fail closed** — no low-band substitute |
| Referee states `not_run` / `failed` / `invalid_evaluation` | No validated outcome | Blocked | No | **Fail closed** |
| Dual-side lineage module | Preserves `adjustedConfidence` only for `PASS_WITH_LOWER_CONFIDENCE` | Non-persistable readiness | No | Out of scope to modify; policy sits beside lineage |
| Same-session selection | Carries `refereeContinuationAllowed`; no storage-band mapping | Non-persistable | No | Out of scope to wire |
| Legacy detector `DetectedContradiction.confidence` | Type `DetectionConfidence = "low" \| "medium"` | Legacy type still exists; **public detection returns `[]`** (CEQR-002/004) | **Yes — historically type-label** | **Do not consume**; repaired policy ignores |
| Historical type labels (pre-quarantine) | `goal_behavior_gap` → `"medium"`; `constraint_conflict` → `"low"` | Was persistable via materialisation; path now returns zero detections | **Yes — fixed type labels** | **Forbidden input**; documented anti-regression |
| Marker nominations | No confidence field | Explicitly `persistable: false` | N/A | Ignore |
| Materialisation | Copies `detection.confidence` onto `ContradictionNode.confidence` | Persistable **if** given a detection — legacy path only | Copies type-label when fed | **Do not wire** in CEQR-006 |
| Prisma `ReferenceConfidence` | enum `low` / `medium` / `high` | Persistable storage enum | Storage enum, not a scoring policy | **Target of storage-band recommendation strings** (no Prisma import) |
| Prisma `ContradictionNode.confidence` | `ReferenceConfidence @default(low)` | Persistable column | Default `low` is schema default only | **Not written** in this slice |
| Manual contradiction schema (`contradiction-schema.ts`) | Zod enum default `"low"` | Manual POST path | Default only | Untouched |
| Map / surface formatters | Display labels for stored enum | Read surfaces | Display only | Untouched |
| Routes / providers | No repaired confidence policy translation | No live repaired persistence path | N/A | **No route wiring** |

## Signals that must NOT drive the repaired policy

Explicitly identified and excluded:

| Forbidden signal | Where it appeared historically | Used by CEQR-006? |
| ---------------- | ------------------------------ | ----------------: |
| `ContradictionType` (`goal_behavior_gap` / `constraint_conflict`) | Detector type → hard-coded medium/low | **No** |
| Marker family / rhetorical phrases | `GOAL_MISMATCH_MARKERS`, `CONSTRAINT_VIOLATION_MARKERS` | **No** |
| Token overlap / textual similarity | Dedup / similarity helpers | **No** |
| ReferenceItem type (`goal` / `constraint`) | Side A pool filtering | **No** |
| Goal-versus-behaviour / constraint-conflict category | Type branch | **No** |
| Candidate volume | Fan-out / take limits | **No** |
| Legacy hard-coded low/medium/high labels | Detector confidence assignment | **No** |

## Controlling numeric contract search

Searched architecture receipts, enums, materialisation, tests, and prior CEQR receipts.

**Result: no authoritative numeric band or candidate-floor contract exists.**

What exists:

- Prisma `ReferenceConfidence` enum (`low` / `medium` / `high`)
- Qualitative target table in CEQR Phase A (`04-target-semantic-contract.md`) — medium/medium–high language only
- Kernel `CONFIDENCE_MIN=0` / `CONFIDENCE_MAX=1`
- Referee adjusted-confidence rules (strictly lower for `PASS_WITH_LOWER_CONFIDENCE`)

Therefore CEQR-006 defines the smallest conservative versioned engineering policy in one authoritative module (see `04-policy-decision-and-rationale.md`).
