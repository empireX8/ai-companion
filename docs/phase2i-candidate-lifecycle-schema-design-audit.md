# Phase 2I — Candidate Lifecycle/Schema Design Audit

**Status:** AUDIT COMPLETE (DOCS ONLY)  
**Date:** 2026-05-28  
**Scope:** Docs-only audit of current implemented truth vs. required candidate lifecycle. No code, schema, routes, or runtime behavior changes.

---

## 1. Purpose

This audit examines the gap between:
- The **conceptual candidate lifecycle** defined in Phase 2E (`docs/phase2e-candidate-storage-policy-contract.md`) and Phase 6 contract (`docs/step6-phase2-dark-engine-gates-contract.md`)
- The **currently implemented schema and code** in the repo

The audit identifies what would need to change to support a unified candidate lifecycle across all candidate families (`UserMapConclusion`, `Investigation`, `ModelUpdate`, `FieldworkAssignment`), and recommends a safe implementation slice.

---

## 2. Current Implemented Truth

### 2.1 UserMapConclusion

**Schema** (`prisma/schema.prisma` lines 64–671, 788–822):

```prisma
enum UserMapConclusionStatus {
  hypothesis
  tentative
  emerging
  supported
  disputed
  superseded
}
```

- Has `status`, `visibility`, `supersededById`/`supersedesId` (supersession links)
- Has `confidenceScore`, `confidenceLevel`, `evidenceCount`, `sourceDiversity`, `timeSpreadDays`
- Has `firstEvidenceAt`, `lastEvidenceAt`
- Has `version` field (currently always 1, no increment logic)
- Has `correctionCount`, `lastUserCorrectionAt`, `lastUserCorrectionLabel`
- Visibility: `internal_only`, `user_visible` (no `candidate` visibility)

**Current lifecycle mapping:**
- `hypothesis` — closest to `proposed`
- `tentative` — closest to `held_for_more_evidence`
- `emerging` — closest to `promoted` (but not a full promotion state)
- `supported` — higher promotion tier
- `disputed` — conflict state (no direct Phase 2E equivalent)
- `superseded` — matches Phase 2E `superseded`

**Gap:** No `rejected` or `expired` states. The current statuses mix candidate-level and accepted-belief semantics. `hypothesis` and `tentative` serve as de facto candidate states but are not explicitly separated from promoted states.

**Persistence code** (`lib/understanding-dark-engine/user-map-candidate-persistence.ts`):
- `persistInternalUserMapConclusionCandidate` writes `UserMapConclusion` with status `emerging` or `tentative` (via `mapDecisionToPersistedStatus`)
- Visibility is always `internal_only` for dark-engine writes
- Dedup check uses `(userId, area, title, summary)` — no lifecycle-aware dedup
- Supersession is not automatically managed during candidate creation

### 2.2 Investigation

**Schema** (`prisma/schema.prisma` lines 695–703, 824+):

```prisma
enum InvestigationStatus {
  open
  gathering_evidence
  testing
  resolving
  resolved
  reopened
  abandoned
}
```

- Has workflow `status` but **no `visibility` field**
- Has `resolvedIntoUserMapConclusionId` for resolution linking
- No candidate lifecycle field
- No `candidate` or `proposed` status — investigations are created directly

**Gap:** No way to represent a proposed investigation candidate that hasn't been accepted. No visibility control. Cannot be used for dark-engine candidate storage without schema changes.

### 2.3 ModelUpdate

**Schema** (`prisma/schema.prisma` lines 716–738):

```prisma
enum ModelUpdateVisibility {
  internal_only
  candidate
  user_visible
}
```

- Has `visibility` including `candidate`
- Has `updateType` (describes what changed)
- **No explicit candidate lifecycle status field** — `visibility=candidate` is the closest approximation
- No `status` field for lifecycle state

**Gap:** `visibility=candidate` is a boolean flag, not a lifecycle state. Cannot distinguish `proposed` from `held_for_more_evidence` from `rejected`. No `superseded` or `expired` semantics.

