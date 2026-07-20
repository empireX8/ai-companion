# 02 — Landed acceptance path trace

**Phase:** A (documentation only — no edits)
**Baseline:** `9883c41` @ `desktop-single-real-contradiction-proof-001`

---

## End-to-end flow (ContradictionNode)

```
Imported ContradictionNode (status=candidate, sourceSession.origin=IMPORTED_ARCHIVE)
  → GET /api/import-review/candidates
  → mapPendingImportPageToReviewBatch → Orvek Import overlay (live DB; not composition seed)
  → HUMAN: Accept on one card
  → POST /api/import-review/candidates/[key]/decide { decision: "accept" }
  → decideImportCandidate (db.$transaction)
       → assertImportDerivedCandidate (IMPORTED_ARCHIVE gate)
       → materialiseAcceptedContradiction
            → status candidate → open (+ lastTouchedAt)
            → UEL links (message, evidence_span≤5, session, import_record)
            → ModelUpdate link_detected if none exists for affectedObjectId
  → GET /api/contradiction?status=open (Map fetch)
  → lib/orvek-adapters/map.ts → rail "conflicts"
  → buildMapProductionDataApi → canonical map.tsx Active conflicts
  → mergeLiveContradictionConflicts (composition-safe overlay)
  → selection → inspectorObjectType contradiction_node
  → GET /api/inspector/contradictions/[id]
  → refresh: status=open + UEL + MU persist in DB
```

---

## 1. Import review candidate GET

| Item | Detail |
|------|--------|
| Route | `GET /api/import-review/candidates` |
| File | `app/api/import-review/candidates/route.ts` |
| Auth | Clerk `userId` required |
| Query | `listPendingImportCandidates` — ReferenceItem + ContradictionNode where `status=candidate` and `sourceSession.origin=IMPORTED_ARCHIVE` |
| Order | `createdAt ASC`, then `sourceTable`, then `id` |
| Presentation | `mapPendingImportPageToReviewBatch` → `OrvekImportReviewBatch` |
| UI | `components/orvek-v0/overlays.tsx` `ImportOverlay` — live list from hybrid provider; seed only on `referenceSurface` fixture |

ContradictionNode cards show `Their words` from evidence excerpt / source message; `proposed` = generic title (`Constraint conflict` / `Goal behavior gap`); metadata includes `Source table: ContradictionNode`.

---

## 2. Candidate decision POST

| Item | Detail |
|------|--------|
| Route | `POST /api/import-review/candidates/[key]/decide` |
| File | `app/api/import-review/candidates/[key]/decide/route.ts` |
| Body | `{ decision: "accept" \| "reject" }` |
| Key | URL-encoded `contradiction_node:<uuid>` or `reference_item:<uuid>` |
| Handler | `decideImportCandidate({ userId, reviewKey, decision })` |

**Phase A:** endpoint not called.

---

## 3. decideImportCandidate

| Item | Detail |
|------|--------|
| File | `lib/import-candidate-review-actions.ts` |
| Transaction | `db.$transaction(async (tx) => { ... })` — single boundary |
| CN accept guard | Requires `status=candidate` (or idempotent re-accept when already `open`) |
| Reject guard | CN → `archived_tension` (forbidden in Wave 2.1 proof) |
| Scope | Does **not** mutate PatternClaim, existing UM rows (except new MU for CN), or other candidates |

---

## 4. materialiseAcceptedContradiction

| Step | Behaviour |
|------|-----------|
| Status | `candidate` → `open` (skip update if already `open`) |
| UEL message | `UnderstandingLinkSourceType.message`, role `supports`, if `sourceMessageId` |
| UEL evidence_span | Up to **5** spans on source message, role `supports` |
| UEL session | `sourceSessionId`, role `context` |
| UEL import_record | Latest completed `ImportUploadSession` id, role `context` |
| Duplicate UEL | `createUnderstandingEvidenceLinkForUser` → duplicate caught, counted not thrown |
| ModelUpdate | `findFirst` by `affectedObjectType=contradiction_node` + `affectedObjectId`; create only if absent and first accept |
| MU fields | `updateType=link_detected`, `visibility=user_visible`, `isMeaningful=true`, gap note in `internalNotes` |

ReferenceItem accept path is separate (`materialiseAcceptedReference`) — **out of scope** for this campaign.

---

## 5. Authenticated contradiction read

| Item | Detail |
|------|--------|
| List | `GET /api/contradiction?status=open&limit=50&page=1` |
| Client | `fetchMapOpenContradictions` in `lib/map-open-contradictions.ts` |
| Filter | Only `status=open`; candidates excluded |
| Hybrid hook | `useOrvekHybridWorkbenchDataApi` loads open CNs for Map merge |

---

## 6. Map Active conflicts projection

| Layer | File / function |
|-------|-----------------|
| Adapter | `lib/orvek-adapters/map.ts` — `openContradictions` → ontology rail `"conflicts"`, id prefix `contradiction-{rawId}` |
| Production API | `lib/orvek-v0/production/map-api.ts` — `railItemToOrvekObject` kind `"contradiction"`, `inspectorObjectType: contradiction_node` |
| Hybrid merge | `lib/orvek-v0/production/hybrid-workbench-api.ts` — `mergeLiveContradictionConflicts` |
| Composition rule | `applyCompositionWorkbenchRails` replaces most Map rails from seed **but** live CN conflicts overlay into `conflicts` category without replacing seed `m-conflict-*` rows |

Wave 1.1 landed this read path; CONTRADICTION-MAP-CONFLICT-PROJECTION-001 human click gate PASS on dev fixture; Kay live account still has 0 open CN until accept.

---

## 7. Inspector fetch

| Item | Detail |
|------|--------|
| Route | `GET /api/inspector/contradictions/[id]` |
| File | `app/api/inspector/contradictions/[id]/route.ts` |
| Public statuses | `open`, `explored`, `snoozed`, `resolved`, `accepted_tradeoff`, `archived_tension` |
| Client | `fetchInspectorContradiction` in `lib/inspector-object-api.ts` |
| UI | `evidence-panel.tsx` / `SelectedObjectEvidencePanel.tsx` when `inspectorObjectType === "contradiction_node"` |

After accept, `status=open` satisfies inspector gate.

---

## 8. Idempotency and duplicate prevention

| Mechanism | Detail |
|-----------|--------|
| Re-accept open CN | Returns `idempotent: true`, `alreadyMaterialised: true` |
| UEL duplicates | Unique constraint + `UnderstandingEvidenceLinkDuplicateError` → skip |
| MU duplicate | `findFirst` on affected object before create |
| Open CN duplicate on Map | Dedupe by raw id in `fetchMapOpenContradictions` |

---

## 9. What Phase A did not exercise

- Human Accept click
- POST decide endpoint
- Post-accept Map/Inspector/refresh on Kay account
- Model Movement Timeline under composition workbench (may remain seed-masked; MU row still created in DB)
