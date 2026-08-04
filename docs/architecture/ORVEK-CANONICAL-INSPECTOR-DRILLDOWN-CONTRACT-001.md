# ORVEK CANONICAL INSPECTOR DRILLDOWN CONTRACT 001

**Status:** design contract for review
**Date:** 2026-07-31
**Amended:** 2026-08-04 — SUBSYS-003 control-plane architecture slice
**Scope:** canonical Inspector drill-down semantics for ModelUpdate evidence receipts and related canonical concepts
**Does not do:** change runtime code, schema, migrations, routes, shell layout, navigation policy, Map, Timeline, canonical publication, or writes
**Controlling frame:** Orvek is an evidence-backed private intelligence system. Presentation must not become a competing truth store.
**Slice A architecture control:** `docs/architecture/ORVEK-CANONICAL-EVIDENCE-REFERENCE-TO-AUTHORITY-MATRIX-001.md` is a controlling source for Slice A implementation planning and custody gates.

---

## 1. Purpose

The canonical `ModelUpdate` Inspector reader can now show a verified movement projection in the permanent Inspector shell. The next problem is drill-down selection from that projection.

Two interactions need separate contracts:

1. Clicking a canonical `ModelUpdate` receipt should open a meaningful evidence object, not a generic empty Context object.
2. Clicking the related canonical concept should open the current canonical truth for the stable concept identity, not a stale legacy seed label.

These are related UX paths, but they must be implemented as separate PRs:

- **Slice A - canonical evidence drill-down:** first PR.
- **Slice B - canonical concept related-object drill-down:** second PR, after Slice A.

This separation keeps evidence object projection independent from canonical concept current-truth projection.

---

## 2. Shared Architectural Baseline

Both slices must reuse the existing architecture:

- `/api/what-changed/[id]` or its shared server read service remains the authenticated server read path for canonical `ModelUpdate` Inspector projections.
- `components/orvek-v0-authority/evidence-panel.tsx` remains the permanent Inspector shell and geometry owner.
- `composeProductionModelUpdateCanonicalViewModel()` remains the production ModelUpdate adapter into the permanent `ObjectDetail` / `MovementView` object pathway.
- Existing workbench back-navigation and sticky Inspector overlay behavior must be reused.
- The browser may render server-verified, browser-safe projections. It must not reconstruct canonical lineage from raw authority fields.

Neither slice may introduce:

- a new Inspector surface;
- a duplicate shell or standalone Inspector layout;
- schema or migration changes;
- canonical publication, write, backfill, or materialization changes;
- Map or Timeline redesign;
- navigation-policy repair;
- synthetic receipts, objects, summaries, signals, background, or relationships;
- behavior changes for genuinely noncanonical objects.

---

## 3. Shared Projection Boundary

The server is responsible for verifying canonical ownership, lineage, and source eligibility before returning any drill-down projection.

Two projection surfaces must remain separate:

1. **Public continuity projection** — the general public-safe continuity labels and redaction behaviour owned by modules such as `lib/canonical-product-public-evidence.ts`. Continuity labels such as “Linked evidence” are not source titles and are not evidence summaries.
2. **Inspector-safe evidence projection** — an authenticated Slice A / Inspector-specific browser-safe evidence projection or adapter. SUBSYS-003 requires this surface. It may expose only fields explicitly authorised by Slice A.

General public redaction and continuity behaviour must **not** be weakened for Inspector purposes. Do not treat the public continuity projector as sufficient Inspector evidence authority.

The browser may receive:

- opaque selection ids that are already verified for explicit navigation;
- display type labels;
- evidence class labels;
- source type labels;
- link roles;
- readable titles;
- Inspector-safe summaries or snippets when disclosure permits;
- recorded dates;
- provenance labels;
- explicit empty-state markers.

The browser must not receive:

- raw authority ids for lineage reconstruction;
- raw proposal records;
- raw `internalNotes`;
- ownership fields;
- registration hashes;
- raw private source text;
- redacted source text;
- unprojected evidence payloads;
- raw canonical revision or concept rows;
- inferred related-object lists.

Receiving a verified opaque selection id for display or explicit navigation is allowed. Using that id to reconstruct or re-verify canonical lineage in the browser is not allowed.

---

## 4. Slice A - Canonical Evidence Drill-Down

### 4.1 Problem

Canonical `ModelUpdate` receipts currently use receipt-like satellite objects inside the permanent Inspector. A clicked receipt must open an evidence object with meaningful evidence fields. It must not open a generic empty Context object or an invented receipt with no source meaning.

