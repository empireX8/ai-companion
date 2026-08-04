# ORVEK CANONICAL EVIDENCE REFERENCE-TO-AUTHORITY MATRIX 001

**Status:** accepted architecture control for SUBSYS-003 implementation planning
**Date:** 2026-08-04
**Subsystem:** SUBSYS-003 — Canonical evidence drill-down
**Controlling base:** `origin/staging` @ `3c604eaf5ac846ffb3d939f507df52d08bd3e18f` (current post-PR-202 staging revision)
**Companion contract:** `ORVEK-CANONICAL-INSPECTOR-DRILLDOWN-CONTRACT-001`, Slice A
**Does not do:** runtime implementation, schema, migrations, source unredaction, UI wiring, tests, live-row inspection, or SUBSYS-004+ work

---

## A. Object distinctions

These categories must remain separate. The UI label “Receipt” does not merge them.

1. **Evidence source record**
   Owns the underlying event, statement, entry, span, memory, or observation (for example `Message`, `JournalEntry`, `PatternClaim`, `ReferenceItem`).

2. **UnderstandingEvidenceLink**
   Owns target binding, relationship role, and explicitly governed link annotations (`summary` / `snippet` / `quote` only when the writer contract makes them authoritative for that meaning). It is a relationship edge, not a complete Receipt object.

3. **Browser-safe evidence projection**
   Server output that combines only authorised source and edge fields under an explicit disclosure decision. The browser may render it; it must not reconstruct lineage from raw authority.

4. **Selected Receipt**
   The presentation projection shape needed by the frozen Inspector for one selected evidence item (`OrvekObject` with `type: "receipt"`). It is not another authority store.

5. **CanonicalConceptRevision**
   Owns immutable model state supported or contextualised by evidence.

6. **ModelUpdate**
   Owns movement lineage (previous revision, resulting revision, proposal binding, movement summary).

---

## B. Receipt identity decision

**Decision: `PROJECTION_ONLY`**

- No Receipt table is authorised for SUBSYS-003.
- A selected Receipt has no independent lifecycle state.
- Deterministic selection identity is derived from verified ModelUpdate identity, evidence class, and relationship identity (the existing server hash pattern over those inputs).
- A changed or different relationship may produce a different projected selection.
- Adding a Receipt table would duplicate source and edge authority and is therefore forbidden.

---

## C. Field custody matrix

| Field | Authoritative owner | Permitted derivation | Disclosure restriction | Current static checkpoint | Required runtime proof |
|---|---|---|---|---|---|
| `selectionId` | Server projection over ModelUpdate id + evidence class + relationship id | Opaque deterministic id issued by the server; consumer must use it exactly | Opaque only; not for browser lineage reconstruction | Selected-object adapter replaces it with positional `mu-*` ids | Exact server-issued id survives selection, Back, and reopen |
| `evidenceClass` | Binding target of the verified edge | `direct_movement_evidence` iff target is `model_update`; `resulting_revision_evidence` iff target is `canonical_concept_revision` | Label only | Present on `canonicalEvidenceDrilldown`; dropped by composer | Class label preserved on selected object; never inferred |
| `sourceType` | Source record / UEL `sourceType` | Safe enum or display-safe category via Inspector adapter | Label only | Present on drilldown; not mapped into Receipt fields | Selected object retains source type / label |
| `role` | UEL `role` relative to its target | Display label for that target relationship | Label only | Present on drilldown; reused as MU supporting/conflicting fan-out | Role preserved as evidence-to-target meaning only |
| `title` | Prefer Inspector-safe source title; else safe summary; else type+date; else provenance+type | Slice A title ladder only | Must not use Context, Receipt, blank, or continuity labels as title | Public continuity `"Linked evidence"` and unused source titles degrade meaning | Title follows ladder; never a continuity label |
| `summary` | Inspector-safe source abstract or governed UEL summary | Only through Inspector-safe evidence projection | Only when `sourceDisclosure=available`; else empty | Public projector genericises/redacts before Inspector reuse | Available only when disclosure permits; never invented |
| `snippet` / Receipt `sourceText` | Inspector-safe source body or governed UEL snippet | Map `snippet` → Receipt `sourceText` | Only when `sourceDisclosure=available`; else empty | Composer copies title into `sourceText` | Selected Receipt `sourceText` equals authorised snippet or empty |
| `sourceOrigin` | Source-family / capture-surface adapter | Map origin label → Receipt `sourceOrigin` | Safe labels only; no raw ids | Not mapped onto selected Receipt | Origin line present when adapter can supply a safe label |
| `recordedAt` / Receipt `date` | Prefer Inspector-safe source recorded/authored time; else UEL `createdAt`; else null | Map `recordedLabel` → Receipt `date` | Timestamp/label only | Canonical revision evidence projection omits UEL `createdAt`; resulting drilldown forces null; composer drops date | Available date survives when source or relationship time exists |
| `provenanceLabel` | Evidence class presentation | “Movement evidence” / “Resulting revision evidence” | Label only | Present on drilldown; dropped by composer | Provenance label survives on selected object |
| `sourceDisclosure` | Server disclosure decision | `available` / `redacted` / `unavailable` | Gates summary/snippet/sourceText | Present on drilldown; dropped by composer | Redacted/unavailable never expose source text |
| `supporting` | Explicit evidence that supports **this selected evidence object** | Empty unless independently projected | Inspector-safe only | Composer fans one pool into ModelUpdate supporting | Selected evidence supporting remains empty unless explicit |
| `conflicting` | Explicit evidence that conflicts with **this selected evidence object** | Empty unless independently projected | Inspector-safe only | Composer fans one pool into ModelUpdate conflicting | Selected evidence conflicting remains empty unless explicit |
| `contextIds` | Explicit context selections for the selected object | Empty unless independently projected | Opaque verified ids only | Role=`context` synthesises context pathway from same pool | No role-based context fan-out |
| `relatedIds` | Explicit related selections for the selected object | Empty unless independently projected | Opaque verified ids only | Unrelated pathway risk if pool reused | Empty unless explicit related projection |
| `whatWouldChange` | Explicit change-condition projection only | Remain empty for Slice A evidence objects | N/A | Must stay empty | Remains empty |
| Back identity | Existing workbench selection stack | Return to originating canonical ModelUpdate selection | Opaque selection ids only | Stack-based Back exists; must not invent return targets | Back restores originating ModelUpdate |

