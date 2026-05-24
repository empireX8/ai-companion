# Phase 4 — Actions / Experiments + Explore Semantic Upgrade Design Contract

**Status:** CONTRACT CREATED / READY FOR REVIEW
**Date:** 2026-05-24
**Scope:** Backend architecture only. No mobile-first changes. No schema changes unless explicitly required by a later slice.

---

## 1. Core Product Distinction

These four concepts are **separate concerns** and must not be collapsed into one:

| Concept | Definition | Current state | Future direction |
|---|---|---|---|
| **Action** | A lightweight, rule-generated recommendation. Template-driven, deterministic, no LLM. | ✅ Implemented. `GET /api/actions` returns `stabilizeNow` + `buildForward`. `PATCH /api/actions/[id]` accepts `status` + `note`. | Add outcome tracking diagnostics. Add "Reflect in Explore" handoff. |
| **Experiment / Fieldwork** | A structured observation task with required `observationNote` or `observationOutcome` on completion. | ✅ Implemented. `POST /api/fieldwork` creates. `PATCH /api/fieldwork/[id]` transitions status. Standalone — no integration with Actions. | Future bridge: "Turn this action into an experiment" could create FieldworkAssignment. |
| **Explore** | A reflective interpretation surface (`surfaceType="explore_chat"`). Free-form chat with full memory/derivation pipeline. | ✅ Implemented. `/explore` page uses `SurfaceChatShell`. Profile derivation runs for explore sessions. | Add safe action context handoff. No raw evidence. |
| **ModelUpdate** | A durable, persisted record of a change in the system's understanding of the user. | ✅ Implemented. Created by dark engine and profile derivation. Read-only surfaced via `What Changed`, `Today Intelligence Updates`, `Timeline Model Movement`. | Action feedback may create ModelUpdates only when there is sufficient evidence or explicit user reflection. |

**Hard rule:** Do not collapse these into one concept. An action status change is not automatically a ModelUpdate. A fieldwork observation is not automatically a pattern change.

---

## 2. Feedback Semantics

### 2.1 Status definitions

| Status | Meaning | System response |
|---|---|---|
| `not_started` | Default. Action has been surfaced but not acted on. | No system action. |
| `done` | User completed the action. | Record completion. No model mutation. May later influence action template ranking (see §6). |
| `helped` | User tried the action and found it useful. | Record as positive signal. No model mutation in v1. May later influence template ranking. |
| `didnt_help` | User tried the action and found it not useful. | Record as negative signal. No model mutation in v1. May later suppress similar templates after repeated failures. |

### 2.2 Conservative rule

**A single status update alone must not change the User Map, PatternClaims, or create a ModelUpdate.**

Rationale:
- One person's `helped` on a generic template like "Wind down 20 minutes before bed" does not constitute a meaningful model change.
- Action templates are generic by design — they are not personalized interventions.
- Status feedback is noisy: users may mark `done` without actually trying, or `didnt_help` because of external circumstances.

### 2.3 When feedback becomes meaningful

Repeated feedback or explicit reflection may influence the system:
- **3+ `helped` on templates from the same family** → candidate signal for future blueprint ranking adjustment.
- **3+ `didnt_help` on the same template** → candidate signal for template suppression.
- **Explicit reflection in Explore** (via "Reflect in Explore" handoff) → feeds existing derivation hooks and may produce normal profile derivation outcomes.

These thresholds are **design decisions** that should be validated before implementation.

---

## 3. Action Notes

### 3.1 Current state

`PATCH /api/actions/[id]` already accepts a `note` field. Notes are stored on `SurfacedAction.note` (nullable string). Mobile and web both support setting notes.

### 3.2 Policy

| Rule | Rationale |
|---|---|
| Notes are user-authored raw text. | Notes are free-form reflections, not structured data. |
| Notes are stored on `SurfacedAction` only. | No separate note table needed. No duplication. |
| Notes must not be rendered as public evidence. | Notes are private user reflections. They are not evidence for patterns, tensions, or model updates. |
| Notes must not appear in `quote`, `snippet`, or `summary` fields of any evidence/projection API. | Raw text exposure is prohibited. |
| Notes may later be summarized into safe feedback signals if explicitly designed. | Future work. Requires a design decision about summarization approach. |

### 3.3 Implementation constraint