### 4.2 Scope

Slice A implements only canonical evidence drill-down from a canonical `ModelUpdate` Inspector projection.

In scope:

- direct movement evidence rows;
- resulting-revision evidence rows;
- browser-safe evidence projection;
- permanent Inspector object adaptation for selected evidence;
- back navigation to the originating canonical `ModelUpdate`.

Out of scope:

- canonical concept related-object drill-down;
- Map or Timeline title consistency;
- navigation-policy clearing rules;
- evidence write or publication changes;
- source text unredaction;
- legacy noncanonical ModelUpdate presenter behavior.

### 4.3 Evidence Object Meaning

A canonical drill-down evidence object is a browser-safe projection over a genuine server-verified evidence source or evidence link.

**Receipt identity is `PROJECTION_ONLY`.** The selected Receipt is a presentation projection for the permanent Inspector. It has no independent lifecycle. Deterministic identity is derived from verified ModelUpdate identity, evidence class, and relationship identity. A new Receipt table is forbidden within SUBSYS-003 because it would duplicate source and edge authority.

It is not:

- a canonical concept;
- a canonical revision;
- a ModelUpdate;
- a context object by default;
- a generated report fact;
- a thin-packet warning;
- a speculation;
- a relationship invented from shared words;
- a persisted Receipt authority row.

### 4.4 Evidence Classes

The server projection must distinguish at least these evidence classes:

| Evidence class | Meaning | Inspector consequence |
|---|---|---|
| `direct_movement_evidence` | Evidence linked directly to the canonical `ModelUpdate` movement receipt | Label as movement evidence |
| `resulting_revision_evidence` | Evidence supporting or contradicting the resulting canonical revision, when genuine and current for that resulting revision | Label as resulting revision evidence |

The labels must make the target clear so resulting-revision evidence is not misrepresented as direct movement evidence.

### 4.5 Browser-Safe Fields

Each canonical evidence drill-down projection may include only:

- `selectionId`: opaque, server-verified selection id for the workbench overlay;
- `evidenceClass`: `direct_movement_evidence` or `resulting_revision_evidence`;
- `evidenceClassLabel`: user-facing class label;
- `sourceType`: safe source type enum or display-safe source category;
- `sourceTypeLabel`: user-facing source type label;
- `role`: explicit link role, such as `supports`, `contradicts`, or `context`;
- `roleLabel`: user-facing role label;
- `title`: readable evidence title;
- `summary`: Inspector-safe summary, only when disclosure permits;
- `snippet`: Inspector-safe snippet, only when disclosure permits;
- `recordedAt`: source or link timestamp when known;
- `recordedLabel`: formatted date label when known;
- `provenanceLabel`: label such as `Movement evidence` or `Resulting revision evidence`;
- `sourceDisclosure`: safe disclosure state, such as `available`, `redacted`, or `unavailable`;
- `returnSelectionId`: opaque id for returning to the canonical `ModelUpdate`, if already part of the existing back-navigation pattern.

The projection must not include raw source text when disclosure is redacted or unavailable.

#### 4.5.1 Selection identity

The selected-object adapter must consume the exact server-issued `selectionId`.

Positional selection ids such as `mu-receipt-*`, `mu-context-*`, or any index-derived substitute are forbidden.

#### 4.5.2 Recorded-date authority order

When projecting `recordedAt` / `recordedLabel`:

1. Inspector-safe source recorded or authored time, when the source adapter can supply one;
2. otherwise the relationship `UnderstandingEvidenceLink.createdAt`;
3. otherwise `null`.

Do not invent dates. Do not drop a known relationship timestamp merely because an intermediate public continuity type omits it.

#### 4.5.3 Receipt field mapping

When adapting the server projection into the permanent Inspector `OrvekObject` Receipt shape:

- `snippet` → Receipt `sourceText`;
- source/origin label → Receipt `sourceOrigin`;
- `recordedLabel` → Receipt `date`.

Do not copy `title` into `sourceText`.

#### 4.5.4 Fields not required by Slice A

The following frozen/reference fields are not required for Slice A acceptance:

- `whyItMatters`;
- `whyResurfaced`;
- `evidenceCount`;
- `tags`.

Empty or absent values for these fields are correct for canonical evidence drill-down objects.

#### 4.5.5 Source-type Inspector adapter policy

