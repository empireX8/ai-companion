# ORVEK CANONICAL MODELUPDATE INSPECTOR READER CONTRACT 001

**Status:** design contract for review
**Date:** 2026-07-30
**Scope:** canonical `ModelUpdate` Inspector read semantics and object-path contract
**Does not do:** change runtime code, schema, tests, routes, shell layout, or UI
**Controlling frame:** Orvek is an evidence-backed private intelligence system. Presentation must not become a competing truth store.

---

## 1. Sources Inspected

This contract is based on:

- `docs/architecture/ORVEK-CANONICAL-OBJECT-MAP-001.md`
- `docs/agent-runs/receipts/ORVEK-CANONICAL-MODEL-AUTHORITY-V1/00-final-receipt.md`
- `docs/CURRENT-DESKTOP-REFERENCE-AUTHORITY.md`
- `lib/canonical-model-projection.ts`
- `lib/canonical-model-product-projection.ts`
- `lib/current-understanding-product-projection.ts`
- `lib/canonical-concept-registration.ts`
- `lib/canonical-revision-evidence.ts`
- `lib/explore-movement-proposal.ts`
- `lib/canonical-publication-integrity.ts`
- `lib/what-changed-reality-report.ts`
- `lib/canonical-movement-list-merge.ts`
- `lib/orvek-v0/production/model-update-inspector-presentation.ts`
- `components/orvek-v0-authority/evidence-panel.tsx`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/inspector/panels/ModelMovementInspectorPanel.tsx`
- `components/inspector/panels/CanonicalConceptInspectorPanel.tsx`
- `components/orvek-v0/workbench.tsx`
- `components/orvek-v0/OrvekShellLayout.tsx`
- `components/orvek-v0/store.tsx`
- `components/orvek-v0/production/ProductionInspectorBridge.tsx`
- `lib/__tests__/desktop-permanent-shell-cross-page-regression.test.tsx`
- `lib/__tests__/inspector-permanent-shell-regression.test.tsx`
- `lib/__tests__/inspector-surface-wiring.test.ts`
- `lib/__tests__/model-update-inspector-presentation.test.ts`
- `lib/__tests__/canonical-concept-inspector-panel.test.ts`
- `lib/__tests__/canonical-phase6-static-honesty.test.ts`

---

## 2. Architectural Baseline

The active desktop Inspector shell is the permanent shared shell:

- `components/orvek-v0/workbench.tsx` mounts `OrvekShellLayout`.
- `OrvekShellLayout` owns the top bar, left navigation, main page region, and right Inspector slot.
- `components/orvek-v0-authority/evidence-panel.tsx` owns the permanent Inspector geometry.
- `ProductionInspectorBridge` mirrors the selected workbench object into the older Inspector context for compatibility.

A canonical `ModelUpdate` reader must feed the existing `EvidencePanel` and its existing `ObjectDetail` / `MovementView` object pathway. It must not mount a separate Inspector, a duplicate What Changed layout, a separate shell, or a URL-only authority path.

Canonical lineage resolution must happen server-side through the existing authenticated `/api/what-changed/[id]` read path or the server read service behind that route. The browser must receive a verified canonical `ModelUpdate` Inspector projection. The client/browser composer may format that projection for the permanent Inspector shell, but it must not reconstruct canonical lineage, query authority tables, decode raw authority fields, or infer missing canonical identity.

The Canonical Model Authority V1 baseline is:

1. `CanonicalConceptRevision` is the sole current truth for a registered concept.
2. `CanonicalConcept.currentRevisionId` points to the current revision.
3. `CanonicalConceptRevision` rows are immutable.
4. `ModelUpdate` is movement history, not current truth.
5. Product reads fail closed on canonical corruption.
6. Committed canonical history remains readable after creation gates are disabled.

---

## 3. Object Meanings

| Term | What it represents | May own current truth? | Inspector consequence |
|---|---|---:|---|
| Canonical `ModelUpdate` | Immutable movement receipt that one canonical revision changed into another through a published Explore proposal | No | Reader of movement identity, before/after, acceptance time, and lineage |
| Canonical concept | Stable identity for one semantic concept | Owns current pointer only | Selectable Map/Inspector object by concept id |
| Canonical revision | Immutable version of Orvek's understanding of that concept | Yes, only when it is the concept's current revision | May supply current-state wording after lineage verification |
| Evidence record | Stored source or evidence link, such as message, journal entry, reference item, pattern, contradiction, or `UnderstandingEvidenceLink` | No | Can support, contradict, or contextualize a revision or movement |
| Receipt | User-facing projection over real evidence | No | Can appear only when backed by a real evidence/link row or canonical public evidence projection |
| Signal | A typed source object or evidence role that supports or conflicts with the read | No | Must come from explicit `supports` / `contradicts` roles or linked source objects |
| Context object | Explicit relevant background, usually role `context` or a bound explicit memory source | No | Must remain empty unless there is an explicit context link or source binding |
| Related object | Existing object reachable through typed links, source bindings, affected-object identity, or selection graph | No | Must not be inferred by title similarity, shared words, or generic report prose |

`ModelUpdate` and canonical revision must stay separate: the `ModelUpdate` explains a transition; the resulting revision is the resulting current or historical state.

---

## 4. Field Authority

### 4.1 Server-Side Fields Read Directly From `ModelUpdate`

These fields are authoritative for the movement record and may be read by the authenticated server read path:

- `id`
- `userId`, only for ownership filtering
- `visibility` and `isMeaningful`, only for read eligibility
- `updateType`
- `affectedObjectType`
- `affectedObjectId`
- `userFacingSummary`
- `createdAt`
- `beforeSummary`
- `afterSummary`
- `canonicalConceptId`
- `previousRevisionId`
- `resultingRevisionId`
- `exploreProposalId`
- decoded movement rationale from `internalNotes`, only through the existing lineage decoder, never as raw `internalNotes`

These fields must not be exposed raw in the browser Inspector projection:

- `internalNotes`
- `confidenceDelta`, except as the existing movement confidence shift if already projected by the read model
- ownership fields
- registration hashes
- raw proposal/source JSON
- raw private evidence text that is not public/Inspector-safe

### 4.2 Server-Side Fields That May Be Read From The Resulting Revision

The server reader may read resulting revision fields only after the canonical `ModelUpdate` lineage resolves and verifies:

- `id`
- `conceptId`
- `version`
- `title`
- `summary`
- `status`
- `confidenceScore`
- `confidenceLevel`
- `evidenceCount`
- `rationale`
- `acceptedAt`
- `operation`
- `decisionSource`
- `createdFromProposalId`
- public/Inspector-safe evidence projection for the revision

The resulting revision may supply current-state labels and current-state readout. It must not rewrite:

- `ModelUpdate.userFacingSummary`
- movement `beforeSummary`
- movement `afterSummary`
- movement creation time
- previous/resulting revision identity
- revision history

### 4.3 Browser Projection Boundary

The browser receives a verified canonical `ModelUpdate` Inspector projection from `/api/what-changed/[id]` or its server read service. That projection may include:

- safe, server-verified display fields such as `modelUpdateId`, update label, displayed title, distinct summary, created time, rationale, and immutable before/after
- labelled direct movement evidence
- labelled resulting revision evidence
- current-state labels supplied by the verified canonical product projection
- evidence projections that are genuine and Inspector-safe
- any verified opaque selection id required for an explicit related-object navigation action
- explicit empty-state markers for absent relationships

The browser composer must not receive raw proposal records, raw `internalNotes`, ownership fields, registration hashes, unprojected evidence text, or authority fields for the purpose of reconstructing or re-verifying lineage. It may not re-run canonical proposal lookup, infer canonical lineage, query legacy UMC authority as fallback, or decode raw authority fields.

Merely receiving a verified opaque identifier for display or navigation is not browser-side lineage reconstruction. The server remains solely responsible for verifying `canonicalConceptId`, `previousRevisionId`, `resultingRevisionId`, `exploreProposalId`, proposal ownership, and movement-history consistency before any projection reaches the browser.

---

## 5. Canonical Lineage Resolution

Canonical lineage resolution is a server-side responsibility of the authenticated `/api/what-changed/[id]` read path or its shared server read service. The result is a verified canonical `ModelUpdate` Inspector projection that the browser can render without raw authority access.

The server resolves a canonical `ModelUpdate` as follows.

1. Load a `ModelUpdate` row for the authenticated user with `visibility=user_visible` and `isMeaningful=true`.
2. Classify it as canonical if any canonical identity is present:
   - `canonicalConceptId`
   - `previousRevisionId`
   - `resultingRevisionId`
   - `exploreProposalId`
   - `affectedObjectType=canonical_concept_revision`
   - deterministic canonical proposal ownership of the `ModelUpdate.id`
3. For a canonical row, require all identity fields to be present:
   - `canonicalConceptId`
   - `previousRevisionId`
   - `resultingRevisionId`
   - `exploreProposalId`
   - `affectedObjectType=canonical_concept_revision`
   - `affectedObjectId=resultingRevisionId`
4. Verify the owning Explore proposal:
   - same authenticated user
   - `authorityMode=canonical_v1`
   - `status=published`
   - `canonicalConceptId` matches the row
   - `id=exploreProposalId`
   - `deriveExploreMovementModelUpdateId(proposal.id)=ModelUpdate.id`
   - `proposal.modelUpdateId=ModelUpdate.id`, unless deterministic ownership is the explicitly accepted compatibility proof
5. Load `readCanonicalProductConceptForUser(userId, canonicalConceptId)` on the server.
6. Find exactly one `movementHistory` entry with `modelUpdateId=ModelUpdate.id`.
7. Verify the movement entry matches the `ModelUpdate` row exactly:
   - `exploreProposalId`
   - `previousRevisionId`
   - `resultingRevisionId`
   - `beforeSummary`
   - `afterSummary`
   - `canonicalConceptId`
8. Build the browser-safe Inspector projection from the verified movement row, verified movement history entry, and verified canonical product concept/revision envelope.

The browser/client composer must not perform any of these lineage checks. It must not receive raw `canonicalConceptId`, `previousRevisionId`, `resultingRevisionId`, `exploreProposalId`, proposal records, authority rows, or `internalNotes` for lineage reconstruction or re-verification. A server-verified opaque id included only for display or explicit related-object navigation does not make the browser responsible for lineage.

The server reader must not backfill, register, publish, or materialize canonical rows. If a missing or corrupt lineage can be repaired, that belongs to the canonical registration/publication/backfill service, not the Inspector read path.

---

## 6. Inspector Field Rules

### 6.1 Summary

For a canonical `ModelUpdate`, Summary means a distinct non-duplicative movement summary.

Source order:

1. Server-projected `ModelUpdate.userFacingSummary`, only if it is distinct from the displayed object title and not a generic shell label.
2. Existing selected `OrvekObject.summary`, only if it is the same live `ModelUpdate` object, is server-projected, is distinct from the displayed object title, and is not generic fallback text.

When `ModelUpdate.userFacingSummary` is already the displayed object title, the Summary slot remains neutral unless a distinct non-duplicative summary exists. The resulting revision `summary` may appear as a current-state label or affected concept read, but it must not replace the movement Summary. If no distinct movement summary exists, show the existing empty state. Do not substitute the revision summary as movement copy.

### 6.2 Why It Matters

Why it matters means why this published movement was accepted or why the resulting revision matters.

Allowed sources:

1. Server-projected decoded movement rationale, if decoded by the existing lineage decoder and tied to the verified Explore proposal.
2. Server-projected resulting revision `rationale`, if the revision is verified as `resultingRevisionId`.
3. Existing `OrvekObject.whyItMatters`, only if it came from the verified server projection for the selected `ModelUpdate` and is not generic fallback text.

Do not derive Why it matters from:

- receipt count
- `beforeSummary` / `afterSummary`
- generated deterministic report prose
- affected object title
- title similarity
- generic "thin packet" warnings

If no allowed source exists, keep the section empty through the existing permanent empty state.

### 6.3 Receipts

Receipts must be backed by real links or canonical evidence projection. Direct movement evidence and resulting revision evidence are different receipt classes and must be labelled distinctly.

Allowed sources:

1. Direct movement evidence: `UnderstandingEvidenceLink` rows with `targetType=model_update` and `targetId=ModelUpdate.id`.
2. Resulting revision evidence: evidence from the verified canonical product concept/revision.
3. Existing Inspector-safe public evidence rows already attached to the selected live `OrvekObject`, only if the server projection identifies whether they are direct movement evidence or resulting revision evidence.

Rules:

- Deduplicate by source type, source id, role, and display text.
- Preserve source role labels where available.
- Label direct movement evidence as evidence for the `ModelUpdate` movement.
- Label resulting revision evidence as evidence for the resulting canonical revision/current understanding, not as direct evidence for the movement event.
- Redacted canonical evidence may appear as redacted receipt metadata, not raw text.
- Do not create receipt cards from `userFacingSummary`, `beforeSummary`, `afterSummary`, current revision summary, or generated report sections.
- Do not query legacy affected-object evidence for a canonical `affectedObjectType=canonical_concept_revision` unless going through the verified canonical product projection.

If none exist, the Receipts section must stay at the permanent empty state.

### 6.4 Supporting And Conflicting Signals

Supporting and conflicting signals are role-based, not prose-based.

Supporting may be populated only from:

- direct movement evidence links with `role=supports`
- resulting revision evidence with `role=supports`, labelled as revision evidence
- selected live object `supporting` entries that are already attached to the selected `ModelUpdate`

Conflicting may be populated only from:

- direct movement evidence links with `role=contradicts`
- resulting revision evidence with `role=contradicts`, labelled as revision evidence
- selected live object `conflicting` entries that are already attached to the selected `ModelUpdate`

Do not treat these as supporting/conflicting signals:

- the affected canonical concept itself
- previous/resulting revision ids
- deterministic report `facts`, `speculations`, `guardrails`, or `whatWouldChangeThisConclusion`
- receipt count
- current revision confidence
- shared words between objects

If no explicit role-based source exists, leave the supporting or conflicting slot empty.

### 6.5 Relevant Background / Context

Relevant background is explicit context, not any related object.

Allowed sources:

- direct movement evidence links with `role=context`
- resulting revision evidence with `role=context`, labelled as revision evidence
- source bindings or context objects that are explicitly typed as background/context and public/Inspector-safe
- selected live object `contextIds` already present in the graph

Disallowed sources:

- legacy seed by default
- affected concept by default
- current revision summary
- generated report guardrails
- inferred "because it mentions the same topic" matches

If no explicit context source exists, keep the background rows empty.

### 6.6 Related Objects

Related objects may include only resolvable existing objects.

Allowed related objects:

- the affected canonical concept, if it resolves to an existing Map/Inspector selection id
- source objects from movement or revision evidence, if the resolver supports the source type
- the bound legacy seed only as a related legacy source, not as current truth, and only if the canonical product envelope exposes it
- existing graph `relatedIds` attached to the selected live `ModelUpdate`

Revision ids (`previousRevisionId`, `resultingRevisionId`) should be shown in Model Movement or metadata, not as fake related objects, unless a first-class selectable revision Inspector path exists.

Do not invent related objects from:

- title similarity
- current revision wording
- report prose
- source type labels such as "Related pattern"
- the existence of an affected-object href without a verified object

If no object resolves, leave related rows empty.

### 6.7 What Would Change This

This section is allowed only when an explicit change condition exists.

Allowed sources:

- an existing selected live `OrvekObject.whatWouldChange`
- an explicit, evidence-backed movement report section stored as a real `CanonicalModelMovementReport`, if such a report exists and is tied to this `ModelUpdate`
- a future canonical revision field designed for disconfirmation/change conditions

Disallowed sources:

- deterministic fallback `whatWouldChangeThisConclusion`
- generic "more receipts would change this" text
- generated fieldwork suggestions
- inferred next steps from low evidence count
- receipt count, confidence, or source diversity alone

Until a canonical field or stored report exists, the correct canonical `ModelUpdate` empty state is "No change condition is available."

### 6.8 Model Movement

Model Movement is the immutable before/after transition.

Source:

- `beforeSummary` and `afterSummary` from the verified canonical movement entry, which must match the `ModelUpdate` row.

Rules:

- `beforeSummary` must equal the previous revision summary at publication time.
- `afterSummary` must equal the resulting revision summary at publication time.
- The resulting state at publication is the resulting revision named by `resultingRevisionId`.
- The current understanding now is the revision named by `CanonicalConcept.currentRevisionId` at read time.
- Movement before/after must not be recomputed from the concept's current revision later.
- If a future revision 3 exists, the revision 2 movement still shows revision 1 -> revision 2; revision 3 may affect current-state labels but cannot alter the revision 2 movement.
- Current-state labels may use the current revision when labelled as current state, but movement history must remain historically fixed.

If canonical movement before/after is missing or mismatched, fail closed for the canonical reader. Do not substitute current revision text or legacy UMC text.

---

## 7. Correct Empty States

These empty states are correct and must remain empty rather than inventing relationships:

| Section | Correct empty condition |
|---|---|
| Summary | No distinct, non-generic, non-duplicative movement summary exists beyond the displayed object title |
| Why it matters | No decoded movement rationale, verified revision rationale, or selected-object rationale exists |
| Receipts | No direct `model_update` evidence links and no verified, labelled resulting revision evidence exists |
| Supporting signal | No explicit `supports` role exists |
| Conflicting signal | No explicit `contradicts` role exists |
| Relevant background | No explicit `context` role, context source binding, or graph `contextIds` exists |
| Related objects | No existing object resolves through affected concept, evidence source, legacy seed, or graph relation |
| What would change this | No explicit change-condition field or stored movement report section exists |
| Model Movement | Canonical before/after lineage is absent or corrupt; canonical reader fails closed instead of showing fallback movement |

Permanent geometry still renders the slots required by `EvidencePanel`; the content stays neutral and disabled when the data is absent.

---

## 8. State Labels Versus Movement History

The canonical `ModelUpdate` Inspector reader must keep three time axes separate.

1. Resulting state at publication:
   - The resulting revision named by `resultingRevisionId`.
   - This is the "after" state created by the movement.
   - It may be displayed as the resulting revision state for this movement.

2. Current understanding now:
   - The revision named by `CanonicalConcept.currentRevisionId` at read time.
   - This may be the same revision as `resultingRevisionId`, or a later revision.
   - It may supply current-state labels inside the canonical `ModelUpdate` Inspector only when labelled as current state.

3. Immutable movement before/after:
   - `beforeSummary` and `afterSummary` from the verified movement history entry.
   - These fields stay fixed forever for the selected `ModelUpdate`.
   - They are not recomputed from the current concept revision.

Example:

- Revision 1 summary: `I don't like tea anymore`.
- Revision 2 summary: `I like tea again now`.
- Revision 2 `ModelUpdate` movement: before `I don't like tea anymore`, after `I like tea again now`.
- Future revision 3 summary: `I like green tea but not black tea`.
- When reading the revision 2 `ModelUpdate` after revision 3 exists, Model Movement still shows revision 1 -> revision 2. A separately labelled current-state read may show revision 3. Revision 3 must not rewrite revision 2's movement summary, before/after, resulting revision id, or history.