The `note` field on `SurfacedAction` is already nullable and validated. No schema change is needed for v1 note support.

---

## 4. ModelUpdate Policy

### 4.1 When action feedback may create a ModelUpdate

**Not on every status change.** ModelUpdates are durable records of the system's understanding. Creating one for every `helped`/`didnt_help` would produce noise.

A ModelUpdate may be created only when:
1. **Sufficient evidence exists** — e.g., 3+ `helped` on templates from the same family, or repeated `didnt_help` on the same template.
2. **Explicit user reflection** — e.g., the user writes a reflection in Explore about an action outcome, and the existing derivation pipeline produces a profile change.

### 4.2 ModelUpdate shape

If a ModelUpdate is created from action feedback:

| Field | Constraint |
|---|---|
| `updateType` | Must be a new or existing type that clearly indicates action feedback (e.g., `action_feedback_aggregate`). Must not be confused with dark-engine or profile-derivation updates. |
| `visibility` | `user_visible` only. Never `internal_only` for action feedback. |
| `affectedObjectType` | `surfaced_action` or the linked object type (e.g., `pattern_claim` if the action was linked to a claim). |
| `affectedObjectId` | The action ID or linked object ID. |
| `userFacingSummary` | Safe, generic language. Example: "You've found several stabilising actions helpful this week." |
| `isMeaningful` | `true` only if the feedback crosses the evidence threshold. |
| `beforeSummary` / `afterSummary` | Not applicable for action feedback in v1. |
| `confidenceDelta` | Not applicable in v1. |
| `meaningfulDeltaScore` | Not applicable in v1. |

### 4.3 Hard rule

**No raw note text in `userFacingSummary`.** Notes are private user text. ModelUpdate summaries must use safe, generic language.

---

## 5. PatternClaim Policy

### 5.1 v1 rule

**Action feedback must not directly mutate PatternClaim strength or status.**

Rationale:
- PatternClaims are derived from evidence (journal entries, chat sessions, imports). Action outcomes are not evidence in the same sense.
- A single `helped` on a stabilise action does not mean the underlying pattern has changed.
- Pattern changes require stronger evidence than one action outcome.

### 5.2 Future possibility

Action feedback may later affect **action blueprint ranking** (see §6), not PatternClaim mutation. If the system observes that a user consistently finds `trigger_condition` stabilise actions helpful, it may rank those templates higher — but it should not change the `trigger_condition` PatternClaim's strength or status.

---

## 6. Action Strategy Policy

### 6.1 Template ranking

| Signal | Effect |
|---|---|
| `helped` on a template | Raise confidence in that template for similar contexts. |
| `didnt_help` on a template | Reduce confidence. Suppress only after repeated failures (3+). |
| No feedback | No effect. Template remains available. |

### 6.2 Single-datapoint rule

**Single datapoints must be stored but not over-weighted.**

- Store the feedback on the `SurfacedAction` row (already supported).
- Do not change blueprint selection logic based on a single `helped` or `didnt_help`.
- Only after a threshold (e.g., 3+ signals) should ranking be adjusted.

### 6.3 Implementation note

The current blueprint selection logic in `lib/actions-v1.ts` is purely rule-based (template order by family, goal signal strength). Adding outcome-based ranking would require:
1. A query to aggregate past action feedback by template/family.
2. A ranking adjustment function that modifies the deterministic order based on aggregate signals.
3. Tests proving the ranking adjustment does not introduce bias or noise.

This is **slice 4D** (see §9).

---

## 7. Fieldwork Integration

### 7.1 Current state

FieldworkAssignment is a standalone observation system. It has:
- `prompt`, `reason`, `status`, `linkedObjectType`, `linkedObjectId`
- `observationNote`, `observationOutcome` (required for `completed` status)
- `completedAt`, `expiresAt`, `priority`

It has **no integration with Actions**. No fieldwork is generated from action status changes. No action is generated from fieldwork observations.

### 7.2 v1 rule

**Actions must not automatically create FieldworkAssignments.**

Rationale:
- Actions are lightweight recommendations. FieldworkAssignments are structured observation tasks.
- Automatically creating fieldwork from every action would overwhelm the user.
- The two systems serve different purposes and should remain separate until a deliberate bridge is designed.

### 7.3 Future bridge