Authority for which `UnderstandingLinkSourceType` values may target `canonical_concept_revision` is `SUPPORTED_EVIDENCE_LINK_PAIRS` in `lib/orvek-intelligence-object-authority.ts`, enforced by the writer and by `assertEvidenceLinkIntegrity` in `lib/canonical-model-projection.ts`. Ownership verification is `verifyUnderstandingEvidenceLinkSourceOwnership` in `lib/understanding-evidence-link-writer.ts`.

The same source-type rules apply when an identical source type is bound as `direct_movement_evidence` to a `model_update` target. This section must stay in parity with `ORVEK-CANONICAL-EVIDENCE-REFERENCE-TO-AUTHORITY-MATRIX-001` section I.

Shared fail-closed rules:

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

Accepted source types for `targetType = canonical_concept_revision`:

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

### 4.6 Title Rules

The evidence object title must be selected from genuine projected evidence fields:

1. Inspector-safe source title, when the source has one.
2. Inspector-safe evidence summary label.
3. Source type label plus recorded date, when no readable source title exists.
4. Provenance label plus source type label, when no date is available.

The title must not be:

- generated from deterministic report facts;
- generated from speculation;
- a confidence or receipt-count sentence;
- a thin-packet warning;
- `Context`;
- `Receipt`;
- blank;
- a public continuity label such as `Linked evidence`;
- the canonical concept current title unless the evidence source itself is explicitly that concept projection.

### 4.7 Summary And Snippet Rules

Summary and snippet may be shown only when the server projection marks the evidence disclosure as Inspector-safe.

When disclosure is redacted:

- Summary must be empty.
- Snippet must be empty.
- The evidence object may show a neutral disclosure label.
- The projection must not include redacted text.

When disclosure is unavailable:

- Summary must be empty.
- Snippet must be empty.
- The object should still display source type, role, recorded date if known, and provenance label.

The client must not invent a summary from source type, role, receipt count, confidence, or report prose.

### 4.8 Supporting, Conflicting, Background, And Relationships

For canonical evidence drill-down objects:

- `supporting` must remain empty unless explicit Inspector-safe evidence supports this evidence object itself.
- `conflicting` must remain empty unless explicit Inspector-safe evidence contradicts this evidence object itself.
- `contextIds` must remain empty unless the server projection includes explicit context links.
- `relatedIds` must remain empty unless the server projection includes explicit resolved related selections.
- `whatWouldChange` must remain empty.

Evidence being used as support for a `ModelUpdate` or revision does not mean the evidence object itself has supporting signals.

Evidence `role` describes the evidence relative to its target (`model_update` or `canonical_concept_revision`). It does **not** populate signals supporting or conflicting with the selected evidence object.

Role-based fan-out from one evidence pool into receipt, context, supporting, and conflicting pathways is forbidden. One explicit relationship yields at most one authorised selected evidence object pathway.

### 4.8.1 Movement binding

- A persisted `source → model_update` edge means `direct_movement_evidence`.
- A persisted `source → canonical_concept_revision` edge means `resulting_revision_evidence`.
- Neither classification may be inferred from the other.
- One source may carry both classifications only through two independently persisted and verified edges.
- Absence of direct movement edges is not itself a defect.
- The browser may not reconstruct either relationship.
- Back navigation remains on the existing workbench selection stack and must return to the originating canonical `ModelUpdate`.
- Genuinely noncanonical behaviour remains unchanged.

### 4.9 Empty States

The permanent Inspector shell must keep its existing geometry and show correct neutral states.

For a selected canonical evidence object:

- Summary: `No current summary is available.`
- Receipts: `No supporting receipt is available.`
- Supporting signal: `No supporting signal is available.`
- Conflicting signal: `No conflicting signal is available.`
- Relevant background: `No relevant background is available.`
- Related objects: `No related object is available.`
- What would change this: `No change condition is available.`

These empty states are correct when the server projection has no explicit relationship. They must not be filled with generated report facts, speculations, guardrails, source counts, or confidence prose.

### 4.10 Slice A Acceptance Tests

Slice A must include focused tests proving:

1. A canonical `ModelUpdate` direct movement receipt resolves to a meaningful evidence object with evidence class, source type, role, title, date, and provenance label.
2. A canonical resulting-revision receipt resolves to a meaningful evidence object labelled as resulting revision evidence, not movement evidence.
3. Redacted evidence does not expose raw source text, raw authority ids, internal notes, ownership fields, or unprojected payloads.
4. A selected canonical evidence object keeps empty supporting, conflicting, background, related-object, and What Would Change slots unless explicit projected relationships exist.
5. Clicking into evidence and using Back follows the existing permanent Inspector back-navigation pattern.
6. Noncanonical ModelUpdate receipt drill-down behavior is unchanged.
7. No synthetic receipt, object, summary, signal, background, or relationship is created when the server projection has no explicit relationship.
8. Existing public continuity projection behaviour remains unchanged. Focused regression proof must demonstrate that SUBSYS-003 does not broaden public disclosure, expose additional source fields, change public eligibility, or weaken redaction.

None of these acceptance proofs is claimed as already passed. SUBSYS-003 remains `NOT_ACCEPTED` until the runtime exit gate passes.

---

## 5. Slice B - Canonical Concept Related-Object Drill-Down

### 5.1 Problem

The canonical `ModelUpdate` Inspector may expose a related canonical concept. Clicking that related object must show the current canonical truth for the stable concept identity.

The stable concept identity must remain the same while revisions change. The displayed title and summary must come from the current revision.

The tea example must never show the stale title:

```text
I don't like tea anymore
```

with the current summary:

```text
I like tea again now
```

That mixed state is invalid because the title and summary come from different revision states.

### 5.2 Scope

Slice B implements only canonical concept related-object drill-down from the canonical `ModelUpdate` Inspector.

In scope:

- server-verified related canonical concept selection;
- current canonical concept title and summary from the current revision;
- permanent Inspector object adaptation for selected canonical concept;
- explicit historical source labelling for legacy seed material when present;
- back navigation to the originating canonical `ModelUpdate`.

Out of scope:

- canonical evidence receipt drill-down;
- Map or Timeline redesign;
- page-navigation selection clearing repair;
- canonical publication, backfill, or registration writes;
- concept revision editing;
- schema changes;
- legacy noncanonical object behavior.

### 5.3 Concept Object Meaning

A canonical concept drill-down object represents the stable semantic concept identity and its current revision.

It is not:

- the historical legacy seed row;
- the ModelUpdate movement receipt;
- a single historical revision unless explicitly labelled as historical;
- a synthesized merge of old and new wording.

The stable identity remains the same as revisions change. The visible current truth changes only through the current revision pointer.

### 5.4 Server-Side Verification

The server must verify:

1. The canonical `ModelUpdate` selected in the Inspector has verified canonical lineage.
2. The related canonical concept id was included by the server projection as an explicit related object.
3. The concept belongs to the authenticated user.
4. The concept has a current revision.
5. The current revision belongs to that concept.
6. The current revision is readable through the canonical product projection.
7. Any legacy seed or registration source is labelled as historical source material, not current truth.

The browser must not fetch raw authority rows or reconstruct concept lineage. It may receive a safe projection for display and an opaque selection id for explicit navigation.

### 5.5 Browser-Safe Concept Fields

The concept drill-down projection may include:

- `selectionId`: opaque, server-verified selection id;
- `conceptLabel`: safe object type label;
- `title`: current revision title;
- `summary`: current revision summary;
- `currentRevisionVersion`: version number;
- `currentRevisionAcceptedAt`: accepted timestamp;
- `currentRevisionRecordedLabel`: formatted accepted date;
- `rationale`: current revision rationale, only when Inspector-safe;
- `evidenceCount`: public-safe count, if already part of the canonical product projection;
- `sourceProvenanceLabel`: explicit label for historical seed/source material when shown;
- `historicalSources`: safe labelled historical source projections, when genuine and explicit;
- explicit related/evidence/context selections only when verified and Inspector-safe.

The projection must not include:

- raw canonical concept rows;
- raw revision rows;
- raw registration hashes;
- raw proposal records;
- raw seed payloads;
- ownership fields;
- raw internal notes;
- stale legacy titles as current title;
- unprojected evidence text.

### 5.6 Current Title And Summary Rules

For canonical concept related-object drill-down:

1. `title` must come from the current canonical revision.
2. `summary` must come from the same current canonical revision.
3. If current revision title is unavailable, fail closed or use the established canonical product projection empty state. Do not fall back to a legacy seed title.
4. If current revision summary is unavailable, leave Summary empty. Do not fill it from a legacy seed.
5. Title and summary must never be assembled from different revisions.
6. The concept identity remains stable even when title and summary change.

### 5.7 Historical Source Rules

A legacy seed may appear only as historical source material.

Allowed label examples:

- `Historical source`
- `Original registration source`
- `Earlier source material`

Forbidden presentation:

- using the legacy seed title as the current concept title;
- using the legacy seed summary as the current concept summary;
- showing stale seed wording without a historical label;
- mixing a stale seed title with a current revision summary;
- treating a legacy `UserMapConclusion` as a second current authority path.

### 5.8 Empty States

For a selected canonical concept object:

- Summary may be populated from the current revision summary.
- Why it matters may be populated only from current revision rationale or another explicit current-revision projection field.
- Receipts may be populated only from genuine projected canonical evidence.
- Supporting signals may be populated only from explicit `supports` evidence projections.
- Conflicting signals may be populated only from explicit `contradicts` evidence projections.
- Relevant background may be populated only from explicit context/source-binding projections.
- Related objects may be populated only from explicit verified related selections.
- What would change this remains empty unless the canonical product projection explicitly provides Inspector-safe change conditions.

When explicit data does not exist, preserve the permanent neutral empty states:

- `No current summary is available.`
- `No supporting receipt is available.`
- `No supporting signal is available.`
- `No conflicting signal is available.`
- `No relevant background is available.`
- `No related object is available.`
- `No change condition is available.`

### 5.9 Slice B Acceptance Tests

Slice B must include focused tests proving:

1. A related canonical concept click opens the existing permanent Inspector shell, not a new surface.
2. The concept title and summary both come from the current revision.
3. The stable concept selection id remains stable while the displayed current revision title/summary change.
4. The tea example never renders `I don't like tea anymore` as current title when current summary is `I like tea again now`.
5. A legacy seed can appear only with an explicit historical-source label.
6. A missing current revision fails closed rather than falling back to legacy seed truth.
7. Empty supporting, conflicting, background, related-object, receipt, and What Would Change slots remain empty unless explicit projected relationships exist.
8. Noncanonical related-object behavior is unchanged.

---

## 6. Cross-Slice Rules

Both slices must obey these rules:

- Implement Slice A and Slice B as separate PRs.
- Implement Slice A first.
- Do not repair page-navigation selection clearing in either slice.
- Do not redesign What Changed, Map, Timeline, or the application shell.
- Do not create another Inspector surface.
- Do not add schema or migrations.
- Do not write or publish canonical state.
- Do not materialize missing objects from the Inspector read path.
- Do not synthesize receipts, objects, relationships, summaries, supporting signals, conflicting signals, background, or What Would Change text.
- Preserve legacy behavior for genuinely noncanonical objects.
- Fail closed when server verification cannot prove a canonical drill-down projection is safe.

---

## 7. Implementation Order

### First PR - Slice A

Goal: canonical evidence drill-down.

The first implementation PR should:

- extend the existing canonical `ModelUpdate` Inspector projection with browser-safe evidence drill-down projections;
- adapt the existing production ModelUpdate composer to create selectable evidence objects from those projections;
- preserve direct movement versus resulting-revision evidence labels;
- preserve permanent empty states for absent relationships;
- add the Slice A acceptance tests.

It must not include canonical concept related-object drill-down.

### Second PR - Slice B

Goal: canonical concept related-object drill-down.

The second implementation PR should:

- resolve related canonical concept selection through a server-verified browser-safe concept projection;
- display current revision title and summary together;
- label legacy seed material only as historical source material;
- preserve stable concept identity across revisions;
- add the Slice B acceptance tests.

It must not change canonical evidence drill-down beyond using the Slice A object path already landed.

---

## 8. Explicit Non-Goals

This contract does not authorize:

- schema changes;
- migrations;
- new canonical authority tables;
- a new Receipt table or Receipt persistence layer;
- weakening public continuity redaction to feed Inspector text;
- canonical publication changes;
- proposal review changes;
- Map redesign;
- Timeline redesign;
- What Changed layout changes;
- shell geometry changes;
- navigation-policy repair;
- browser-side canonical lineage reconstruction;
- text filters for specific problematic prose;
- synthetic insight generation;
- synthetic evidence generation;
- second authority paths through legacy `UserMapConclusion` rows.

---

## 9. Review Checklist

Before implementation begins, reviewers should confirm:

- Slice A and Slice B are tracked as separate PRs.
- Slice A is scheduled first.
- The evidence drill-down object cannot expose redacted source text.
- Direct movement evidence and resulting-revision evidence have distinct labels.
- Canonical concept current title and summary are both sourced from the same current revision.
- Legacy seeds are historical source material only.
- Permanent Inspector empty states remain valid data states.
- Legacy noncanonical behavior remains unchanged.
