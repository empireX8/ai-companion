# Phase 3 / Phase 5 Receipt and Link Continuity Contract

Date: 2026-05-18
Type: Follow-on contract (doc only)
Scope: `/Users/user/ai-companion`

## 1. Purpose

This contract defines safe receipt/link continuity for newly surfaced public intelligence objects after the Phase 3 Public Safe-Slice Track closeout.

The goal is to improve cross-surface continuity without weakening trust constraints:
- no internal/candidate leakage,
- no synthetic receipt semantics,
- no fake link construction,
- read-only-first public behavior.

## 2. Roadmap Position

- Phase 3 Public Safe-Slice Track is `CLOSED / VALIDATED`.
- Full Phase 3 remains `PARTIAL`.
- This contract is a Phase 3 follow-on and a Phase 5 continuity bridge.
- Phase 6 remains `IN PROGRESS`.
- Mobile parity for these new continuity paths remains deferred until web continuity is stable.

## 3. Current Continuity Baseline

Current safe links:
- `/active-questions/{id}`
- `/watch-for/{id}`
- `/your-map/{id}`
- model-update surfaced links:
- `usermap_conclusion -> /your-map/{id}`
- `pattern_claim -> /patterns/{id}`
- `contradiction_node -> /contradictions/{id}`

Current production receipt namespaces:
- `receipt-pattern-*`
- `receipt-tension-*`

## 4. Global Rules

- real IDs only
- no label/title/body-derived IDs
- no synthetic receipts
- no `receipt-action-*`
- no new receipt namespace until explicitly contracted
- no forced pattern/tension receipt semantics onto new objects
- unsupported/blank targets must use: `No linked detail available yet.`
- missing evidence must use: `No linked evidence available yet.`
- internal/candidate data must not be exposed
- public continuity must remain read-only first

## 5. Object-by-Object Continuity Contract

### A. UserMapConclusion / Your Map

Current safe continuity:
- read-only list/detail routes exist with authenticated user-owned + `visibility=user_visible` filtering.
- detail currently uses honest fallback evidence copy.

Missing continuity:
- no evidence-link traversal from conclusion detail to public-safe supporting objects.

Allowed links:
- real `conclusion.id` detail route (`/your-map/{id}`).
- only allowlisted public target links if a future continuity layer resolves them from persisted evidence.

Unsafe/deferred links:
- internal review links.
- candidate/internal-only conclusion links.
- fabricated receipt links.

Evidence/receipt posture:
- keep `No linked evidence available yet.` until safe evidence-link projection is contracted.

Smallest safe next step:
- additive read-only evidence summary block sourced from allowlisted `UnderstandingEvidenceLink` rows with strict filtering.

### B. Investigation / Active Questions

Current safe continuity:
- read-only list/detail routes with authenticated user-owned filtering and safe status gating.

Missing continuity:
- no explicit evidence-link continuity section in detail.

Allowed links:
- `/active-questions/{id}`
- allowlisted linked-object routes only when target IDs are real and resolvable.

Unsafe/deferred links:
- label-derived target routes.
- candidate/internal evidence targets.
- synthetic continuity from prose fields.

Evidence/receipt posture:
- no new receipt namespace.
- evidence continuity remains non-link fallback until allowlisted mapping is introduced.

Smallest safe next step:
- read-only linked-evidence list with source/target allowlists and non-link fallback.

### C. FieldworkAssignment / Watch For

Current safe continuity:
- read-only list/detail routes with authenticated user-owned filtering and safe status gating.
- linked target rendering already uses allowlisted route mapping + fallback.

Missing continuity:
- no dedicated evidence continuity from fieldwork record to supporting evidence links.

Allowed links:
- `/watch-for/{id}`
- existing allowlisted linked-object routes with real IDs only.

Unsafe/deferred links:
- unsupported object targets rendered as links.
- derived IDs from prompt/reason text.
- synthetic receipt overlays.

Evidence/receipt posture:
- keep evidence posture read-only and fallback-first.

Smallest safe next step:
- additive evidence references panel with strict source/target allowlists.

### D. ModelUpdate / What Changed

Current safe continuity:
- list-only read-only feed with authenticated user-owned + `visibility=user_visible` + `isMeaningful=true`.
- allowlisted real-ID affected-object links only.

Missing continuity:
- no public model-update detail route.
- no evidence continuity attached to update items.