### 2.4 FieldworkAssignment

**Schema** (`prisma/schema.prisma` lines 740–746):

```prisma
enum FieldworkStatus {
  assigned
  active
  completed
  dismissed
  expired
}
```

- Has execution `status` but **no `visibility` field**
- No candidate lifecycle field
- `dismissed` and `expired` partially overlap with candidate rejection/expiry, but there's no `proposed` or `held` state

**Gap:** Cannot represent a fieldwork candidate that hasn't been assigned. No visibility control.

### 2.5 UnderstandingEvidenceLink

- Has `summary`, `snippet`, `quote`, `meta` fields
- Has `targetType`/`targetId` and `sourceType`/`sourceId`
- **No lifecycle or visibility controls per row**
- Raw `snippet`/`quote` are internal-only by policy but not enforced at schema level

### 2.6 PatternClaim (separate lifecycle, for reference)

```prisma
enum PatternClaimStatus {
  candidate
  active
  paused
  dismissed
}
```

- Has its own lifecycle: `candidate → active → paused/dismissed`
- Strength levels: `tentative → developing → established`
- This is a **separate lifecycle** from the candidate object lifecycle — PatternClaims are already a mature implementation with their own advancement engine (`lib/pattern-claim-lifecycle.ts`)

---

## 3. Lifecycle/Schema Gap Analysis

### 3.1 Required Lifecycle States (from Phase 2E)

| State | UserMapConclusion | Investigation | ModelUpdate | FieldworkAssignment |
|-------|-------------------|---------------|-------------|---------------------|
| `proposed` | ~hypothesis | ❌ missing | ❌ missing | ❌ missing |
| `held_for_more_evidence` | ~tentative | ❌ missing | ❌ missing | ❌ missing |
| `rejected` | ❌ missing | ❌ missing | ❌ missing | ~dismissed |
| `promoted` | ~emerging/supported | ~resolved | ~user_visible | ~completed |
| `superseded` | ✅ superseded | ❌ missing | ❌ missing | ❌ missing |
| `expired` | ❌ missing | ❌ missing | ❌ missing | ✅ expired |

### 3.2 Visibility Gap

| Object | Has visibility field? | Has `candidate` visibility? |
|--------|----------------------|----------------------------|
| UserMapConclusion | ✅ | ❌ (only `internal_only`/`user_visible`) |
| Investigation | ❌ | ❌ |
| ModelUpdate | ✅ | ✅ |
| FieldworkAssignment | ❌ | ❌ |

### 3.3 Supersession Gap

| Object | Has supersession links? |
|--------|------------------------|
| UserMapConclusion | ✅ (`supersededById`/`supersedesId`) |
| Investigation | ❌ (only `resolvedIntoUserMapConclusionId`) |
| ModelUpdate | ❌ |
| FieldworkAssignment | ❌ |

### 3.4 Evidence Linkage Gap

| Object | Has evidence links? | Evidence link lifecycle? |
|--------|-------------------|-------------------------|
| UserMapConclusion | ✅ (via UnderstandingEvidenceLink) | ❌ |
| Investigation | ✅ (via UnderstandingEvidenceLink) | ❌ |
| ModelUpdate | ✅ (via UnderstandingEvidenceLink) | ❌ |
| FieldworkAssignment | ❌ | ❌ |

---

## 4. Proposed Lifecycle State Machine

### 4.1 Unified Candidate Lifecycle

```
                    ┌─────────────┐
                    │  proposed   │
                    └──────┬──────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
        ┌────────────┐ ┌────────┐ ┌────────┐
        │ held_for_  │ │rejected│ │expired │
        │ more_evid. │ └────────┘ └────────┘
        └──────┬─────┘
               │
               ▼
        ┌────────────┐
        │ promoted   │
        └──────┬─────┘
               │
               ▼
        ┌────────────┐
        │ superseded │
        └────────────┘
```