For this contract, current-state label repair is limited to labels inside the canonical `ModelUpdate` Inspector projection. Map rail labels, Timeline affected-object labels, canonical concept Inspector titles, and other cross-surface title consistency checks are separately tracked follow-up work.

The reader must never let a legacy registration title outrank a verified canonical current revision label inside the canonical `ModelUpdate` Inspector. The reader also must never let the current revision rewrite the movement's historical before/after.

---

## 9. Navigation And Selection Behavior

### Explore

- A proposed correction against a canonical concept uses the existing in-memory `canonicalCorrectionHandoff`.
- Explore receives context only; it does not mutate authority.
- Publishing a canonical Explore proposal creates a canonical revision and `ModelUpdate` through the existing publication path.
- After publication, selecting the movement selects the `ModelUpdate` id with the movement tab.

### Map

- Canonical Map selections represent canonical concepts, not legacy UMC authority.
- The selected object id is the concept id.
- `inspectorObjectType` must be `canonical_concept`.
- `currentRevisionId` must be carried for correction handoff and current-state labeling.
- Map must not call legacy UMC detail/evidence routes for canonical selections.

### Timeline

- Timeline movement rows select `model_update`.
- Timeline uses the movement tab for movement rows.
- Canonical movement list rows come from the canonical movement merge service and suppress duplicate legacy rows by canonical `ModelUpdate.id`.
- Timeline must not collapse a `ModelUpdate` selection into the affected concept unless the user explicitly follows a related-object link.