---

## D. Correct checkpoint ordering

**Controlling base for this architecture record:** `origin/staging` @ `3c604eaf5ac846ffb3d939f507df52d08bd3e18f` (current post-PR-202 staging).

**Historical provenance (not the current controlling base):** the ordered static failure checkpoints below were first recorded against `origin/staging` @ `857edf3fb416ddca4264292a58cc1d6521906198`. The cited source files and checkpoint order remain unchanged on the current controlling base.

### 1. FIRST TIMESTAMP LOSS

**Path:** `lib/canonical-model-projection.ts`

**Reason:** `CanonicalRevisionEvidenceProjectionV1` and `EvidenceLinkRow` omit `UnderstandingEvidenceLink.createdAt`, and `projectEvidenceForRevisions` does not project it. Relationship time is therefore unavailable to later resulting-revision Inspector projections even when the edge row has `createdAt`.

### 2. FIRST MEANING / DISCLOSURE LOSS

**Path:** `lib/canonical-product-public-evidence.ts` as currently reused by the Inspector resulting-revision path

**Reason:** The general public continuity projection intentionally genericises or redacts source meaning (for example `"Linked evidence"`). This projector is not itself defective for public continuity. The defect is treating that general projection as sufficient Inspector evidence authority for Slice A.

### 3. FIRST SELECTED-OBJECT / RELATIONSHIP BREACH

**Path:** `lib/orvek-v0/production/model-update-inspector-presentation.ts`

**Reason:** the composer:

- ignores `canonicalEvidenceDrilldown.selectionId`;
- creates positional `mu-*` selection ids;
- copies title into `sourceText`;
- does not preserve `evidenceClass`, role, `recordedAt`, `provenanceLabel`, or `sourceDisclosure` as selected-object meaning;
- reuses one evidence pool to populate receipt, context, supporting, and conflicting pathways.

---

## E. Projection boundary rule

- Do **not** weaken `canonical-product-public-evidence` privacy.
- SUBSYS-003 requires an **Inspector-specific** browser-safe evidence projection or adapter.
- The adapter may expose only fields explicitly authorised by the Slice A contract.
- Redacted or unavailable sources must not expose source text.
- Generic labels such as “Linked evidence” are continuity labels, not source titles or evidence summaries.

Public continuity projection and Inspector-safe evidence projection are therefore separate control surfaces.

---

## F. Movement binding rules

- `source → model_update` means `direct_movement_evidence`.
- `source → canonical_concept_revision` means `resulting_revision_evidence`.
- Neither relationship may be inferred from the other.
- One source may have both classifications only through two independently persisted and verified edges.
- Absence of direct movement edges is not itself a defect.
- The browser may not reconstruct either relationship.

---

## G. Operational limitation

Live stored-row shape remains **OPERATIONAL_UNKNOWN** because read-only database access was denied during the preceding custody replay.

This architecture record does **not** claim that live rows were inspected. Runtime work must either complete live confirmation or keep that limitation explicit without fabricating row assumptions.

---

## H. What this record does not authorise

