# 02 — Detector and classifier trace

**Phase:** A — read-only trace of actual runtime behaviour
**Primary files:** `lib/contradiction-detection.ts`, `lib/import-chatgpt.ts`, `lib/contradiction-materialization.ts`

---

## Pipeline overview

```mermaid
flowchart TD
  M[Message content] --> LEN{length >= 15?}
  LEN -->|no| EMPTY[return []]
  LEN -->|yes| MARK{substring markers?}
  MARK -->|goal markers| GFAN[Pair ALL goal refs]
  MARK -->|constraint markers| CFAN[Pair ALL constraint refs]
  MARK -->|none| EMPTY
  GFAN --> DED[dedupe max 2]
  CFAN --> DED
  DED --> IMP{import path?}
  IMP -->|yes| CLS[classifyImportedContradictionPair]
  CLS --> FAN[fanout guard]
  FAN --> MAT[materializeContradictions]
  IMP -->|live| MAT
```

---

## 1. `detectContradictions` / `detectContradictionsFromData`

| Aspect | Value |
|--------|-------|
| **Inputs** | `userId`, `messageContent`; optional `referenceStatuses` (default `["active"]`) |
| **Outputs** | `DetectedContradiction[]`: `{ title, sideA, sideB, type, confidence, existingNodeId? }` |
| **Deterministic vs model** | **100% deterministic** — no LLM, no embeddings |
| **Semantic opposition tested** | **No** |
| **Logical compatibility tested** | **No** |
| **Negation / modality / time / actor / scope** | **Not preserved or tested** — raw strings copied |

### Async DB inputs (`detectContradictions` L238–271)

- `ReferenceItem`: `type IN (goal, constraint)`, `status IN referenceStatuses`, user-scoped, `take: 50`, ordered `confidence DESC, updatedAt DESC`
- `ContradictionNode`: `status IN (candidate, open, snoozed, explored)`, user-scoped, `take: 50`

**Cross-session effect:** Reference query is **not session-scoped**. Side A may come from any session in the user's history.

### Core logic (`detectContradictionsFromData` L143–213)

Constants:

```typescript
MAX_DETECTIONS_PER_MESSAGE = 2
MIN_DETECTION_LENGTH = 15
GOAL_MISMATCH_MARKERS = ["i didn't", "i failed", "i avoided", "i skipped", "i procrastinated"]
CONSTRAINT_VIOLATION_MARKERS = ["but i", "however i", "even though"]
```

Early exit if no marker substring in lowercased message.

---

## 2. Generic contrast-marker detection

| Aspect | Value |
|--------|-------|
| **Input** | `lowerContent.includes(marker)` on full message |
| **Output** | Boolean gate for goal or constraint branch |
| **Deterministic** | Yes |
| **Semantic opposition** | No |
| **Logical compatibility** | No |

**False-positive family (25-candidate audit):** Class C — conversational continuations (`"but I mean"`, `"but I also don't dwell"`, `"but I can literally feel"`) trigger `constraint_conflict` without behavioural failure.

**Scale:** All 3 `constraint_conflict` candidates + several goal pairs use `"but i"` in non-violation contexts.

---

## 3. `"but i"` matching

| Aspect | Value |
|--------|-------|
| **Mechanism** | Case-insensitive substring after `toLowerCase()` |
| **Word boundary** | None |
| **Clause parsing** | None |
| **Scope to constraint semantics** | None |

When matched, emits one detection **per** constraint `ReferenceItem` (up to 50).

**Exemplar:** `cmp2fvq8f00aoqlsyy9z3sckc` — Side B somatic sensations; trigger is rhetorical `"but I"` not constraint breach.

---

## 4. `goal_behavior_gap` rules

| Aspect | Value |
|--------|-------|
| **Trigger** | Any `GOAL_MISMATCH_MARKERS` substring |
| **Side A** | `reference.statement` for **every** goal ref |
| **Side B** | Entire current message |
| **Type** | `goal_behavior_gap` |
| **Confidence** | Fixed `"medium"` |
| **Title** | Fixed `"Goal behavior gap"` |
| **Semantic opposition** | No |
| **Logical compatibility** | No |