**Transitions:**
- `proposed` → `held_for_more_evidence`: Evidence exists but insufficient confidence
- `proposed` → `rejected`: Gates fail definitively
- `proposed` → `expired`: Timeout without sufficient evidence
- `held_for_more_evidence` → `proposed`: New evidence arrives (re-evaluation)
- `held_for_more_evidence` → `rejected`: Gates fail after re-evaluation
- `held_for_more_evidence` → `expired`: Timeout
- `held_for_more_evidence` → `promoted`: Gates pass
- `rejected` → `proposed`: Only via new candidate cycle (fresh evidence)
- `promoted` → `superseded`: Replaced by newer candidate
- `expired` → `proposed`: Only via new candidate cycle

### 4.2 Family-Specific Mappings

**UserMapConclusion:**
- `hypothesis` → maps to `proposed`
- `tentative` → maps to `held_for_more_evidence`
- `emerging`/`supported` → maps to `promoted`
- `disputed` → conflict state (orthogonal to lifecycle)
- `superseded` → maps to `superseded`
- Missing: explicit `rejected`, `expired`

**Investigation:**
- No current candidate states
- Would need: `proposed` candidate state before `open`
- `resolved` → maps to `promoted` (for the investigation itself)
- Missing: full lifecycle

**ModelUpdate:**
- `visibility=candidate` → closest to `proposed`
- `visibility=user_visible` → closest to `promoted`
- Missing: explicit lifecycle status field

**FieldworkAssignment:**
- No current candidate states
- Would need: `proposed` candidate state before `assigned`
- `dismissed` → partial overlap with `rejected`
- `expired` → matches

---

## 5. Future Migration Shape

### 5.1 Option A: Shared Lifecycle Fields (Additive)

Add a shared `candidateLifecycleStatus` enum to all four target models:

```prisma
enum CandidateLifecycleStatus {
  proposed
  held_for_more_evidence
  rejected
  promoted
  superseded
  expired
}
```

Add to each model:
- `candidateLifecycleStatus CandidateLifecycleStatus?` (nullable — existing records without lifecycle)
- `candidateVisibility CandidateVisibility?` (optional visibility override)

**Pros:** Additive, no new tables, minimal migration risk, queryable across families.  
**Cons:** Each model still has its own status field that may conflict or overlap. Schema change touches 4 models.

### 5.2 Option B: Separate Candidate Table

```prisma
model Candidate {
  id        String   @id @default(cuid())
  userId    String
  family    CandidateFamily  // usermap_conclusion | investigation | model_update | fieldwork
  targetId  String?  // nullable — candidate may not have a target object yet
  status    CandidateLifecycleStatus
  visibility CandidateVisibility
  proposedSummary  String
  rejectionReason  String?
  proposedAt       DateTime
  lastEvaluatedAt  DateTime?
  expiresAt        DateTime?
  supersededById   String?
  // ... evidence links via UnderstandingEvidenceLink
}
```

**Pros:** Clean separation, no schema changes to existing models, single lifecycle authority, easy to query all candidates.  
**Cons:** New table, migration, dual-write complexity during transition, join overhead.

### 5.3 Option C: Hybrid

- Use `UserMapConclusion` as the primary candidate storage (closest fit today)
- Add `candidateLifecycleStatus` to `UserMapConclusion` only
- Keep other families deferred until Phase 2E policy contract is updated
- Use `UnderstandingEvidenceLink` for provenance regardless

**Pros:** Minimal schema change, leverages existing persistence path, lowest risk.  
**Cons:** Doesn't solve the cross-family lifecycle problem, `UserMapConclusion`-centric.

### 5.4 Recommendation

**Option B (Separate Candidate Table)** is the cleanest long-term architecture, but it is a large migration. **Option A (Shared Lifecycle Fields)** is a reasonable intermediate step that enables lifecycle tracking without a new table.

