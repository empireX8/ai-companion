# 01 — Three-layer architecture map

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Authority:** actual mounted production runtime = `orvek-v0-canonical` via `OrvekWorkbenchShell` (App Router `page.tsx` children are voided).

---

## Layer diagram

```
LAYER 1 — UNDERSTANDING
  archive processors · extraction rules · candidate builders
  pattern detectors · contradiction detection · profile derivation
  dark-engine candidate bridges · explore grounding · evidence selection

LAYER 2 — MODEL / STORAGE
  Session/Message · EvidenceSpan · DerivationRun/Artifact
  ReferenceItem · ContradictionNode · PatternClaim · ProfileArtifact
  UserMapConclusion · Investigation · FieldworkAssignment · ModelUpdate
  UnderstandingEvidenceLink · SurfacedAction · SurfacedEvidencePointer
  CanonicalTodayComposition · CanonicalModelMovementReport
  (no Goal / Decision / Outcome / ActiveQuestion / Receipt / UserMap tables)

LAYER 3 — PRODUCT EXPERIENCE (mounted)
  AppShell → OrvekWorkbenchShell → CanonicalLiveRuntimeEntry
    → useOrvekHybridWorkbenchDataApi → buildCanonicalLiveRuntimeData
    → CanonicalWorkbench (Today / Map / Decisions / Timeline / Explore)
    + EvidencePanel (Inspector) + Overlays (Import / Report / Capture)
```

---

## Layer 1 — Understanding (what analyses)

| Family | Primary code | Writes into Layer 2 |
|--------|--------------|---------------------|
| Archive import | `lib/import-chatgpt.ts`, `import-upload-*` | Session, Message, DerivationRun, refs/contras, spans, ProfileArtifact |
| Reference extraction | `extractReferenceFromImportedMessage` | ReferenceItem `candidate` |
| Contradiction detection | `lib/contradiction-detection.ts`, `contradiction-materialization.ts` | ContradictionNode + ContradictionEvidence |
| Profile derivation (rules) | `lib/profile-derivation.ts` | ProfileArtifact + EvidenceSpan |
| Pattern families | `lib/pattern-detector-v1.ts`, `*-adapter.ts`, `pattern-batch-orchestrator.ts` | PatternClaim + PatternClaimEvidence |
| Dark-engine candidates | `lib/understanding-dark-engine/*` | UserMapConclusion / Investigation / Fieldwork / ModelUpdate (gated, often `internal_only`) |
| Live message after() | `app/api/message/route.ts` | Same stack for APP journal/explore sessions |
| Explore grounding | `lib/explore-grounding-orchestrator.ts` | Message grounding payload; ExploreMovementProposal |
| LLM pattern labeling | `lib/pattern-llm-labeling-function.ts` | Shadow only (`usedForProductDecision: false`) — not product |

---

## Layer 2 — Storage ontology (compressed)

| Human-facing idea | Actual storage |
|-------------------|----------------|
| Imported history | Session(`IMPORTED_ARCHIVE`) + Message + ImportUploadSession |
| Extracted span | EvidenceSpan |
| Accepted profile fact | ReferenceItem (`active`) |
| Pending import claim | ReferenceItem / ContradictionNode (`candidate`) |
| Pattern | PatternClaim (+ PatternType enum = “family”) |
| Conflict / tension | ContradictionNode |
| User-model conclusion | UserMapConclusion (no parent UserMap row) |
| Model movement event | ModelUpdate |
| “Decision” card | SurfacedAction projection (not Decision table) |
| “Goal” | ReferenceItem.type=goal **or** ProfileArtifact.GOAL **or** remapped UserMapConclusion areas |
| “Active question” | Investigation.organizingQuestion (no ActiveQuestion table) |
| “Receipt” | SurfacedEvidencePointer / densograph ids / relatedReceiptIds JSON — no Receipt table |
| Live densograph mask | CanonicalTodayComposition.payload |

Full inventory: `03-prisma-and-storage-object-inventory.md`.

---

## Layer 3 — Mounted surfaces

| Surface | Route sync | Mounted component | Primary live data path |
|---------|------------|-------------------|------------------------|
| Today | `/` | `orvek-v0-canonical/pages/today.tsx` | hybrid Today + optional composition |
| Map | `/your-map` | `…/pages/map.tsx` | UserMapConclusions + mind-context + profile facts |
| Decisions | `/actions` | `…/pages/decisions.tsx` | SurfacedActions |
| Timeline | `/timeline` | `…/pages/timeline.tsx` | timeline APIs + MU injection |
| Explore | `/explore` | `…/pages/explore.tsx` | chat + AQ + inv + fieldwork tabs |
| Experiment | Explore tab `fieldwork` | FieldworkBridge inside explore | watch-for / fieldwork API |
| Inspector | right rail | `orvek-v0-authority/evidence-panel.tsx` | inspector APIs by object type |
| Reports | overlay | `overlays.tsx` ReportOverlay | densograph report / CanonicalModelMovementReport |
| Model Movement | Inspector tab | evidence-panel movement tab | ModelUpdate detail |
| Profile sections | Map context rails | map page + `map-profile-facts.ts` | active ReferenceItem preference/constraint |
| Goals | Map “Model Goals” | remapped UserMapConclusions | DB or composition `m-goal-*` |
| Import review | overlay | ImportOverlay | always live `fetchImportReviewCandidates` (overrides seed) |

**Quarantined (exist, not mounted on root):** `components/orvek-v0/pages/*`, workbench page bodies under `(root)`, `/what-changed`, `/context`, `/import`, `/patterns`.

---

## Critical cross-layer breaks (preview)

1. **Composition densograph** (`full_reference_round_trip_seed`) replaces Map/Timeline/Decisions/Explore rails while genuine PatternClaims/UM/MU sit underneath → Layer 3 lies when seed present.
2. **ProfileArtifact** (203 candidates) written by Layer 1, unread by Orvek Map Layer 3.
3. **ReferenceItem accept** proven once (chicken-burger) → Map profile facts; **no ModelUpdate** on ReferenceItem accept.
4. **ContradictionNode** pending 25 — write path live; Map conflict rail needs accept → `open` + MU.
5. **Goals** fragmented across three storage shapes; Map “goals” ≠ ReferenceItem goals.
6. **Orvek Capture overlay** is mock — Layer 3 affordance without Layer 1/2 write.

---

## Runtime proof rule

A pathway is only `FULLY_CONNECTED` when:

stored object → authenticated API → provider/hook → adapter → **actual mounted canonical component renders it** (and Inspector can resolve selection when claimed).
