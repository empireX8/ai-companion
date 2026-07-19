# 08 — Provider to actual runtime surface matrix

**Rule:** Provider returning data ≠ human-visible. Must reach mounted `orvek-v0-canonical` (or shared EvidencePanel/Overlay).

**Shell:** `OrvekWorkbenchShell` → `CanonicalLiveRuntimeEntry` → hybrid API → `buildCanonicalLiveRuntimeData` → `CanonicalWorkbench`.

---

## Object pathways

| Object | API / load | Provider/hook | Adapter | Mounted component | Visible section | Synthetic mask? | Human-visible now (Kay)? |
|--------|------------|---------------|---------|-------------------|-----------------|-----------------|--------------------------|
| ReferenceItem active | `/api/reference/list` / map facts fetch | hybrid + `fetchActiveMapProfileFacts` | `map-profile-facts.ts` | canonical `map.tsx` | Preferences / Constraints facts | Composition may replace rails | **Yes** — chicken-burger fact (proven) if live Map merge wins |
| ReferenceItem candidate | `/api/import-review/candidates` | hybrid importReview override | import-candidate presentation | ImportOverlay | Import review cards | Seed ic* overridden by live | **Yes** in Import (53) |
| ContradictionNode candidate | same import-review | same | same | ImportOverlay | Import | same | **Yes** in Import |
| ContradictionNode open | contradiction-surface | map-api | map adapters | map.tsx | Active conflicts | composition conflicts | **No** — all still candidate |
| PatternClaim | patterns / map fetch | map-api | adapters | map.tsx | Patterns | composition loops | **Conditional** — genuine 7 exist; masked if composition owns rails |
| UserMapConclusion | `fetchYourMapConclusions` | map-api | map adapters | map.tsx | Map rails by area | composition claims/goals | **Conditional** — 1 genuine UM; masked if composition owns |
| ModelUpdate | timeline / today / inspector | hybrid + inspector detail | MU presentation | timeline / today / evidence-panel | movement | seed report/movements | **Conditional** — 1 genuine MU |
| SurfacedAction | `/api/actions` | decisions-api | decisions adapters | decisions.tsx | Decision cards | composition d1… | **Conditional** |
| Investigation / AQ | investigations + AQ APIs | hybrid | explore adapters | explore.tsx | Questions / Investigations | composition aq/inv | **Empty genuine** (0 inv) |
| Fieldwork | watch-for / fieldwork | experiment-api | explore FieldworkBridge | explore fieldwork tab | Experiment | composition f1/f2 | **1** genuine fieldwork; mask risk |
| ProfileArtifact | — | not Map | — | — | — | — | **No** |
| EvidenceSpan / UEL / pointers | inspector + depth APIs | evidence-panel | inspector APIs | EvidencePanel | Evidence tab | composition receipts | Partial |
| CanonicalTodayComposition | `/api/canonical-today-composition` | hybrid Today + `applyCompositionWorkbenchRails` | live-provider | today + rails | Today + Map/Timeline/Decisions/Explore | **IS the mask** | Seed densograph **visible** on root when present |
| CanonicalModelMovementReport | composition / report load | report overlay | provenance helpers | ReportOverlay | Reports | seed weekly | Seed report present |
| Goals (RI) | reference list / actions | actions use for blueprints | decisions-api | decisions (indirect) | not goal cards | — | Not as Map goals |
| Goals (UM remap) | map conclusions | map-api `isModelGoalConclusion` | map | map Model Goals | goals rail | m-goal-* | **Empty** for Kay (wrong area) |

---

## Visibility checklist (interpretation / confidence / evidence / provenance / relations / change / correction)

| Object | Interp | Confidence | Evidence | Provenance | Relations | What changed | Correction |
|--------|--------|------------|----------|------------|-----------|--------------|------------|
| Active RI (preference) | statement on Map | low shown? | source msg via inspector if wired | session/message FKs | limited | no MU on accept | N/A for RI |
| PatternClaim | summary on Map | strengthLevel | PCE | sourceRunId | actions | no MU | limited |
| UM | title/summary | confidenceLevel | 50 UEL | import_record among sources | investigations 0 | MU conclusion_added | durable PATCH |
| CN candidate | Import card | confidence | CE | import session | ref links | — | accept/reject |
| MU | summary | isMeaningful | affected object | — | affectedObject | itself | — |
| SurfacedAction | title/prompt | — | linked claim | — | claim, not goal in UI | outcome PATCH | — |

---

## Surface mount confirmation

| Surface | Actual mounted | Parallel/quarantined NOT authority |
|---------|----------------|------------------------------------|
| Today/Map/Decisions/Timeline/Explore | `components/orvek-v0-canonical/pages/*` | `orvek-v0/pages/*`, Orvek*Page workbench |
| Inspector | `orvek-v0-authority/evidence-panel.tsx` | — |
| Import/Report | `orvek-v0/overlays.tsx` | seed import only when referenceSurface |

---

## Critical mask interaction

When `CanonicalTodayComposition.source=full_reference_round_trip_seed` exists (Kay: **yes**):

- Today densograph from seed
- `applyCompositionWorkbenchRails` **blocks** live Map/Timeline/Decisions/Explore merges
- Import review **still live** (override)
- Profile facts attach only if live Map objects exist — composition may show fixture ctx/goals instead

Therefore many “stored + provider” pathways are **SURFACED_THROUGH_SYNTHETIC_FALLBACK** or **PARTIALLY_CONNECTED** until composition unmask after proofs.
