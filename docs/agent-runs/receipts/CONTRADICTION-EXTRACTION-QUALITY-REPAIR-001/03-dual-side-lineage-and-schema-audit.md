# 03 — Dual-side lineage and schema audit

**Phase:** A — read-only schema and presentation trace
**Clarification:** Exact Side A span-level provenance required
**Verdict:** **B. EXISTING SCHEMA PARTIALLY SUFFICIENT — BOUNDED MIGRATION REQUIRED**

---

## Verdict rationale

The schema can store **both proposition texts** and has **adjacent tables** that could hold dual-side provenance, but the **automated pipeline does not populate them**, and **symmetric session/message/span lineage for both sides is not first-class** without bounded schema or wiring work.

**Session/message lineage alone is insufficient** when a message contains multiple propositions. Side A and Side B evidence must both resolve to **exact supporting source material** (span ID and/or stable offsets).

Repair can proceed with a bounded migration + pipeline wiring plan **only after** CEQR-001–004 establish the candidate and span-resolution contract (see dependency gate in `07-bounded-repair-slice-plan.md`). Verdict **C** is not warranted.

---

## Storage capacity audit

### ContradictionNode (`prisma/schema.prisma` L157–193)

| Capability | Side A | Side B |
|------------|--------|--------|
| Proposition text | `sideA` | `sideB` |
| Node-level session FK | **No dedicated field** | `sourceSessionId` |
| Node-level message FK | **No dedicated field** | `sourceMessageId` |
| Exact span | **No** | Joined at read via Side B `messageId` → `EvidenceSpan` (not guaranteed exact proposition) |

Default `status` is `open` (L165) — materialization overrides to `candidate` on import/live paths.

---

### ContradictionEvidence (L210–221)

| Field | Current use |
|-------|-------------|
| `sessionId`, `messageId`, `quote` | Auto-materialization creates **one row for Side B** |
| `source` | Default `"user_input"` |
| Side discriminator | **Absent** |
| Span FK | **Absent** — span joined by messageId at read, not proposition-exact |

---

### ReferenceItem (L133–155)

| Field | Relevance |
|-------|-----------|
| `statement` | Source of Side A text in detection |
| `sourceSessionId`, `sourceMessageId` | Side A message-level provenance on ReferenceItem |
| Exact span for statement | **Not first-class on ReferenceItem** — may require EvidenceSpan join or quote validation |
| `contradictionLinks` | Join table to CN — **not auto-populated** |

---

### ContradictionReferenceLink (L195–208)

| Field | Relevance |
|-------|-----------|
| `contradictionId`, `referenceId` | Designed to link CN ↔ Side A ReferenceItem |
| Auto-population | **None** in detection/materialization |

---

### UnderstandingEvidenceLink

On import accept today: Side B message/spans/session/import batch only. **Side A ReferenceItem / Side A span not linked.**

---

## Exact Side A span-level provenance (controlling requirement)

### Why session/message is not enough

A single message can contain multiple propositions (goal, hedge, obstacle, unrelated aside). Pointing at the message does not prove which span supports Side A. Import review and Inspector **must not imply** symmetric lineage until both sides resolve to exact supporting material.

### Acceptable migration designs

**Design A — Direct span FK on ContradictionNode**

- `sideASourceSessionId`, `sideASourceMessageId`, **`sideASourceSpanId`**
- Symmetric Side B: keep or clarify `sourceSessionId` / `sourceMessageId` and add **`sideBSourceSpanId`** (or evidence row with span FK)
- Persistence rejects create if `sideASourceSpanId` is null when Side A is reference-derived

**Design B — Guaranteed machine-readable chain**

1. `sideAReferenceItemId` on CN **and** auto `ContradictionReferenceLink`
2. Evidence record (ContradictionEvidence or UEL) that resolves to the **exact** `EvidenceSpan` (or stable start/end offsets) for Side A statement
3. Deterministic validator: AI-selected Side A text must match original source substring/offsets; **no orphan reference**, **no fabricated or inferred span**

Either Design A or Design B is acceptable. Hybrid is acceptable if the chain is unambiguous and tested.

### Non-negotiable provenance rules

| Rule | Requirement |
|------|-------------|
| Exact supporting material | Side A and Side B both resolve to inspectable span ID and/or stable offsets |
| No orphan Side A reference | Every persisted Side A must have a closed provenance chain |
| No fabricated evidence | Spans must exist in DB or be created only from verified offsets of original message text |
| No inferred span | Cannot invent a span that was not mechanically validated |
| AI text validation | Model-selected proposition text must be validated against original source |
| Stability | Evidence offsets / span IDs remain stable and inspectable |
| Presentation honesty | Import review and Inspector must not claim dual-side lineage until true |
| Migration authorisation | Migration **not authorised** until CEQR-005 names and tests the exact span-resolution path |

---

## What is absent today

| Absent capability | Impact |
|-------------------|--------|
| `sideASourceSessionId` / `sideASourceMessageId` / span resolution | Cannot query Side A lineage from CN |
| Exact Side A span FK or guaranteed chain | Multi-proposition messages ambiguous |
| Evidence side role (`side_a` / `side_b`) | Ambiguous dual evidence |
| Auto `ContradictionReferenceLink` | Side A ref unbound |
| Accept-path UEL for Side A span | Inspector/Map Side B–only |
| Honest UI for incomplete lineage | Overstatement risk |

---

## Bounded migration options (not executed in Phase A)

**Recommended direction:** Design A or Design B above, plus auto link population and accept-path Side A UEL.

**Not sufficient:** Session/message FKs alone without span resolution.

**CEQR-005 dependency:** Migration must support a **proven** candidate contract from CEQR-001–004 (kernel I/O, model-assisted semantics, zero-or-one selection, marker quarantine, qualifier preservation, deterministic span validation, contradiction adjudicator boundary, Objectivity Referee interface). Migration must not define that contract prematurely.

---

## Presentation gate

Until span-level dual provenance is true for a candidate:

- Import review and Inspector may show Side A/Side B **text**
- They must **not** imply that both sides have verified symmetric message/span lineage
- Legacy pre-repair 25 must be labeled as incomplete / Side-B-anchored lineage

---

## Schema verdict

**B. EXISTING SCHEMA PARTIALLY SUFFICIENT — BOUNDED MIGRATION REQUIRED**

Additive FKs and/or a guaranteed evidence chain are required for exact Side A span recoverability. Verdict **C** is not warranted — no fundamental redesign of Orvek object model is required for this first kernel proof case.