**Deferred decision:** The final schema choice should be made after:
1. The candidate lifecycle state machine is validated against real dark-run output
2. The promotion/rejection workflow is defined
3. The reviewer/approval behavior is defined

---

## 6. Safety Constraints

Any future implementation must:

1. **Not break existing UserMapConclusion reads.** Current queries filter by `status` and `visibility`. Adding lifecycle fields must not change existing query semantics.
2. **Not expose candidate state as accepted belief.** `visibility=candidate` or equivalent must remain distinct from `user_visible`.
3. **Not create ModelUpdate rows from candidate lifecycle transitions.** ModelUpdate creation is a separate concern (Phase H / Phase 4 deferred).
4. **Not auto-promote candidates.** Promotion must remain a gated, explicit action.
5. **Preserve supersession lineage.** When a candidate is superseded, the previous version must remain queryable.
6. **Not add raw evidence to public projections.** Evidence links attached to candidates must follow the same public-safety rules as existing evidence links.
7. **Not introduce scheduler/cron.** Lifecycle transitions (e.g., `proposed → expired`) must be trigger-based or explicit, not automatic time-based in this phase.

---

## 7. Blocked Downstream Work

The following work is blocked or partially blocked until the candidate lifecycle is resolved:

| Work item | Blocked by | Severity |
|-----------|-----------|----------|
| Dark-engine durable write path | No candidate storage schema for non-UserMapConclusion families | HIGH |
| ModelUpdate creation from dark engine | No lifecycle status on ModelUpdate | HIGH |
| Investigation auto-creation from dark engine | No visibility or candidate state on Investigation | HIGH |
| FieldworkAssignment auto-creation from dark engine | No visibility or candidate state on FieldworkAssignment | HIGH |
| Candidate promotion workflow | No `promoted`/`rejected` states on any model | HIGH |
| Candidate expiry/cleanup | No `expired` state or expiry timestamp | MEDIUM |
| Cross-family candidate query (e.g., "show all candidates") | No unified candidate table or view | MEDIUM |
| User-facing candidate review UI | No consistent lifecycle to display | MEDIUM |
| Candidate supersession across families | No cross-family supersession links | LOW |

---

## 8. Recommended Next Implementation Slice

### Slice: Add `candidateLifecycleStatus` to UserMapConclusion only

**Rationale:** `UserMapConclusion` is the closest existing model to the candidate lifecycle, already has supersession links and visibility, and is the only model with a working dark-engine persistence path. Adding lifecycle status here is the smallest sufficient change to unblock downstream work.

**Allowed:**
- Add `CandidateLifecycleStatus` enum to Prisma schema
- Add `candidateLifecycleStatus` field to `UserMapConclusion` model (nullable, to not break existing records)
- Add migration for the new field
- Update `persistInternalUserMapConclusionCandidate` to set `candidateLifecycleStatus`
- Update `mapDecisionToPersistedStatus` to map to lifecycle status
- Update internal review candidate query to filter/sort by lifecycle status
- Add tests for lifecycle status mapping

**Forbidden:**
- No changes to `Investigation`, `ModelUpdate`, or `FieldworkAssignment` schema
- No new tables
- No changes to public API routes or surfaces
- No ModelUpdate creation
- No scheduler/cron
- No auto-promotion
- No changes to mobile projections
- No changes to evidence link behavior

**Verification:**
- `git diff --check`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`

---

## 9. Open Questions

1. Should `CandidateLifecycleStatus` be a shared enum used across all families, or should each family have its own?
2. Should `rejected` candidates be soft-deleted or remain queryable?
3. What is the expiry policy? (e.g., 30 days in `proposed` without promotion → `expired`)
4. Should `disputed` (UserMapConclusion) be a lifecycle state or an orthogonal flag?
5. How does the candidate lifecycle interact with the PatternClaim lifecycle? (They are separate today — should they remain separate?)
6. Should `UnderstandingEvidenceLink` get a lifecycle status for candidate-attached evidence?