**False-positive families:**

- **Goal vs obstacle** (Class C/D): Side B expresses difficulty, doubt, or obstacle while Side A states intention — not necessarily non-compliance.
- **Partial compliance** (Class B downgraded): Side B contains `"I did review it after every read"` alongside `"I didn't"` — qualifier omitted from evaluation.
- **Cross-session** (17/25): Side A goal from unrelated conversation.

**Near-miss (Class B, not proof-eligible):** `cmp2fvtjy00b0qlsyue6873np` — Du Bois reading retention tension, same session, partial compliance acknowledged.

---

## 5. `constraint_conflict` rules

| Aspect | Value |
|--------|-------|
| **Trigger** | Any `CONSTRAINT_VIOLATION_MARKERS` substring |
| **Side A** | `reference.statement` for **every** constraint ref |
| **Side B** | Full message |
| **Confidence** | Fixed `"low"` |
| **Semantic / logical checks** | None in core detector |

**False-positive family:** Compatible simultaneous states (Class C) — e.g. fun/indifference + objectivity co-asserted vs somatic identity sensations while non-reactive.

---

## 6. Token-overlap scoring (two uses)

### A) Existing-node dedup (`isSimilarText`, L86–107)

| Input | Normalized text pair |
| Output | Match if exact, substring (≥15 chars), or `tokenOverlap >= 0.6` |
| Purpose | Reuse appendable node — **not** eligibility |

Tokens: length > 2; overlap ratio = shared / min(set sizes); requires ≥3 tokens per side.

### B) Import pair classifier (`contradictionPairOverlapCount`, `import-chatgpt.ts` L525–543)

| Input | Side A and Side B text |
| Output | Shared token count (≥3 chars, stopword-filtered) |
| Eligibility gate | Reject if overlap < 2 **unless** Side B matches `SIDE_B_BEHAVIORAL_FAILURE_PATTERN` |

| Semantic opposition | No |
| Logical compatibility | No — generic tokens (`that`, `feel`, `identity`, `brain`) pass unrelated pairs |

**Exemplar:** `cmp2fvq8f00aoqlsyy9z3sckc` — overlap 3 on generic tokens; `{ eligible: true, reasons: [] }`.

---

## 7. Classifier eligibility (`classifyImportedContradictionPair`)

**File:** `lib/import-chatgpt.ts` L681–806
**Import-only** — live chat path skips entirely.

| Aspect | Value |
|--------|-------|
| **Inputs** | `{ sideA, sideB }` from detection |
| **Outputs** | `{ eligible: boolean, reasons: ImportedContradictionRejectionReason[] }` |
| **Deterministic** | Yes — regex + token overlap + relevance classifiers |
| **Semantic opposition** | No |
| **Logical compatibility** | Partial/heuristic — rejects obvious unrelated/chatter/technical pairs only |

Rejection reason codes include: `contradiction_project_task_pair`, `contradiction_low_context_pair`, `contradiction_pasted_plan_pair`, `contradiction_cross_topic_pair`, `contradiction_conversational_sideA`, `contradiction_weak_behavior_sideB`, `contradiction_technical_sideB`, `contradiction_unrelated_pair`.

**Known gap:** Cross-session pairs with token overlap ≥ 2 pass despite unrelated propositions.

---

## 8. Candidate confidence assignment

| Path | Assignment |
|------|------------|
| `goal_behavior_gap` | Hard-coded `"medium"` |
| `constraint_conflict` | Hard-coded `"low"` |
| Materialization | Copies to `ContradictionNode.confidence` |
| Manual POST | Schema allows low/medium/high |

No quality scoring — confidence is rule-label, not pair assessment.

---

## 9. Context truncation and qualification preservation

