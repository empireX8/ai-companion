# 12 — Compatibility classification matrix

**Each pathway has exactly one primary status.**

Statuses used: FULLY_CONNECTED · PARTIALLY_CONNECTED · STORED_NOT_SURFACED · SURFACED_THROUGH_SYNTHETIC_FALLBACK · MISSING_WRITE_PATH · MISSING_READ_PATH · LEGACY_ORPHANED · DUPLICATED_OR_CONFLICTING · FIXTURE_ONLY · UNKNOWN_NEEDS_PROOF

---

## Matrix rows

| Family | Model | Genuine count | Write path | Evidence | Provider | Runtime component | Surface | Synthetic | Status | Exact break | Recommended repair | Risk | Verification gate |
|--------|-------|--------------:|------------|----------|----------|-------------------|---------|-----------|--------|-------------|-------------------|------|-------------------|
| Preference fact | ReferenceItem | 1 active; 7 cand | import extract + review accept | source session/msg; UEL weak on accept | map-profile-facts | canonical map.tsx | Map Preferences | composition may hide | **PARTIALLY_CONNECTED** | RI accept lacks MU/UEL completeness; composition mask | Wave 1 translation + Wave 2 RI proofs + Wave 3 Map cutover | Med | Accept curated RI → fact visible on live Map without seed rails |
| Goal memory (RI) | ReferenceItem goal | 17 cand | extract + accept | source FKs | chat memory / actions; not map-profile-facts | map goals rail ≠ RI | Map Goals empty | seed m-goal-* | **DUPLICATED_OR_CONFLICTING** | Three goal homes; Map remap ignores RI goals | Unify goal contract; Map read RI goals or explicit remap | High | Accepted RI goal appears as goal (not only chat) |
| Constraint fact | ReferenceItem | 4 cand | same | source FKs | map-profile-facts | map.tsx | Constraints | composition | **PARTIALLY_CONNECTED** | none active; mask | Accept curated constraints | Med | Active constraint fact on Map |
| Conflict | ContradictionNode | 25 cand | import + detect + review | ContradictionEvidence | map-api does **not** ingest CN; Active conflicts ← disputed UM only | map.tsx | Active conflicts | composition m-conflict-* | **MISSING_READ_PATH** | open CN not on Map rail (W1-C) | Wave 1.1 then 2.1 | Med | After 1.1+2.1: open CN on Map + MU |
| Patterns | PatternClaim | 7 active | import batch auto-active | PCE 33 | map-api | map.tsx | Patterns | composition loops | **SURFACED_THROUGH_SYNTHETIC_FALLBACK** | live patterns exist but rails replaced by seed when composition present | Map cutover after unmask readiness | Med | Live Map shows 7 claims; no m-loop-* |
| Legacy profile claims | ProfileArtifact | 203 cand | profile-derivation | spans | none for Orvek Map | — | — | — | **LEGACY_ORPHANED** | Map unread | Decide archive vs translate | High | Explicit product decision receipt |
| User-model conclusion | UserMapConclusion | 1 | dark-engine / publish | 50 UEL | map-api | map.tsx | Map rails | composition claims | **SURFACED_THROUGH_SYNTHETIC_FALLBACK** | masked by seed rails | Map cutover | Med | Live UM visible without densograph claim |
| Model movement | ModelUpdate | 1 | UM publish; CN accept | affectedObject | timeline/inspector/today | timeline + evidence-panel | Movement | seed report/mu-* | **PARTIALLY_CONNECTED** | RI accept no MU; seed report dominates | MU on materialisations; report unmask | Med | Genuine MU visible; seed report gone |
| Decisions | SurfacedAction | 7 | actions sync | linkedClaim | decisions-api | decisions.tsx | Decisions | composition d* | **SURFACED_THROUGH_SYNTHETIC_FALLBACK** | typed decision capture missing; seed groups | Decisions cutover + later entry | Med | Live actions list without d1 |
| Outcomes | SurfacedAction fields | 7 not_started | PATCH outcome | note | decisions | decisions.tsx | outcome controls | — | **PARTIALLY_CONNECTED** | no MU; header chip dead | Wire durable only; optional MU | Low | Outcome persists + visible |
| Active questions | Investigation | 0 | dark-engine / APIs | — | AQ API | explore.tsx | Questions | composition aq-* | **MISSING_WRITE_PATH** | no genuine inv; seed questions | Natural-entry / publish later | Med | Genuine question without aq-* |
| Experiment | FieldworkAssignment | 1 | fieldwork APIs | linkedObject | experiment-api | explore FieldworkBridge | Experiment | f1/f2 | **PARTIALLY_CONNECTED** | thin provenance; seed mask | Experiment cutover | Med | Live fieldwork card |
| Evidence spans | EvidenceSpan | 5922 | import/profile | message anchor | inspector depth | EvidencePanel | Evidence | densograph receipts | **PARTIALLY_CONNECTED** | depth gates; seed receipts | Depth after cutover | Med | Span-backed evidence on selected object |
| Import review | RI+CN cand | 53 | import | session/msg | importReview live | ImportOverlay | Import | seed overridden | **FULLY_CONNECTED** | — | Maintain; quality filter later | Low | Live pending list = DB counts |
| Today briefing | Composition / MU | seed + 1 MU | composition seed; MU publish | — | today hybrid | today.tsx | Today | **seed densograph** | **SURFACED_THROUGH_SYNTHETIC_FALLBACK** | composition replaces Today | Today cutover after proofs | High | Today without full_reference densograph |
| Reports | CanonicalModelMovementReport | 1 seed | seed | related* JSON | report overlay | ReportOverlay | Reports | seed weekly | **FIXTURE_ONLY** | no genuine report | Generate from MU or hide | Med | No seed report on root |
| Capture composer | — | — | overlay mock | — | — | CaptureOverlay | Capture | fake saved | **MISSING_WRITE_PATH** | no API | Do not use; journal-chat later | Low | N/A until wired |
| Goal vs ProfileArtifact GOAL | dual | 17+28 | both extract | — | split | — | — | — | **DUPLICATED_OR_CONFLICTING** | dual stores | Single goal authority | High | One write/read contract |
| Pattern LLM LF | derivation shadow | — | shadow | — | none product | — | — | — | **LEGACY_ORPHANED** | not product | Leave shadow | Low | Confirm unused |
| Strengths / working style | — | 0 | — | — | — | — | — | — | **MISSING_WRITE_PATH** | unsupported | Later extraction quality | — | Explicit unsupported |
| Environmental triggers | UNKNOWN | — | may fold into trigger_condition | — | — | — | — | — | **UNKNOWN_NEEDS_PROOF** | ambiguous | Spec before build | — | Spec receipt |

---

## Classification totals

| Status | Count |
|--------|------:|
| FULLY_CONNECTED | 1 |
| PARTIALLY_CONNECTED | 8 |
| STORED_NOT_SURFACED | 0 |
| SURFACED_THROUGH_SYNTHETIC_FALLBACK | 5 |
| MISSING_WRITE_PATH | 3 |
| MISSING_READ_PATH | 1 |
| LEGACY_ORPHANED | 2 |
| DUPLICATED_OR_CONFLICTING | 2 |
| FIXTURE_ONLY | 1 |
| UNKNOWN_NEEDS_PROOF | 1 |
| **Total rows** | **24** |

Clarification (receipt 15): Conflict reclassified from STORED_NOT_SURFACED → MISSING_READ_PATH (Map does not project ContradictionNode).

JSON twin: `intelligence-compatibility-matrix.json`.