### Inspector

- `WorkbenchProvider.select` is the primary selection entrypoint.
- `pushSelection` and `goBack` preserve linked-object navigation and scroll restoration.
- `ProductionInspectorBridge` mirrors selected workbench objects to the older Inspector context without replacing the permanent `EvidencePanel`.
- A canonical `ModelUpdate` remains selected as a `ModelUpdate`; related canonical concept navigation must be explicit.
- `resolveWorkbenchSelectionId` may resolve existing graph objects. It must not synthesize objects simply because a canonical id exists.

### Page Navigation Selection Clearing

This contract does not require cross-page workbench selection to persist. Whether selection clears, restores, or carries across page navigation is an unresolved shared-shell contract. It is outside the canonical `ModelUpdate` Inspector reader implementation and must not be made an acceptance condition for this slice.

---

## 10. Acceptance Tests For A Future Implementation

Implementation acceptance for this contract is limited to the canonical `ModelUpdate` Inspector reader and its server projection.

1. Server read-path lineage tests:
   - `/api/what-changed/[id]` or its server read service resolves a canonical row with full identity to concept, previous revision, resulting revision, proposal, and movement entry
   - missing `canonicalConceptId`, `previousRevisionId`, `resultingRevisionId`, or `exploreProposalId` fails closed server-side
   - deterministic proposal ownership is accepted only as identity verification, not as a replacement source for missing lineage fields
   - movement entry mismatch fails closed server-side
   - the browser response is a verified Inspector projection, not raw authority data

