# 03 — Materialisation pipeline inventory

Starting point: already-persisted `Session(origin=IMPORTED_ARCHIVE)` + `Message` rows.

There is **no `SourceUnit` model**. Closest analogues: upload chunks (ingest) and `EvidenceSpan` (extraction units).

## Pipeline stages

| Stage | Schema | API / worker | Service | Auto? | Manual review? | Downstream consumes? | Canonical provider reads? |
|-------|--------|--------------|---------|-------|----------------|----------------------|---------------------------|
| Upload chunks | `ImportUploadChunk` | `/api/upload/*` | upload service/processor | auto on upload | no | parse only | no |
| Conversations/messages | `Session`, `Message` | import processor | `import-chatgpt.ts` | auto | no | yes | Timeline imported history |
| Evidence spans / profile | `EvidenceSpan`, profile artifacts | during import | `processMessageForProfile` | auto | no | yes | Inspector evidence when linked |
| Derivation runs | `DerivationRun` (`scope=import`) | during import | `createDerivationRun` / complete | auto | no | artifacts | not as first-class UI |
| Reference candidates | `ReferenceItem` status=`candidate` | during import | `extractReferenceFromImportedMessage` | auto | **intended yes; not wired to shell Import** | weak | legacy references; not densograph |
| Contradiction candidates | `ContradictionNode` status=`candidate` | during import | detect + materialize | auto | same gap | Map conflicts when projected | partial |
| Pattern claims | `PatternClaim` + evidence | `onImportComplete` | pattern batch orchestrator | auto | no (status already `active`) | Map/patterns | yes when live APIs project |
| Dark-engine understanding candidates | UM / Investigation / Fieldwork / MU `internal_only` | import completion bridge | `import-completion-candidate-bridge.ts` | gated auto | internal lifecycle/publish | after publish | only if `user_visible` |
| Candidate review (real) | lifecycle fields | `/api/internal/*/candidates/...` | lifecycle transitions | no | **yes (internal UI)** | publish | no until published |
| Candidate review (shell Import overlay) | **composition `workbench.importReview` only** | none (local React state) | `ImportOverlay` | n/a | UI-only | **no persistence** | seed/composition only |
| Publish / model updates | `ModelUpdate` | internal publish routes | publish helpers | manual publish | yes | Today movement | yes |
| Evidence↔object links | `UnderstandingEvidenceLink` | on persist/publish | evidence link writer | auto on those paths | no | Inspector | yes |
| Object↔object links | FKs + densograph `relatedIds` | various | — | partial | — | composition/graph | when present |
| Decisions | `SurfacedAction` | decisions API | decisions presentation | **not from import extraction** | — | Decisions page | yes (separate pipeline) |
| Contexts / questions / experiments / outcomes | various / composition | hybrid APIs | — | **mostly not auto from import** | — | rails | seed currently dominates |
| Canonical Today composition | `CanonicalTodayComposition` | `GET /api/canonical-today-composition` | hybrid/today APIs | seeded or absent | — | Today + ImportReview | **yes — currently full-reference seed** |
| Map / Decisions / Experiment / Timeline / Inspector | production APIs + hybrid | hybrid workbench | presentation adapters | read path | — | shell | live + composition overlay |

## Automatic vs stuck

**Automatic and observed on Kay’s archive**

- Sessions/messages persisted
- 635 import derivation runs completed
- 5,922 evidence spans
- 29 reference candidates + 25 contradiction candidates created
- 7 pattern claims created (`active`) with 33 evidence rows citing imported sessions
- Import-completion dark bridge exists in code; **0 `internal_only` candidates currently present**

**Manual / disconnected**

- Shell Import overlay accept/reject does not write DB
- Internal candidate lifecycle/publish exists but is separate from shell Import
- ReferenceItem (29) and ContradictionNode (25) remain `candidate` indefinitely

**Canonical presentation truth on this account**

- Driven primarily by `CanonicalTodayComposition` `source=full_reference_round_trip_seed` (67 densograph objects + seeded `importReview` with 4 fake candidates)
- Real import-derived `ReferenceItem` IDs are **not** present in composition objects (`refsInComposition=0`)
