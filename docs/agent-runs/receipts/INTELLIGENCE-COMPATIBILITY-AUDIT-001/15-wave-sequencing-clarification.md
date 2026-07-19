# 15 — Wave sequencing clarification (Wave 1 vs Wave 2.1)

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001 (clarification gate)
**Branch:** `desktop-intelligence-compatibility-audit-001` @ `58e4d01`
**Mode:** read-only — no product code, no Kay DB mutation, no accept/reject, no commit

---

## Verdict (exact)

**Option C selected, returned as Wave 1.1 next.**

| Hypothesis | Result |
|------------|--------|
| A. Wave 1 already completed by prior landed work | **FALSE** — CN→Map conflict projection is missing; residual Wave 1 items (goal authority, ProfileArtifact fate) also incomplete |
| B. Wave 1 incomplete but intentionally inside Wave 2.1 | **FALSE** — Wave 2.1 was framed as a human accept proof, not a read-path implementation campaign |
| C. Wave 2.1 recommended prematurely; a Wave 1.1 prerequisite is required | **TRUE** |

**Earlier recommendation of WAVE 2.1 was premature** because its success claim (“visible conflict section on Map”) depends on a **missing read-path translation**: open `ContradictionNode` → mounted canonical Map **Active conflicts** rail.

Accept write path for ContradictionNode **is** already implemented and unit-proven. That is **not** the same as Wave 1 complete, and **not** sufficient for Wave 2.1 as named.

---

## 1. “Translation contracts” defined precisely (Wave 1 inventory)

A **translation contract** here means: an old/new or storage→Orvek path with an explicit, testable mapping across all layers below.

### W1-A — ReferenceItem accept materialisation (evidence / ModelUpdate policy)

| Layer | Contract |
|-------|----------|
| Source model | `ReferenceItem` |
| Accepted state | `status=active` (same row) |
| Evidence / lineage | `sourceSessionId` / `sourceMessageId` FKs only; **no** UEL target (schema: `UnderstandingLinkTargetType` has no `reference_item`) |
| Provider/API | `POST /api/import-review/candidates/[key]/decide` → `decideImportCandidate` |
| Adapter | `map-profile-facts.ts` (preference/constraint only) |
| Canonical component | `orvek-v0-canonical/pages/map.tsx` |
| Visible surface | Map profile facts (Preferences / Constraints) |
| Inspector | `context_profile` via profile facts / mind-context — not a dedicated RI inspector type |
| Confidence | `ReferenceConfidence` on row; surfaced unevenly |
| ModelUpdate | **None** — gap documented (`MODEL_UPDATE_TARGET_UNSUPPORTED`) |
| Correction | N/A on RI accept path |

### W1-B — ContradictionNode accept materialisation (write / lineage / MU)

| Layer | Contract |
|-------|----------|
| Source model | `ContradictionNode` |
| Accepted state | `status=open` |
| Evidence / lineage | UELs to message, evidence_span(s), session, import_record when available; plus existing `ContradictionEvidence` |
| Provider/API | same decide API → `materialiseAcceptedContradiction` |
| Adapter | **(intended)** Map conflicts + Inspector contradiction |
| Canonical component | **(intended)** Map Active conflicts + `evidence-panel` |
| Visible surface | **(claimed by Wave 2.1)** Map Active conflicts |
| Inspector | `/api/inspector/contradictions/[id]` for public statuses including `open` |
| Confidence | node `confidence` |
| ModelUpdate | create `link_detected` / `user_visible` when none exists for that node |
| Correction | not on accept path |

### W1-C — ContradictionNode → Map Active conflicts **read projection** (critical)

| Layer | Contract |
|-------|----------|
| Source model | `ContradictionNode` with `status=open` (and other public statuses as product decides) |
| Materialised state | already `open` |
| Evidence | node evidence + UELs |
| Provider/API | Map production fetch / map-api must include CN objects |
| Adapter | `lib/orvek-adapters/map.ts` ontology rail `"conflicts"` |
| Canonical component | `components/orvek-v0-canonical/pages/map.tsx` |
| Visible surface | Map category **Active conflicts** |
| Inspector | selection → `contradiction_node` → `fetchInspectorContradiction` |
| Confidence / uncertainty | from node fields |
| ModelUpdate | separate (Timeline / movement); not required to *list* the conflict |
| Correction | out of scope for projection |

### W1-D — Goal read authority (single surface contract)

| Layer | Contract |
|-------|----------|
| Source models | Competing: `ReferenceItem.type=goal`, `ProfileArtifact.GOAL`, UM area remap |
| Expected | Exactly one authority for Map “Model Goals” / Decisions linkage |
| Surfaces | Map goals rail; Decisions `linkedGoalRefId` projection |

### W1-E — ProfileArtifact fate (legacy store)

| Layer | Contract |
|-------|----------|
| Source model | `ProfileArtifact` (203 candidates on Kay) |
| Expected | Explicit: archive / translate / leave orphan — Orvek Map currently unread |