2. Browser projection boundary tests:
   - the client composer does not reconstruct lineage
   - the client composer does not query proposal/canonical authority fields
   - the client composer does not decode `internalNotes`
   - the client composer renders only server-projected, Inspector-safe fields

3. Canonical `ModelUpdate` Inspector field tests:
   - Summary remains neutral when `ModelUpdate.userFacingSummary` duplicates the displayed object title
   - Summary uses only a distinct non-duplicative movement summary
   - Why it matters uses server-projected movement rationale or verified resulting revision rationale only
   - direct movement evidence and resulting revision evidence are labelled distinctly
   - receipts/supporting/conflicting/background/related sections remain empty when explicit links are absent
   - deterministic fallback report text does not populate What would change this
   - Model Movement before/after remains the original publication transition
   - resulting state at publication, current understanding now, and immutable movement before/after are not conflated

4. Permanent Inspector shell regression tests:
   - `data-shell-slot` and `data-shell-item` signatures from `inspector-permanent-shell-regression.test.tsx` remain unchanged
   - no standalone production `ModelUpdate` Inspector functions are introduced
   - `EvidencePanel` continues to own ObjectDetail and MovementView
   - linked rows are disabled and identity-free when data is absent

## 11. Separately Tracked Follow-Ups

These items are related but outside implementation acceptance for the canonical `ModelUpdate` Inspector reader:

- Map rail label, Map detail title, and canonical concept Inspector title consistency
- Timeline affected-object label consistency
- What Changed shell/layout continuity
- cross-page workbench selection persistence, clearing, or restoration semantics
- broader browser regression proving proposal creation, review, publish, propagation, and all cross-surface title consistency
- shared-shell page-navigation selection contract

---

## 12. Explicit Out Of Scope

This contract does not authorize:

- runtime code changes
- schema changes
- migrations
- route changes
- test changes in this design-only slice
- shell layout changes
- What Changed redesign
- a duplicate standalone Inspector layout
- publication or automatic backfill from the Inspector reader
- a second authority path beside Canonical Model Authority V1
- browser-side lineage reconstruction
- browser access to raw canonical authority fields for Inspector composition
- cross-page workbench selection persistence requirements
- Map, Timeline, What Changed, or canonical concept title consistency implementation
- mock insight, static generated insight, or placeholder relationships
- deriving related objects from text similarity
- exposing raw private evidence
- changing revision history or before/after movement semantics
- expanding V1 beyond the existing controlled revision semantics

---

## 13. Implementation Boundary

The eventual implementation should be a read-model repair, not a new product surface.

The correct shape is:

1. Keep canonical authority writes in existing registration/publication/backfill services.
2. Keep product reads in existing canonical projection/product projection services.
3. Add or adjust only the server-side canonical `ModelUpdate` reader so it verifies lineage, reads the resulting revision through the product envelope, and returns a browser-safe Inspector projection through `/api/what-changed/[id]` or its shared read service.
4. Keep the browser composer limited to formatting the verified projection for the permanent `EvidencePanel`.
5. Keep empty slots empty when the graph does not contain explicit relationships.
6. Fail closed on canonical corruption.

Review should happen on this document before implementation begins.