A future slice may add: **"Turn this action into an experiment"** — a user-initiated action that creates a FieldworkAssignment from an action's context:
- `prompt` ← action title
- `reason` ← action whySuggested
- `linkedObjectType` ← `surfaced_action`
- `linkedObjectId` ← action ID
- `status` ← `assigned`

This is **slice 4E** (see §9) and requires a design decision about the UI entry point.

### 7.4 Fieldwork → feedback

Completing a FieldworkAssignment with an observation may produce feedback signals:
- `observationOutcome` could be categorised (e.g., "confirmed", "refuted", "inconclusive").
- These signals could feed the same aggregate feedback system as action `helped`/`didnt_help`.
- They must not automatically create PatternClaims or ModelUpdates.

This is **future work** beyond Phase 4.

---

## 8. Explore Context Handoff

### 8.1 Safe v1 design

**"Reflect in Explore"** — a CTA on an action card that opens or creates an `explore_chat` session with safe action context.

### 8.2 Context payload

| Field | Included? | Rationale |
|---|---|---|
| Action title | ✅ Yes | Public-safe. Part of the action view. |
| `whySuggested` | ✅ Yes | Public-safe. Part of the action view. |
| Status | ✅ Yes | Public-safe. Part of the action view. |
| Linked pattern summary | ✅ Yes, if already public-safe | Pattern summaries are already public-safe in the action view. |
| Linked goal statement | ✅ Yes | Goal statements are user-authored and already public-safe. |
| Raw evidence | ❌ No | Prohibited. |
| Private notes | ❌ No | Unless the user explicitly includes them in the Explore message. |
| Hidden metadata (IDs, timestamps, internal fields) | ❌ No | Not user-facing. |

### 8.3 Mechanism

1. User clicks "Reflect in Explore" on an action card.
2. System creates or opens an `explore_chat` session.
3. System injects a safe context block into the Explore session (as a system message or pre-populated context).
4. User writes their reflection as normal Explore messages.
5. Existing derivation hooks (`processNativeUserMessageForProfile`) process the Explore messages as they already do for `explore_chat` sessions.
6. No special handling needed — the Explore session already feeds profile derivation.

### 8.4 Context block format

```
You opened this from an action:

Action: [title]
Why suggested: [whySuggested]
Status: [status]
Linked to: [linked pattern summary or goal statement, if available]

Reflect on your experience with this action. What did you notice? What changed?
```

### 8.5 Implementation requirements

- A new API or route to create/open an Explore session with context (or extend the existing session creation).
- Safe serialisation of the context payload (no raw evidence, no hidden fields).
- The context block must be stored as a system message or session metadata, not as a user message.
- The Explore page must accept and render the context block.

This is **slice 4C** (see §9).

---

## 9. Implementation Roadmap

### Slice 4A: Design contract (this document)
- Record architecture decisions.
- Define feedback semantics.
- Identify safe boundaries.
- **Status:** ✅ COMPLETE (this document).

### Slice 4B: Backend-safe action feedback event helper
- Add a lightweight diagnostics helper that aggregates action feedback by template/family.
- No model mutation. No schema change.
- Pure query + aggregation. Read-only.
- Output: `{ templateId, totalHelped, totalDidntHelp, totalDone, lastFeedbackAt }` per template.
- Tests: verify aggregation logic, verify no side effects.
- **Status:** 🔲 NOT STARTED. Safe to implement. No design decisions needed.

### Slice 4C: Reflect in Explore handoff
- Add safe action context handoff to Explore sessions.
- New API or route for creating Explore sessions with context.
- Safe context serialisation (title, whySuggested, status, linked summary).
- No raw evidence. No private notes.
- Tests: verify context payload is safe, verify Explore session creation, verify no raw evidence leakage.
- **Status:** 🔲 NOT STARTED. Requires design decision about API shape.

### Slice 4D: Action template outcome ranking
- Add outcome-based ranking to blueprint selection.
- Query aggregate feedback by template/family.
- Adjust deterministic order based on aggregate signals.
- Threshold: 3+ signals before ranking changes.
- Tests: verify ranking adjustment, verify no bias, verify threshold behavior.
- **Status:** 🔲 NOT STARTED. Requires design decision about ranking algorithm.