- SUBSYS-003 status promotion to accepted
- evidence clicking as a completed product path
- source-adapter implementation claims
- weakening public redaction to feed the Inspector
- beginning SUBSYS-004 or any later subsystem
- schema, migrations, or a Receipt table

---

## I. Source-type Inspector adapter policy

Authority for which `UnderstandingLinkSourceType` values may target `canonical_concept_revision` is `SUPPORTED_EVIDENCE_LINK_PAIRS` in `lib/orvek-intelligence-object-authority.ts`, enforced by the writer and by `assertEvidenceLinkIntegrity` in `lib/canonical-model-projection.ts`. Ownership verification is `verifyUnderstandingEvidenceLinkSourceOwnership` in `lib/understanding-evidence-link-writer.ts`.

The same source-type rules apply when an identical source type is bound as `direct_movement_evidence` to a `model_update` target.

### I.1 Shared fail-closed rules

1. Ownership is necessary but does not itself authorise disclosure.
2. No source text may be copied from raw `UnderstandingEvidenceLink` `quote`, `summary`, or `snippet` merely because the relationship exists.
3. No adapter may fall back to a public generic continuity label and present it as meaningful private evidence text.
4. If a source-specific Inspector-safe adapter cannot verify safe meaning:
   - preserve the exact opaque `selectionId` where navigation is still authorised;
   - preserve `evidenceClass`, `sourceType`, and target-relative `role`;
   - preserve source timestamp, relationship `createdAt`, or `null` per recorded-date authority order;
   - set disclosure to `redacted` or `unavailable`;
   - omit `sourceText` and `snippet`;
   - use only an approved neutral type/provenance title;
   - create no supporting, conflicting, context, or related pathways.
5. Candidate, archived, missing, cross-user, wrong-type, or otherwise ineligible objects must follow the source-specific fail-closed rule.
6. The browser must never decide source eligibility or unredact content.
7. Unknown or newly added source types fail closed until an explicit source-specific Inspector adapter and tests are accepted.
8. The existing public continuity projector (`lib/canonical-product-public-evidence.ts`) remains restrictive and unchanged.

### I.2 Accepted source types for `targetType = canonical_concept_revision`