### W1-F — Composition vs live Map merge (mask contract)

| Layer | Contract |
|-------|----------|
| Source | `CanonicalTodayComposition` with workbench `mapCategories` |
| Behaviour | `applyCompositionWorkbenchRails` **blocks** `shouldMergeMapProductionApi` |
| Expected for CN proofs | Live open CN must be visible on Map **despite** seed, OR seed must not own the conflicts rail for the proof window |

---

## 2. Status of each Wave 1 contract

| ID | Status | Evidence |
|----|--------|----------|
| **W1-A** RI accept write | **IMPLEMENTED_NOT_HUMAN_PROVEN** for policy completeness; accept→active **COMPLETE_AND_PROVEN** on chicken-burger | `lib/import-candidate-review-actions.ts` `materialiseAcceptedReference`; gaps intentional; SINGLE-REAL-IMPORT proof |
| **W1-A** RI→UEL/MU | **MISSING** as schema capability; **COMPLETE_AND_PROVEN** as documented gap (not a silent bug) | Same file gaps `MODEL_UPDATE_TARGET_UNSUPPORTED`, `UEL_TARGET_UNSUPPORTED`; `UnderstandingLinkTargetType` enum in `prisma/schema.prisma` |
| **W1-B** CN accept write + UEL + MU | **IMPLEMENTED_NOT_HUMAN_PROVEN** | `materialiseAcceptedContradiction`; tests in `lib/__tests__/import-candidate-review.test.ts` (“accepts contradiction… idempotent”); DB-BACKED receipts `03`/`04`/`06` |
| **W1-C** CN → Map Active conflicts | **MISSING** | Map ontology: `resolveConclusionOntology` maps **UserMapConclusion `status===disputed`** → `"conflicts"` in `lib/orvek-adapters/map.ts` — **no ContradictionNode ingestion** in `lib/orvek-v0/production/map-api.ts` / hybrid Map fetch |
| **W1-D** Goal authority | **MISSING** | Three homes; Map goals = UM area remap only (`isModelGoalConclusion`) |
| **W1-E** ProfileArtifact fate | **MISSING** | 203 candidates; Map unread |
| **W1-F** Composition mask vs live Map | **PARTIAL** | Documented in audit `10`; code `hybrid-workbench-api.ts` `applyCompositionWorkbenchRails` / `compositionWorkbench` gate — Import overridden live; Map not |

**Which are required for a truthful Wave 2.1 “Map conflict” proof?**

| Contract | Required for Wave 2.1 as previously named? |
|----------|--------------------------------------------|
| W1-A RI MU/UEL | **NOT_REQUIRED_FOR_WAVE_2_1** |
| W1-B CN accept write | Required (already implemented) |
| **W1-C CN→Map projection** | **Required — currently MISSING** |
| W1-D Goals | **NOT_REQUIRED_FOR_WAVE_2_1** |
| W1-E ProfileArtifact | **NOT_REQUIRED_FOR_WAVE_2_1** |
| W1-F Composition / Map merge | **Required** (Kay has full_reference seed) — else Map proof fails even after W1-C |

---

## 3. ContradictionNode pathway trace (code truth)

```
Imported ContradictionNode (status=candidate, sourceSession IMPORTED_ARCHIVE)
  → GET /api/import-review/candidates  (live; overrides composition)
  → ImportOverlay (mounted) — HUMAN VISIBLE as pending
  → POST /api/import-review/candidates/[key]/decide { accept }
  → decideImportCandidate (db.$transaction)
       → status candidate → open
       → UELs (message / spans / session / import_record) idempotent unique
       → ModelUpdate link_detected user_visible if none for affectedObjectId
  → Provider Map path TODAY:
       map-api builds rails from UserMapConclusions (+ mind-context, etc.)
       Active conflicts ← disputed UserMapConclusions ONLY
       open ContradictionNode NOT projected
  → Mounted canonical map.tsx
       Active conflicts shows composition m-conflict-* while seed owns rails
       OR empty/disputed-UM-only when live Map merges — still no CN
  → Inspector:
       API exists: GET /api/inspector/contradictions/[id] for open (+ other public)
       evidence-panel handles affectedObjectType === "contradiction_node"
       BUT Map selection does not emit contradiction_node from CN list (no list)
       Path via ModelUpdate affected object may resolve if MU is selectable on Timeline
  → Timeline / Movement:
       MU row schema-supported (affectedObjectType=contradiction_node)
       Timeline live merge also blocked by composition workbench
       Interim injectLiveMovementIdsIntoTimelineGroups may supplement Today-lane only
```

**Provider delivery ≠ Map visibility.** Open CN after accept is stored and Inspector-fetchable by id; it is **not** consumed by the Map Active conflicts rail.

---

## 4. Missing dependencies for previous Wave 2.1 claim