### Slice 4E: Fieldwork bridge (future)
- "Turn this action into an experiment" — user-initiated FieldworkAssignment creation from action context.
- Requires UI entry point design.
- **Status:** 🔲 NOT STARTED. Requires product decision.

### Slice 4F: ModelUpdate creation from action feedback (future)
- Create ModelUpdates only when sufficient evidence exists.
- Safe generic summaries only.
- **Status:** 🔲 NOT STARTED. Requires evidence threshold validation.

---

## 10. Explicit Non-Goals

The following are explicitly **out of scope** for Phase 4:

| Non-goal | Rationale |
|---|---|
| Automatic User Map conclusion promotion | Action feedback is not evidence for conclusions. |
| PatternClaim mutation from single action feedback | Pattern changes require stronger evidence. |
| Raw evidence exposure | Prohibited across all surfaces. |
| Fake/synthetic experiments | No LLM-generated experiments. No auto-generated fieldwork. |
| Mobile-first changes before backend contract | Backend contract must be stable before mobile consumes it. |
| Schema changes unless required by a later slice | No schema changes for 4A–4C. 4D–4F may require schema changes after design validation. |
| Due dates, streaks, reminders on actions | Actions are lightweight recommendations, not commitments. |
| LLM-generated action suggestions | Current rule-based generation is deterministic and safe. LLM generation would introduce unpredictability and trust risk. |

---

## 11. Open Questions

These questions require product/design decisions before implementation:

1. **Feedback threshold:** What is the minimum number of `helped`/`didnt_help` signals before the system should adjust template ranking? (Proposed: 3.)
2. **Template suppression:** Should `didnt_help` ever permanently suppress a template, or only temporarily reduce its rank?
3. **Explore handoff API shape:** Should the handoff be a query parameter on the Explore page URL, a new API endpoint, or a session metadata field?
4. **Fieldwork bridge priority:** Is "Turn this action into an experiment" a Phase 4 concern or a later product decision?
5. **ModelUpdate type:** If action feedback creates ModelUpdates, what `updateType` value should be used? (Proposed: `action_feedback_aggregate` — requires schema enum addition.)
6. **Cross-surface visibility:** Should action feedback aggregates be visible on the web Actions page, or remain backend-only diagnostics?

---

## 12. Recommended First Implementation Slice

**Slice 4B: Backend-safe action feedback event helper.**

Rationale:
- No design decisions needed — pure query + aggregation.
- No schema changes.
- No UI changes.
- Provides the diagnostics foundation that 4D (ranking) and 4F (ModelUpdate) will depend on.
- Safe to implement immediately.
- Tests can verify correctness without risk.

Slice 4B output:
- A new helper function in `lib/actions-v1.ts` (or a new `lib/actions-feedback.ts`).
- Aggregation query: `SELECT templateId, bucket, COUNT(*) FILTER (WHERE status = 'helped') AS helped, COUNT(*) FILTER (WHERE status = 'didnt_help') AS didnt_help, COUNT(*) FILTER (WHERE status = 'done') AS done, MAX(updatedAt) AS lastFeedbackAt FROM SurfacedAction WHERE userId = ? AND status != 'not_started' GROUP BY templateId, bucket`.
- Return type: `ActionFeedbackAggregate[]`.
- Tests: verify aggregation with mock data, verify empty state, verify no side effects.
- No route changes. No schema changes. No UI changes.

---

## 13. Safety Checklist

Before any Phase 4 implementation slice is merged:

- [ ] No raw evidence text exposed
- [ ] No fake/synthetic action suggestions
- [ ] No unsupported receipt namespaces
- [ ] No automatic User Map conclusion promotion
- [ ] No weakening of evidence gates
- [ ] No broad redesign
- [ ] No mobile changes in this pass
- [ ] Action mutation remains auth/user-owned
- [ ] Allowed status/note/reflection fields only
- [ ] No raw evidence/meta exposure
- [ ] No fake generated actions
- [ ] Feedback/model update creation is gated and safe if added
- [ ] Existing GET/PATCH behavior preserved
- [ ] Failures in downstream feedback hooks do not corrupt action update
- [ ] `npx prisma generate` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] `npm run build` passes
- [ ] `bash scripts/check-trust-language.sh` passes
- [ ] `bash scripts/check-legacy-surfaces.sh` passes