Allowed links:
- existing allowlisted affected-object mappings only:
- `usermap_conclusion -> /your-map/{id}`
- `pattern_claim -> /patterns/{id}`
- `contradiction_node -> /contradictions/{id}`

Unsafe/deferred links:
- `/api/model-updates/[id]` public consumption for continuity.
- unsupported affected-object links.
- synthetic canonical detail routes.

Evidence/receipt posture:
- no new receipt namespace for model updates.
- maintain fallback copy for missing/unsupported targets.

Smallest safe next step:
- keep list-only shape, add optional safe evidence indicators only if backed by persisted allowlisted evidence-link rows.

### E. Today Intelligence Update Cards

Current safe continuity:
- additive read-only section sourced from `GET /api/today/intelligence-updates`.
- cards mirror safe ModelUpdate public fields and safe link mapping.

Missing continuity:
- no evidence continuity per intelligence card.

Allowed links:
- same allowlisted real-ID mappings as What Changed.

Unsafe/deferred links:
- direct `/api/model-updates` consumption.
- synthetic receipts derived from card text or labels.

Evidence/receipt posture:
- keep no-receipt behavior in this slice until a continuity contract defines exact semantics.

Smallest safe next step:
- optional evidence availability marker only when evidence-link projection can be guaranteed safe and minimal.

### F. Timeline Model Layer Items

Current safe continuity:
- additive read-only `Model movement` lane sourced from `GET /api/timeline/model-layers`.
- strict public filters and safe allowlisted links with honest fallback.

Missing continuity:
- no evidence continuity per model layer item.

Allowed links:
- same allowlisted real-ID mappings as What Changed/Today model updates.

Unsafe/deferred links:
- extending legacy `/api/timeline` shape for receipt semantics in this pass.
- timeline-generated synthetic links/receipts.

Evidence/receipt posture:
- no evidence links or receipt actions in this slice.

Smallest safe next step:
- additive, separate continuity metadata from an allowlisted evidence projection endpoint/helper without changing timeline baseline behavior.

## 6. Evidence-Link Foundation

Existing foundation:
- `UnderstandingEvidenceLink` model in Prisma schema.
- `GET/POST /api/understanding/evidence-links`.
- writer/helper implementation for ownership-verified persisted link creation:
- `lib/understanding-evidence-link-writer.ts`
- `lib/understanding-links.ts`

Still missing for public continuity rollout:
- public-safe field allowlist for evidence-link read projections.
- explicit source/target allowlist for continuity display.
- unsupported source fallback rules (non-link copy, no synthetic substitutions).
- explicit guards against raw/internal evidence leakage.
- explicit prohibition of synthetic receipt creation for new object types.

## 7. Receipt Namespace Policy

Current production receipt namespaces remain:
- `receipt-pattern-*`
- `receipt-tension-*`

Do not add the following unless a later contract explicitly defines semantics, evidence source, routing, fallback behavior, and tests:
- `receipt-action-*`
- `receipt-user-map-*`
- `receipt-investigation-*`
- `receipt-fieldwork-*`
- `receipt-model-update-*`

## 8. Phase Ownership

- Phase 3 follow-on owns minimal web continuity for newly surfaced public intelligence objects.
- Phase 5 owns broader receipt/link architecture standardization and cross-surface traversal policy.
- This continuity work does not block the already-closed Phase 3 Public Safe-Slice Track.
- It does block full Phase 3 phase-level closure unless explicitly deferred or re-scoped in the ledger.

## 9. Implementation Sequencing Recommendation

1. Contract doc first.
2. Public-safe evidence-link helper audit.
3. Minimal Your Map evidence continuity slice.
4. Active Questions / Watch For linked-object continuity hardening.
5. ModelUpdate continuity hardening.
6. Only then consider mobile parity for these continuity links.

## 10. Non-Goals

Explicitly deferred in this contract:
- schema changes
- new receipt namespaces
- mobile work
- promotion workflows
- Phase 4 Actions/Experiments expansion
- Phase 7 agents/lenses

## 11. Test Contract

Future implementation must include tests for:
- source/target allowlists
- real-ID-only links
- no label-derived IDs
- fallback copy correctness:
- `No linked detail available yet.`
- `No linked evidence available yet.`
- internal/candidate exclusion
- no synthetic receipt IDs
- no `receipt-action-*` regression
- no raw evidence leakage
- existing pattern/tension receipt behavior unchanged