| Question | Answer |
|----------|--------|
| Acceptance transactionally implemented? | **Yes** — `decideImportCandidate` uses `db.$transaction` |
| Idempotent? | **Yes** — re-accept when `open` returns `idempotent: true`; MU not duplicated (`findFirst` then create) |
| Duplicate prevention? | **Yes** — UEL unique constraint + duplicate error handling; MU by affected object |
| Rollback proven? | **PARTIAL** — transaction rolls back on throw; no separate compensating rollback test for half-failed UEL beyond unit mocks |
| Evidence lineage preserved? | **Yes** on accept path (UELs + source FKs + ContradictionEvidence) — unit proven, not Kay-proven |
| ModelUpdate truthful + schema-supported? | **Yes** — `contradiction_node` in `UnderstandingLinkTargetType`; type `link_detected` with explicit gap note |
| Map conflict rendering genuine or synthetic? | **Synthetic under seed**; live rail is UM-disputed, **not CN** |
| Selected conflict inspectable? | Inspector API yes for `open`; **Map click path missing** without projection |
| Accept one risks unrelated records? | **Low** if scoped — updates only that CN (+ new UELs/MU); must not touch PatternClaims / UM / other candidates (code claims this) |
| Refresh persistence proven? | Unit yes; **Kay human no** for CN |
| Seed composition can mask result? | **Yes** — Map/Timeline rails replaced when composition has `mapCategories` |

---

## 5. Decision — exact next campaign

### OPTION C → named as Wave 1.1

**WAVE 1.1 — ContradictionNode → canonical Map Active-conflicts live projection**

**Why next (dependencies, not prior recommendation):**

1. Wave 2.1’s named success requires human-visible Map conflict from a real open CN.
2. That read path **does not exist**.
3. Implementing accept-on-Kay first would create an open CN + MU that remain **STORED_NOT_SURFACED** on Map Active conflicts, falsely “proving” Wave 2.1.
4. Broader Wave 1 items (goals, ProfileArtifact, RI MU schema) do **not** block CN Map proof — they stay deferred as **Wave 1.R**.

**Prerequisites:** none beyond this audit.
**Database mutation:** **forbidden** (code + tests only).
**Then:** WAVE 2.1 (single genuine CN accept proof) becomes valid.

---

## 6. Wave 2.1 safety contract (deferred until after Wave 1.1)

Do **not** start now. When Wave 1.1 PASSes:

1. Read-only candidate shortlist (no mutation)
2. Selection criteria: import-linked `candidate`; clear sideA/sideB; non-sensitive; not coding noise; has sourceMessageId
3. Lock exact candidate id in a receipt before any accept
4. Duplicate / existing-object check: no MU for that id; status still candidate; pending counts baseline
5. Before-state receipt (inventory gate)
6. **One** deliberate human Accept only
7. Expected DB: that CN → `open`; UELs created; one new MU `link_detected`; pending 53→52; CN pending 25→24; RI pending 28 unchanged; patterns 7; chicken RI unchanged; UM unchanged
8. Must not change: other candidates’ status; PatternClaims; chicken-burger; existing MU id `cmq6h8ewn…`
9. After-state receipt
10. Canonical runtime: Map Active conflicts shows **that** CN id (not `m-conflict-*`); Inspector opens `contradiction_node`; MU visible without requiring full mock removal
11. No mock removal campaign; no second candidate; no unrelated repair; no production-readiness claim

---

## 7. Wave 1.1 bounded implementation scope (next)

**Precise missing translation:** open `ContradictionNode` → Orvek Map object on rail `"conflicts"` → selection → Inspector `contradiction_node`, including a **composition-safe** merge rule so seed densograph cannot wholly hide live conflicts during proof (e.g. live conflicts overlay or conflicts-rail exception — exact design in implementer slice).

| | |
|--|--|
| Models | `ContradictionNode` (+ existing evidence/UEL read); Map densograph objects |
| Surfaces | Canonical Map Active conflicts; Inspector; optional Timeline MU link |
| DB mutation | **Forbidden** |
| Tests | Adapter unit tests: open CN appears in conflicts; candidate excluded; composition merge exception covered; inspector selection type |
| Human verification | Dev/fixture or staging without Kay accept; Kay human proof reserved for Wave 2.1 |
| Out of scope | Accept/reject; goal ontology; ProfileArtifact; RI MU schema; mock deletion; uploader; bulk quality; Wave 2.1 |

**Wave 1.R (deferred, non-blocking):** goal authority decision; ProfileArtifact fate; optional RI MU/UEL schema expansion.

---

## Consistency amendments applied

| Artifact | Change |
|----------|--------|
| `13-repair-wave-sequence.md` | Insert Wave 1.1; demote Wave 2.1; defer Wave 1.R |
| `14-controlling-result-for-kay.md` | Next campaign = Wave 1.1 |
| `repair-wave-sequence.json` | Same |
| `intelligence-compatibility-matrix.json` | Conflict row: primary break = missing Map read path; repair = Wave 1.1 then 2.1 |

**Sequencing contradiction resolved:** Wave order, JSON, recommendation, dependency analysis, and matrix now agree: **Wave 1.1 next; Wave 2.1 after.**