| Stage | Truncation |
|-------|------------|
| Detection Side A/B | **None** — full strings |
| Reference extraction (import) | Rejects statements > 250 chars |
| Prompt injection (chat) | `truncateForPrompt(sideA/sideB, 240)` — display only |
| Import review excerpt | 280 chars in query layer |
| Materialization quote | Full Side B message |

**Qualification preservation:** **Not implemented.** Hedges (`usually`, `sometimes`, `although`), temporal scope, actor scope, and partial-compliance clauses are not parsed. Side B full text includes qualifiers but detector does not evaluate them.

**False-positive family:** Omitted qualifiers — reading example where Side B explicitly acknowledges partial compliance.

---

## 10. Cross-session candidate search

| Aspect | Value |
|--------|-------|
| Reference scope | User-wide, not session-scoped |
| Import refs visible | `referenceStatuses: ["active", "candidate"]` includes refs from earlier in same import |
| Effect | Side A session A + Side B session B |
| Scale | **17 / 25** pending CNs cross-session |

No same-session enforcement at detection or materialization.

---

## 11. ReferenceItem selection for Side A

| Step | Behaviour |
|------|-----------|
| Pool | ≤50 goal/constraint refs, user-wide |
| Filter | By marker branch (goal vs constraint) |
| Selection | **No best-match** — one detection per matching ref (fan-out) |
| Side A text | `reference.statement` |
| Side A provenance | On ReferenceItem FKs — **not** copied to detection output or CN row |
| Fanout cap (import) | `applyImportedContradictionFanoutGuard` — max 3 uses per normalized sideA or sideB per import run |

**Pattern:** Three `constraint_conflict` candidates share one Side A constraint ref (`043a6387…`) — fanout from single ref × multiple Side B messages.

---

## 12. Materialization lineage (`materializeContradictions`)

| Field | Value |
|-------|-------|
| `sideA`, `sideB` | From detection |
| `sourceSessionId`, `sourceMessageId` | **Side B detection message only** |
| `ContradictionEvidence` | One row: Side B quote |
| `ContradictionReferenceLink` | **Not created** |

---

## Rule summary table

| Rule | Inputs | Outputs | Deterministic | Semantic opposition | Logical compatibility | Preserves negation/modality/time/actor/scope | False-positive family |
|------|--------|---------|---------------|----------------------|----------------------|---------------------------------------------|----------------------|
| MIN_DETECTION_LENGTH | message length | early exit | Yes | — | — | — | D (too short skipped) |
| Goal markers | lowercased message | branch | Yes | No | No | No | C/D goal vs obstacle |
| Constraint markers | lowercased message | branch | Yes | No | No | No | C `"but i"` rhetorical |
| Ref fan-out | all matching refs | N detections | Yes | No | No | No | C/D cross-session |
| tokenOverlap dedup | side texts | existingNodeId | Yes | No | No | No | — |
| classifyImportedPair | sideA, sideB | eligible | Yes | No | Partial | No | C/D weak overlap escape |
| fanout guard | sideA, sideB counts | accept/reject | Yes | No | No | No | — |
| confidence | type label | low/medium | Yes | No | No | No | — |

---

## Test coverage gaps

| Covered in unit tests | Not covered in core contradiction tests |
|-------------------------|------------------------------------------|
| Goal gap detection | `classifyImportedContradictionPair` (in `import-chatgpt.test.ts`) |
| Empty when no signal | Cross-session behaviour |
| Existing node reuse | `"but i"` false positives |
| Materialization dedup | Qualifier / partial compliance |
| Schema validation | Compatible-state rejection |

---

## Detector root causes (consolidated)

1. **Marker-only gating** — substring presence treated as contradiction signal
2. **Reference fan-out** — all refs paired, no best-match or session scope
3. **No proposition analysis** — no negation, modality, time, actor, or scope handling
4. **No compatibility check** — simultaneous compatible states accepted
5. **Import classifier insufficient** — token overlap ≠ semantic relation
6. **Asymmetric lineage** — Side A provenance not persisted on CN or accept path