| Source type | Authoritative source / resolver | Ownership verification | Inspector-safe title source | Inspector-safe `sourceText` / snippet | Genuine source timestamp | Relationship `createdAt` fallback | Redaction / unavailable conditions | Fail-closed projection |
|---|---|---|---|---|---|---|---|---|
| `pattern_claim` | `PatternClaim` by `id` + `userId` | Writer ownership branch for `pattern_claim` | `PatternClaim.summary` when status is not `candidate`; else neutral type/provenance title | `PatternClaim.summary` only when disclosure=`available` | `PatternClaim.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user/wrong-type → unavailable; `status=candidate` → redacted | Shared rule 4; no continuity label; no UEL quote/summary/snippet copy |
| `pattern_claim_evidence` | `PatternClaimEvidence` via claim ownership (`claim.userId`) | Writer ownership branch for `pattern_claim_evidence` | Neutral “Pattern receipt” / provenance title; parent claim summary only when parent claim is owned and non-candidate | `PatternClaimEvidence.quote` only when non-empty and disclosure=`available` | `PatternClaimEvidence.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user; empty quote without other safe body → unavailable text; parent claim `candidate` → redacted | Shared rule 4 |
| `contradiction_node` | `ContradictionNode` by `id` + `userId` | Writer ownership branch for `contradiction_node` | `ContradictionNode.title` when status is not `candidate` or `archived_tension` | `ContradictionNode.title` only when disclosure=`available` (do not project raw side fields unless a later accepted adapter authorises them) | `ContradictionNode.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user; `candidate` or `archived_tension` → redacted | Shared rule 4 |
| `contradiction_evidence` | `ContradictionEvidence` via node ownership (`node.userId`) | Writer ownership branch for `contradiction_evidence` | Neutral “Signal receipt” / provenance title | `ContradictionEvidence.quote` only when non-empty and disclosure=`available` | `ContradictionEvidence.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user; empty quote → unavailable text; parent node ineligible → redacted | Shared rule 4 |
| `profile_artifact` | `ProfileArtifact` by `id` + `userId` | Writer ownership branch for `profile_artifact` | `ProfileArtifact.claim` when `status=active`; else neutral type/provenance title | `ProfileArtifact.claim` only when `status=active` and disclosure=`available` | `ProfileArtifact.firstSeenAt` (else `lastSeenAt`) | UEL `createdAt`, else `null` | Missing/cross-user; `candidate` or `superseded` → redacted | Shared rule 4; public projector stays fully redacted for this type |
| `evidence_span` | `EvidenceSpan` by `id` + `userId`, resolving parent `Message` for body slice | Writer ownership branch for `evidence_span` | Neutral “Evidence span” / provenance title | Exact `Message.content` slice `[charStart, charEnd)` only when message is owned, bounds valid, and disclosure=`available` | Prefer parent `Message.createdAt`; else `EvidenceSpan.createdAt` | UEL `createdAt`, else `null` | Missing span/message/cross-user; invalid bounds/hash mismatch → unavailable | Shared rule 4; never invent span text from UEL fields |
| `reference_item` | `ReferenceItem` by `id` + `userId` | Writer ownership branch for `reference_item` | Truncated `ReferenceItem.statement` when `status=active`; else neutral type/provenance title | `ReferenceItem.statement` only when `status=active` and disclosure=`available` | `ReferenceItem.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user; `candidate`, `superseded`, `inactive`, or `dismissed` → redacted | Shared rule 4; public projector stays redacted (ownership ≠ public disclosure) |
| `surfaced_action` | `SurfacedAction` by `id` + `userId` | Writer ownership branch for `surfaced_action` | Neutral type/provenance title, optionally including bucket/status labels | `SurfacedAction.note` only when non-empty and disclosure=`available` | `SurfacedAction.surfacedAt` | UEL `createdAt`, else `null` | Missing/cross-user; empty note without other safe body → unavailable text | Shared rule 4 |
| `journal_entry` | `JournalEntry` by `id` + `userId` | Writer ownership branch for `journal_entry` | `JournalEntry.title` when present; else “Journal entry” / provenance title | `JournalEntry.body` (and title when present) only when disclosure=`available` | Prefer `JournalEntry.authoredAt`; else `createdAt` | UEL `createdAt`, else `null` | Missing/cross-user → unavailable | Shared rule 4; public projector stays redacted |
| `quick_check_in` | `QuickCheckIn` by `id` + `userId` | Writer ownership branch for `quick_check_in` | State-tag label when present; else “Quick check-in” / provenance title | `QuickCheckIn.note` only when non-empty and disclosure=`available` | `QuickCheckIn.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user; empty note without state tag → unavailable text | Shared rule 4; public projector stays redacted |
| `session` | `Session` by `id` + `userId` | Writer ownership branch for `session` | `Session.label` when present; else surface-type / “Conversation session” provenance title | No message-body projection from session alone; omit `sourceText`/`snippet` unless a later accepted adapter authorises an explicit safe field | Prefer `Session.startedAt`; else `createdAt` | UEL `createdAt`, else `null` | Missing/cross-user → unavailable | Shared rule 4; do not unredact child messages through the session adapter |
| `message` | `Message` by `id` + `userId` | Writer ownership branch for `message`; role integrity from `assertEvidenceLinkIntegrity` | Neutral “Conversation message” / provenance title (do not use raw content as title) | `Message.content` only when owned, role rules pass, and disclosure=`available` | `Message.createdAt` | UEL `createdAt`, else `null` | Missing/cross-user; unsupported message role; assistant without `role=context`; user without `supports`/`context` → unavailable/redacted | Shared rule 4; public projector stays redacted |
| `import_record` | `ImportUploadSession` or `ImportUploadChunk` via session `userId` | Writer ownership branch for `import_record` | Filename / neutral “Imported record” provenance title only | No import payload body in Slice A; omit `sourceText`/`snippet` | Prefer session/chunk `createdAt` | UEL `createdAt`, else `null` | Missing/cross-user → unavailable; never expose raw upload bytes | Shared rule 4 |

Reserved Prisma enum values `timeline_aggregation` and `user_correction` are not writer-eligible and are not accepted CCR source types. Any other or newly added enum value fails closed under shared rule 7.

---

## J. Implementation exit proofs

Runtime acceptance of SUBSYS-003 requires focused proof of all of the following. None of these proofs is claimed as already passed; SUBSYS-003 remains `NOT_ACCEPTED`.

1. Exact opaque server selection identity survives.
2. One explicit relationship yields one selected evidence object.
3. Evidence class, source type, role, title, disclosure, provenance, and available recorded date survive.
4. Redacted or unavailable source text remains absent.
5. Supporting, conflicting, context, and related pathways remain empty without explicit relationships.
6. No positional selected-object identity is generated.
7. No evidence-pool fan-out occurs.
8. Back returns to the originating canonical ModelUpdate.
9. Hard refresh/reopen preserves authoritative evidence selection identity.
10. Noncanonical behaviour remains unchanged.
11. Live-shape regression passes against realistic persisted row shapes before status promotion.
12. Existing public continuity projection behaviour remains unchanged. Focused regression proof must demonstrate that SUBSYS-003 does not broaden public disclosure, expose additional source fields, change public eligibility, or weaken redaction.
