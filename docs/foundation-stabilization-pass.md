# Foundation Stabilization Pass

_Written after Passes 1–4. Converts architectural clarity into a concrete debt register and prioritized roadmap._
_Source of truth: `docs/cognitive-architecture-pass-{1..4}.md` + code inspection (schema, API routes, UI)._
_No code changes in this pass._

---

## 1. Executive Summary

### A) What is already good enough to keep

- **Ontology docs exist.** Passes 1–4 define entities, relations, promotion logic, retrieval priority, and conflict-handling rules with enough precision to guide implementation. This is rare and valuable — do not re-evaluate it.
- **Terminology cleanup is complete.** All user-facing labels use Tensions / Forecasts / Review / Level correctly.
- **ReferenceItem (Memory) has partial candidate/active support.** The `ReferenceStatus` enum (`candidate | active | superseded | inactive`) exists in the schema. The memory governance flow correctly creates `candidate` for conflicting updates and prompts the user for confirmation. This is the one entity type where the architecture is partially real in product behavior.
- **Tension (ContradictionNode) action lifecycle is complete.** Snooze / resolve / accept-tradeoff / archive / reopen + undo windows + escalation ladder are fully implemented and working.
- **WeeklyAudit (Review) is structurally sound.** Draft/locked lifecycle, hash sealing, backfill, compare, explain panel — all complete.
- **Retrieval pipeline exists.** Memory, transcript, and Pinecone vector retrieval all run per turn. The infrastructure is there.
- **Profile derivation system exists.** `ProfileArtifact` with `candidate/active/superseded` status, rule-based extraction from user messages, and EvidenceSpan linking is all implemented. It is unused by the UI and not injected into the model, but the backend work is done.
- **DerivationRun / DerivationArtifact layer exists.** Import-time detection outputs are tracked in this layer with candidate/promoted/rejected status.
- **Import pipeline is mature.** Chunked upload, checksum verification, streaming JSON/ZIP processing, progress polling — all solid.
- **Response mode toggle exists.** Standard/deep with different retrieval depths.

### B) What is still foundationally incomplete

**These are not feature gaps. They are places where the product is structurally inconsistent with its own architecture, or where the UI implies behavior the system does not actually have.**

1. **Tension detection creates `open`, not `candidate`.** The architecture's most fundamental rule — "no silent promotion" — is violated every time tension detection fires. New tensions are auto-promoted directly to `open` (injected into future sessions) with zero user confirmation.

2. **Memory auto-creation for non-conflicting cases skips confirmation.** When a user says "I prefer X" and no conflicting memory exists, the system creates an `active` ReferenceItem and responds "Saved — I stored that as a preference." No confirmation. No dismiss option. The user may not have intended to create a permanent memory.

3. **Forecasts (Projections) have no lifecycle at all.** No status field. No archive. No edit. No delete from UI. No injection into the model prompt. They are a write-only text archive that the system neither acts on nor exposes to the assistant.

4. **Evidence capture creates orphaned spans.** Clicking "Save evidence" in the chat panel creates an `EvidenceSpan` attached to a message, but with no mechanism to link it to any specific tension. The button implies a functioning evidence system; the reality is unfiled data.

5. **The "Save reference" (URL) button stores a URL as type `pattern`.** The `ReferenceType` enum has no `source` value. URLs saved via the Globe icon are categorized as `pattern`, injected into the assistant as part of the user's cognitive profile, and treated identically to pattern memories. This is wrong.

6. **All memories are injected into every turn without relevance filtering.** `getActiveReferenceMemory` takes the top 50 active memories, groups them, and injects them all — every turn, regardless of whether they're relevant. The retrieval architecture says: "selectively injected, bounded by relevance score and a per-session cap." The implementation does not enforce this.

7. **Tensions are injected into every turn regardless of topical relevance.** The top 3 tensions by escalation level are always injected. The retrieval architecture says: "selectively injected... Not injected when the current turn is clearly unrelated." The implementation does not enforce this.

8. **Forecasts are never injected into the model prompt despite being stored.** Forecasts have zero influence on the assistant. The product has a Forecasts section but the assistant has never heard of any of them.

9. **ProfileArtifact is an invisible shadow system.** Rule-based profile extraction (`processMessageForProfile`) runs on every user message and creates `ProfileArtifact` entities (BELIEF, GOAL, FEAR, IDENTITY, TRAIT, etc.) with candidate/active status. None of this is surfaced to the user. None is injected into the model. Users have a rich profile being built silently that affects nothing.

10. **Internal probe rung names leak into the system prompt.** The prompt injected into the model includes `recommended_rung: rung1_gentle_mirror` (or rung2/3/4/5). This is an internal implementation concept the user cannot see or understand, exposed to the model as if it were actionable guidance. The model's behavior is shaped by an opaque internal ladder the user has no awareness of.

11. **Import creates tensions at `open`, bypassing the candidate model.** Import is the highest-risk entry point for creating false or low-quality tensions. The architecture says imported tensions should be `candidate`. They are created at `open` and immediately influence the assistant's next session.

12. **No candidate surfacing UI exists for tensions or ProfileArtifacts.** Candidates for memory updates are surfaced through a dialog in the chat stream (partial, works for one case). Candidate tensions do not exist yet. Candidate ProfileArtifacts have no surfacing mechanism at all.

---

## 2. Stabilization Categories

### A) Schema / Model Debt
Missing fields and status models that block correct lifecycle behavior.

### B) API / Backend Flow Debt
Routes that behave incorrectly relative to the documented architecture — wrong status values, wrong entity creation logic, missing validation.

### C) Retrieval / Surfacing Enforcement Debt
The chat completion pipeline injects context without the relevance gates and caps the architecture requires.

### D) UI / Product Behavior Debt
Product surfaces that imply capabilities the system does not actually have, or that are incomplete in ways users will encounter.

### E) UX / Guidance / Legibility Debt
User communication and system transparency gaps that make the product hard to understand or trust.

### F) Terminology / Conceptual Mismatch Debt
Naming mismatches between the architecture, the code, and the UI that cause confusion.

---

## 3. Debt Register

---

### D-01 — Tension detection writes `open`, should write `candidate`

| Field | Value |
|---|---|
| **ID** | D-01 |
| **Title** | Tension detection writes `open` instead of `candidate` |
| **Category** | B — API/backend flow |
| **Problem** | In `app/api/message/route.ts`, when `detectContradictions` returns a new tension, `contradictionNode.create` is called with `status: "open"`. This makes it immediately visible, immediately injected into future sessions, and immediately actionable — with no user confirmation. |
| **Why it matters** | This is the core "no silent promotion" rule from Pass 3 (OP-7). It is violated on every new tension detection. The user's assistant context silently accumulates tensions the user never confirmed. |
| **Current risk** | High. False-positive tensions pollute prompt context. Users who notice them have no idea where they came from. |
| **What "done" means** | `ContradictionStatus` enum includes `candidate`. Detection writes `candidate`. A candidate surfacing UI exists. User confirms → `open`. |
| **Priority** | Critical |
| **Type** | Schema + backend |
| **Depends on** | D-12 (candidate surfacing UI) |

---

### D-02 — Memory auto-creation bypasses confirmation for non-conflicting cases

| Field | Value |
|---|---|
| **ID** | D-02 |
| **Title** | Memory governance creates `active` without user confirmation (non-conflict path) |
| **Category** | B — API/backend flow |
| **Problem** | In `app/api/message/route.ts` (lines 503–524), when a user message triggers `maybeMemoryUpdate` and no conflicting item exists, a `ReferenceItem` is created at `status: "active"` and the assistant replies "Saved — I stored that as a preference." No opt-in. No dismiss. The user said "I prefer X" — the system created a permanent memory. |
| **Why it matters** | Users do not always intend to create permanent memories when stating preferences in conversation. Silently creating `active` items on simple statements is unexpected and can't be undone without navigating to the memory panel. |
| **Current risk** | Medium. Memory store accumulates entries the user didn't consciously create. Injected into every future session. |
| **What "done" means** | All auto-detected memories are created as `candidate` with a clear confirmation prompt. Only explicit captures (memory panel UI) create `active` directly. |
| **Priority** | High |
| **Type** | Backend |
| **Depends on** | D-12 |

---

### D-03 — Forecast (Projection) has no status lifecycle

| Field | Value |
|---|---|
| **ID** | D-03 |
| **Title** | Projection model has no status field, no lifecycle |
| **Category** | A — Schema |
| **Problem** | The `Projection` schema has no `status` field. Forecasts cannot be archived, expired, superseded, or marked fulfilled. They also cannot be deleted from the UI. The Forecasts domain page says "Select a projection to view details" (wrong term — should be "forecast"). The detail page has no actions. |
| **Why it matters** | Forecasts accumulate with no way to manage them. The architecture (Pass 4 §2.3) says stale forecasts should be gated behind stronger relevance thresholds — this is impossible without a status field. Forecasts should be a living cognitive entity; they are currently a write-only archive. |
| **Current risk** | Medium-high. The product implies a forecasting system; the reality is a text dump users cannot manage. |
| **What "done" means** | `Projection` has `status` field (`candidate \| active \| archived`). Detail page has Archive and Delete actions. Forecasts page copy corrected. |
| **Priority** | High |
| **Type** | Schema + UI |
| **Depends on** | None |

---

### D-04 — Forecasts are never injected into the model prompt

| Field | Value |
|---|---|
| **ID** | D-04 |
| **Title** | Active forecasts have zero influence on the assistant |
| **Category** | C — Retrieval/surfacing |
| **Problem** | `app/api/message/route.ts` injects memories and tensions but never fetches or injects Forecasts. The user can save a forecast ("I expect to change roles within 6 months") and the assistant is completely unaware of it. |
| **Why it matters** | Forecasts are explicitly defined as Layer E in Pass 4 — retrievable on planning-oriented turns. Currently they serve no purpose in the cognitive loop. |
| **Current risk** | Medium. Captured data has no effect on the product's primary function. |
| **What "done" means** | A forecast retrieval step added to the message route; active forecasts injected when the turn is planning/future-oriented. Requires D-03 (status field to filter stale ones). |
| **Priority** | Medium |
| **Type** | Backend |
| **Depends on** | D-03 |

---

### D-05 — Evidence capture creates orphaned, unlinked EvidenceSpans

| Field | Value |
|---|---|
| **ID** | D-05 |
| **Title** | "Save evidence" button creates EvidenceSpan with no tension link |
| **Category** | D — UI/product behavior |
| **Problem** | Clicking "Save evidence" in the chat capture panel calls `POST /api/evidence/create`, which creates an `EvidenceSpan` (message position + content hash). There is no subsequent flow to link this span to a tension. Spans sit in the DB unattached to any cognitive entity. |
| **Why it matters** | The button implies evidence is being captured for a purpose — to ground a tension, support a claim, or inform the system's cognition. The reality is the evidence goes nowhere. It is dead data. |
| **Current risk** | Medium. Users clicking "Save evidence" believe they are doing something useful. They are not. |
| **What "done" means** | After saving a span, a second step allows the user to link it to an existing tension (or create a new candidate tension). Or: the capture flow is redesigned to require selecting a target tension before saving. |
| **Priority** | High |
| **Type** | UI |
| **Depends on** | D-01 (tension candidate lifecycle, so new tensions can be created here) |

---

### D-06 — "Save reference" (URL) stores as type `pattern`, no Source concept

| Field | Value |
|---|---|
| **ID** | D-06 |
| **Title** | URL references stored as `pattern` type; Source is not a distinct concept |
| **Category** | A — Schema; F — Terminology |
| **Problem** | `POST /api/reference/from-url` creates a `ReferenceItem` with `type: "pattern"`. There is no `source` value in `ReferenceType`. External sources (books, articles, URLs) are stored identically to inferred cognitive patterns and injected into the prompt alongside user-stated preferences. The architectural OD-1 (Memory vs Source) is causing real behavioral problems here. |
| **Why it matters** | A saved article URL is not a cognitive pattern. Injecting it as a pattern in the memory block gives the assistant misleading context about the user's stated beliefs. Pass 4 §4.1 says Sources have lower authority than user self-report and should not be treated as Memory. |
| **Current risk** | Medium. Incorrect prompt injection for any user who saves URLs. |
| **What "done" means** | Interim: add a `source` value to `ReferenceType` and filter sources out of the memory injection block (or inject separately with lower authority). Long-term: OD-1 proper split. |
| **Priority** | High |
| **Type** | Schema + backend |
| **Depends on** | None |

---

### D-07 — All 50 memories injected every turn without relevance filtering

| Field | Value |
|---|---|
| **ID** | D-07 |
| **Title** | Memory injection is unbounded and relevance-blind |
| **Category** | C — Retrieval/surfacing |
| **Problem** | `getActiveReferenceMemory(userId)` fetches ALL active `ReferenceItem` rows for the user (up to 50), groups them by type, and injects the entire block into every chat turn. There is no semantic relevance filter against the current message. Pass 4 §1 (Layer B) says memories should be "selectively injected" with "relevance score" and a "per-session cap." |
| **Why it matters** | As the memory store grows, this becomes a prompt stuffing problem. More importantly, a user asking about cooking is being given their career goals as context. This is a retrieval policy violation that will degrade response quality as usage grows. |
| **Current risk** | Low for new users (small memory stores). Growing risk as users accumulate entries. |
| **What "done" means** | Memory injection uses semantic similarity against the current user message (Pinecone already exists for this). Only top-N relevant memories are injected. Cap defined explicitly. |
| **Priority** | Medium |
| **Type** | Backend |
| **Depends on** | None |

---

### D-08 — Tensions injected every turn regardless of topical relevance

| Field | Value |
|---|---|
| **ID** | D-08 |
| **Title** | Tensions always injected; no relevance gate |
| **Category** | C — Retrieval/surfacing |
| **Problem** | `getTop3WithOptionalSurfacing` always returns the top 3 tensions, which are always added to the system prompt via `buildTopContradictionsBlock`. There is no check for whether the current user message is related to any of these tensions. Pass 4 R-2: "A tension should surface when the current turn enters its domain, not in every response." |
| **Why it matters** | A question about formatting a document will instruct the model to be aware of the user's core personal conflicts. This is noise. Restrained, relevant surfacing is more trustworthy than constant injection. |
| **Current risk** | Low for users with few tensions. Medium for users with many escalated tensions. |
| **What "done" means** | Tension injection gated on semantic relevance of the tension's `title + sideA + sideB` against the current message. Only tensions above a relevance threshold enter the prompt. |
| **Priority** | Medium |
| **Type** | Backend |
| **Depends on** | None |

---

### D-09 — Import creates tensions at `open`, bypassing candidate model

| Field | Value |
|---|---|
| **ID** | D-09 |
| **Title** | Import pipeline writes tensions as `open`, not `candidate` |
| **Category** | B — API/backend flow |
| **Problem** | `lib/import-chatgpt.ts` calls `detectContradictions` per conversation, and the resulting tensions are written at `status: "open"` (following the same detection path as live chat). Pass 3 §1.4: "Memories, tensions, and candidates are created at `candidate` status and surfaced in the next chat; they do not auto-promote to `active` on import." |
| **Why it matters** | Import is the highest-volume, lowest-quality input for tension detection. Running LLM contradiction detection over historical ChatGPT conversations produces the most noise. Immediately promoting everything to `open` contaminates the user's tension list with dozens of potentially low-quality detections. |
| **Current risk** | High for imported users. Their first post-import experience is a prompt stuffed with low-confidence auto-detected tensions they didn't create. |
| **What "done" means** | Import-created tensions and memories are written at `candidate`. They appear in a post-import review UI (or the candidate surfacing panel) for the user to confirm or dismiss. |
| **Priority** | Critical |
| **Type** | Backend |
| **Depends on** | D-01 (candidate status on ContradictionNode schema) |

---

### D-10 — Internal rung names leak into the system prompt

| Field | Value |
|---|---|
| **ID** | D-10 |
| **Title** | `rung1_gentle_mirror` and similar internal identifiers injected into model prompt |
| **Category** | E — UX/legibility |
| **Problem** | `buildTopContradictionsBlock` in `app/api/message/route.ts` includes `recommended_rung: rung1_gentle_mirror` (or rung2/3/4/5) in the text injected into the system prompt. These are internal implementation identifiers from the `ProbeRung` enum. The model is guided by them, but users have no visibility into what they mean or that they exist. |
| **Why it matters** | The assistant's behavior in handling tensions is shaped by an opaque internal ladder. This cannot be explained to users ("why did the assistant ask me that?") without exposing internal implementation. It also locks the probe ladder into the prompt format, making it hard to iterate. |
| **Current risk** | Medium. Not a user-facing bug but a product coherence issue. |
| **What "done" means** | Rung guidance is translated into human-readable, user-appropriate framing before injection. Or: the probe ladder logic is moved into the model's base system prompt as a behavioral guideline rather than per-tension metadata. |
| **Priority** | Medium |
| **Type** | Backend + UX |
| **Depends on** | None |

---

### D-11 — ProfileArtifact system is entirely invisible and unused

| Field | Value |
|---|---|
| **ID** | D-11 |
| **Title** | ProfileArtifact system builds user profile silently; data is never surfaced or injected |
| **Category** | D — UI/product behavior; C — Retrieval |
| **Problem** | `processMessageForProfile` runs on every user message (≥ 15 chars) via fire-and-forget background task. It creates `ProfileArtifact` entities (BELIEF, GOAL, FEAR, IDENTITY, TRAIT, HABIT, etc.) with `candidate/active` status and links them to `EvidenceSpan`. Zero of this data is: (a) surfaced to the user, (b) injected into the model prompt, (c) accessible via any UI. It is an entire parallel cognition system that does nothing. |
| **Why it matters** | Either this system should contribute to cognition (and needs retrieval + surfacing), or it should be removed. Silently building data that has no effect is technical debt and a trust issue. |
| **Current risk** | Medium. The system is wasting compute and storage on data that serves no current purpose. More importantly, it creates a false sense that "derivation is happening" when users look at logs. |
| **What "done" means** | Choose: (A) Wire ProfileArtifact into the memory injection layer as a richer memory type. (B) Surface it in a profile panel. (C) Remove it until there is a clear use for it. Option A or C is recommended. Option B is UI work that can wait. |
| **Priority** | Medium |
| **Type** | Cross-cutting |
| **Depends on** | Decision on whether to wire or remove |

---

### D-12 — No candidate surfacing UI for tensions or ProfileArtifacts

| Field | Value |
|---|---|
| **ID** | D-12 |
| **Title** | Candidate review surface is missing for tension candidates (and ProfileArtifacts) |
| **Category** | D — UI/product behavior |
| **Problem** | The architecture assumes users can review, confirm, and dismiss system-created candidates (Pass 3 §4.3; Pass 4 RT-1). The only existing candidate surfacing mechanism is the inline yes/no dialog in the chat stream for conflicting memory updates. There is no UI for reviewing candidate tensions or ProfileArtifact candidates. |
| **Why it matters** | D-01 and D-09 cannot be fixed without somewhere to surface the resulting candidates. If tensions are correctly created at `candidate` but there's no way to promote them, they are invisible forever. |
| **Current risk** | Blocking. D-01 and D-09 fixes are gated on this. |
| **What "done" means** | A candidate review panel (could be in the chat capture panel, or a dedicated page) that lists pending candidates (tensions, memories, possibly ProfileArtifacts) with Confirm / Dismiss actions per item. |
| **Priority** | Critical |
| **Type** | UI |
| **Depends on** | D-01 (tension candidate schema) |

---

### D-13 — Projections page still says "projection" in empty state

| Field | Value |
|---|---|
| **ID** | D-13 |
| **Title** | Projections list page empty state uses wrong terminology |
| **Category** | F — Terminology |
| **Problem** | `app/(root)/(routes)/projections/page.tsx` says "Select a projection to view details" — should say "Select a forecast." |
| **Why it matters** | Terminology cleanup pass missed this file. Minor but inconsistent. |
| **Current risk** | Low. |
| **What "done" means** | Text updated to "Select a forecast to view details." |
| **Priority** | Low |
| **Type** | UI |
| **Depends on** | None |

---

### D-14 — Memory governance hijacks the chat stream with inline dialogs

| Field | Value |
|---|---|
| **ID** | D-14 |
| **Title** | Memory update confirmation interrupts the chat as a stream response |
| **Category** | E — UX/legibility |
| **Problem** | When the memory governance flow detects a conflicting preference/goal/constraint, it bypasses the normal LLM call entirely and returns "Do you want me to update your saved preference from 'X' to 'Y'?" as a synthetic assistant message. The user must respond yes/no to continue. This hijacks the conversation with an administrative dialog that feels like a system bug. |
| **Why it matters** | The chat becomes less trustworthy when the assistant suddenly stops answering the question and asks a database management question. This is a fundamental UX problem for the memory governance flow, regardless of whether the technical implementation is correct. |
| **Current risk** | Medium. Confusing for users who don't understand why their question wasn't answered. |
| **What "done" means** | Memory governance confirmations move to a non-blocking UI surface (toast, sidebar candidate, or capture panel) that doesn't interrupt the main conversation. The LLM responds normally, and the memory candidate is surfaced asynchronously. |
| **Priority** | High |
| **Type** | UX |
| **Depends on** | D-12 (candidate surfacing UI as the destination for the confirmation) |

---

### D-15 — Forecast detail page has no actions (no delete, archive, or edit)

| Field | Value |
|---|---|
| **ID** | D-15 |
| **Title** | Forecast detail page is read-only with no management actions |
| **Category** | D — UI/product behavior |
| **Problem** | `app/(root)/(routes)/projections/[id]/page.tsx` displays premise, drivers, outcomes, and confidence — but has no Delete, Archive, or Edit buttons. Forecasts accumulate with no user-controlled lifecycle. |
| **Why it matters** | Users cannot clean up outdated or incorrect forecasts. Without a delete action, the Forecasts domain becomes a permanent append-only log. |
| **Current risk** | Low-medium. Grows over time as users accumulate stale forecasts. |
| **What "done" means** | Delete button added to detail page. Archive added after D-03 (status field). |
| **Priority** | Medium |
| **Type** | UI |
| **Depends on** | D-03 |

---

## 4. Required Debt Items Assessment

### 4.1 Memory vs. Source Ambiguity

**Current state:** `ReferenceItem` holds both user-cognitive memories (beliefs, preferences, goals) and external source references (URLs saved via the Globe icon). URLs are stored as `type: "pattern"` because there is no `source` type in `ReferenceType`. Both types are injected into the model prompt identically.

**Minimum stabilization step:** Add `source` to `ReferenceType`. Filter items with `type: "source"` out of `getActiveReferenceMemory` (the memory injection block). Optionally inject them as a separate, lower-authority block or not at all. Update `POST /api/reference/from-url` to use `type: "source"`.

**Real long-term fix (OD-1):** Split into two entities — `Memory` (user cognitive) and `Source` (external attributed). This allows different retrieval logic, different injection priority (Pass 4 §4.2), and different lifecycle (sources can be superseded without affecting memories). This split is not required for stabilization but is required for correct retrieval priority logic.

**Verdict:** Minimum fix (add `source` type + filter) is a 1-session implementation item and should not be deferred. Full OD-1 split waits.

---

### 4.2 Dual Evidence Systems

**Current state:** `EvidenceSpan` (general, message-position based, created via `/api/evidence/create`) and `ContradictionEvidence` (tension-specific, created via `/api/contradiction/[id]/evidence`) both exist. They are separate tables with no bridge.

**Minimum stabilization step:** The immediate problem is not the dual structure but that `EvidenceSpan` created from the chat capture panel is orphaned (D-05). Fix D-05 by adding a tension-linking step after span creation. This doesn't require unifying the tables.

**Risks of staying deferred:** Pass 4 (Layer D retrieval) cannot be implemented cleanly because querying "all evidence relevant to a domain" requires joining both tables. The unified evidence retrieval priority (EC-3, RT-5) remains broken. This is real but not immediately blocking.

**Verdict:** Do not unify now. Fix D-05 first. Flag evidence unification as Phase 3 work.

---

### 4.3 Forecast Lifecycle Incompleteness

**Current state:** `Projection` has no `status` field. Created via explicit user capture only (no auto-detection). Displayed in a list/detail UI. Cannot be deleted, archived, edited, or expired. Never injected into the model prompt.

**What is missing for Forecast to be a real entity:**
1. `status` field (`candidate | active | archived | fulfilled | expired`) — minimum: `active | archived`
2. Delete action on detail page
3. Injection into model prompt on planning-oriented turns
4. Eventually: horizon field (when does this forecast expire/evaluate?) and retrospective ("was this right?")

**Misleading UI behavior today:** The Forecasts domain exists as a navigation item with a list and detail page, implying a functioning forecasting system. Users who capture forecasts have no idea the assistant is unaware of them.

**Minimum viable:** Add `status` field + delete action. The retrospective/horizon features are later philosophical work.

**Verdict:** D-03 and D-04 are both required before Forecasts are honest to users.

---

### 4.4 Candidate vs. Active Support Gaps

**Current state by entity:**

| Entity | Schema has candidate? | API respects candidate? | UI surfaces candidates? |
|---|---|---|---|
| Memory (ReferenceItem) | Yes (`ReferenceStatus` enum) | Partial (conflict path only) | Partial (inline dialog in chat stream) |
| Tension (ContradictionNode) | No | No — always `open` | No |
| Forecast (Projection) | No | N/A (no detection) | No |
| ProfileArtifact | Yes | Yes (writes `candidate`) | No — never shown |
| DerivationArtifact | Yes | Yes (import path) | No — never shown |

**Most urgent:** `ContradictionNode` missing `candidate` in its status enum (D-01). Without this, the architecture's core property cannot be implemented.

**What is needed:**
- **Schema:** Add `candidate` to `ContradictionStatus` enum
- **API:** Change detection writes to `status: "candidate"`
- **Retrieval:** Exclude `candidate` from injection (this is already implied by the existing open/explored filter in most queries, but needs explicit verification)
- **UI:** Candidate surfacing panel (D-12)

---

### 4.5 Candidate Surfacing Gap

**Current state:** The only candidate surfacing mechanism is the inline yes/no dialog in the chat stream for memory governance conflicts. It works for exactly one case. It is also a UX problem (D-14).

**What the architecture assumes:** A dedicated surface where the user can review pending candidates (tensions, memories, possibly ProfileArtifacts), confirm the ones that seem accurate, and dismiss the ones that don't.

**Minimum viable candidate review surface:**
- A collapsible panel or section in the chat sidebar (where the memory panel already lives)
- Lists pending `candidate` tensions (once D-01 is done) with title, sideA/sideB summary, Confirm / Dismiss buttons
- Lists pending `candidate` ReferenceItems not yet reviewed (once D-02 is done)
- Empty state when there are no candidates

**Routes needed:**
- `GET /api/contradiction?status=candidate` (query by candidate status — already filterable)
- `PATCH /api/contradiction/[id]` to promote `candidate → open` (new transition)
- `DELETE /api/contradiction/[id]` for dismissal of candidates (soft-delete or hard-delete)

**Verdict:** D-12 is blocking D-01 and D-02. Must be built together.

---

### 4.6 Retrieval / Injection Rule Enforcement Gap

**What docs say vs what code does:**

| Rule | Doc says | Code does |
|---|---|---|
| Candidates never injected | Pass 3 OP-2, Pass 4 RT-1 | Correct — detection writes `open`, so technically candidates aren't injected, but only because candidates don't exist yet |
| Memories: relevance-filtered | Pass 4 §1B | Violated — all 50 active memories always injected |
| Tensions: relevance-gated | Pass 4 §1C, R-2 | Violated — top 3 always injected |
| Forecasts: planning-turn only | Pass 4 §1E | N/A — forecasts never injected at all |
| Reviews: rarely injected | Pass 4 §1F | Correct — reviews not injected |

**What enforcement is missing now:**
- Relevance filter for memory injection (D-07)
- Relevance gate for tension injection (D-08)
- Forecast injection on planning turns (D-04)

**What can stay deferred:** Review injection (it's correctly deferred already). Evidence/source injection (rare by design). ProfileArtifact injection (needs D-11 decision first).

**What is dangerous to leave loose:** D-07 (memory injection grows unbounded with usage). D-09 (import creates many `open` tensions that are all injected). These two interact badly — a user who imports ChatGPT history could end up with 20+ tensions and 50 memories all injected into every future chat.

---

### 4.7 Import Flow Mismatch

**Current state:** Import calls `importExtractedConversations` → `detectContradictions` → creates tensions at `status: "open"`. Also calls `processMessageForProfile` per message during import (creating ProfileArtifacts). Also calls memory governance detection per message.

**Architecture says (Pass 3 §1.4):** Sessions and messages are always created. Memories, tensions, and candidates are created at `candidate` status. They are surfaced in the next chat; they do not auto-promote on import.

**Gap:** Every single detection-created entity during import is immediately `open` or `active`. Import is the highest-noise entry point. This is the worst place for silent promotion.

**Minimum fix:** Import-created tensions write `candidate`. Import-created memories (from governance detection) also write `candidate`. After import completes, the summary page links the user to a candidate review surface.

**Verdict:** Depends on D-01 (candidate status schema). High priority because users who import have the worst experience right now.

---

### 4.8 Tension Model Precision Gap

**Current state:** DB model is `ContradictionNode`. UI says "Tension". Both are used throughout the codebase. The schema has `ContradictionType` enum values like `goal_behavior_gap`, `value_conflict`, `belief_conflict`, etc.

**Is this terminology debt or behavioral debt?**

It is primarily terminology debt at the API layer, but the `ContradictionType` enum values are more precise than what users see. Users see tensions labeled by type in list cards (`[goal_behavior_gap]`), which is jargon.

**What should be watched:** The `ContradictionStatus` enum values (`archived_tension`, `open`, `explored`) mix the new terminology with old. `archived_tension` still has "tension" in it, while `open` and `explored` use neutral terms. The status enum needs cleanup when D-01 adds `candidate`.

**Safe to defer?** Yes. Terminology mismatch does not cause behavioral problems. Clean it up when the schema is next touched (D-01).

---

### 4.9 Review vs. Audit Mismatch

**Current state:** DB model is `WeeklyAudit`. UI says "Review." API routes are `/api/audit/weekly/*`. Code, schema, and API all use "audit"; only UI uses "review."

**Is this cosmetic?** Yes. The mismatch causes zero product confusion to users (they never see "audit"). It causes mild developer confusion when reading code. Zero retrieval or behavioral implications.

**Verdict:** Safe to defer indefinitely. Clean up if/when touching the audit API for other reasons.

---

### 4.10 Chat/Product Communication Issues

**Issues that are foundationally blocking:**
- Memory governance dialog in the chat stream (D-14) — this is a structural UX problem, not a design choice to be evaluated later. It actively confuses users.
- No indication to the user that the system is detecting/learning anything — the cognitive machinery is entirely invisible.

**Issues that are later UX/philosophical re-evaluation:**
- How the assistant should reference saved memories ("you told me..." phrasing)
- Whether and how to show the system's reasoning ("I'm noting this as a tension because...")
- The overall chat communication style, tone, and onboarding experience

**Minimum foundational fix:** D-14 (move memory confirmation out of the chat stream). Everything else waits for the UX redesign phase.

---

### 4.11 Guidance / Onboarding Gap

**Is this immediate stabilization debt or later UX work?**

- **Immediate:** Users who complete an import have no guided path to what happened. The import summary shows counts but gives no direction. This is a foundational communication gap, not a design preference.
- **Later:** Full onboarding flow, feature tours, progressive disclosure of cognitive features. These are design-heavy and require the product to be more stable first.

**Minimum foundational guidance needed:**
- Post-import: clear next step ("Here are the tensions we detected — review and confirm"). Links to candidate review surface (D-12).
- Memory panel: a one-line explanation of how memories are created (they currently appear with no provenance explanation).
- Context drawer: a tooltip or help link explaining what "Surfaced tensions" means.

**Verdict:** The post-import guidance is part of the D-09 / D-12 work. The rest waits.

---

### 4.12 Incomplete Product Surfaces

| Surface | Status | Assessment |
|---|---|---|
| **Forecasts domain** | List + detail exist, no actions | Misleading. Implies forecasting system; is a read-only archive. Fix with D-03, D-04, D-15. |
| **"Save evidence" button** | Creates orphaned EvidenceSpan | Misleading. Implies evidence capture; data goes nowhere. Fix with D-05. |
| **"Save reference" (Globe icon)** | Stores URL as type `pattern` | Wrong. Injected as if it were a cognitive pattern. Fix with D-06. |
| **Context drawer (Surfaced tensions)** | Shows top 3 by escalation | Good enough scaffold. The data is real; the label could be clearer. |
| **Memory panel** | Shows active memories, supports deactivate/supersede | Good enough. Could benefit from provenance display. |
| **Import summary** | Shows counts | Good enough scaffold. Needs a post-import candidate review link (D-12 dependency). |
| **ProfileArtifact** | Built silently, never shown | Invisible shadow system. Either wire or remove (D-11). |
| **Candidate review surface** | Does not exist | Entirely missing. Blocks D-01, D-02, D-09 (D-12). |

---

## 5. Gap Analysis: Docs vs. Implementation

### Memory (ReferenceItem)

```
Architecture says:
  - Layer B: "selectively injected, bounded by relevance score and a per-session cap"
  - User-confirmed captures go directly to active
  - Auto-detected memories should be candidate first
  - Source and Memory are distinct (OD-1)

Current implementation does:
  - Injects all 50 active memories every turn, no relevance filter (D-07)
  - Non-conflicting keyword detections create active directly (D-02)
  - Conflicting detections create candidate + inline dialog (partial)
  - URLs stored as type "pattern" (D-06)

Gap:
  - No relevance filtering on injection
  - Non-conflicting auto-detection bypasses confirmation
  - No Source type distinction

Stabilization action:
  - D-02: Change non-conflicting auto-detection to candidate
  - D-06: Add source type, filter from memory injection
  - D-07: Add relevance filter to memory injection
```

---

### Source

```
Architecture says:
  - Source is a distinct entity type (OD-1)
  - Lower authority than user self-report in the priority hierarchy
  - Should not be injected as Memory

Current implementation does:
  - Sources stored as ReferenceItem with type "pattern"
  - Injected identically to user-stated memories
  - No conceptual distinction in schema

Gap:
  - Critical mismatch: external attributions treated as user beliefs

Stabilization action:
  - D-06 (interim): add source type, filter from memory injection
  - OD-1 (deferred): full schema split
```

---

### Evidence

```
Architecture says:
  - Layer D: "retrieved when the assistant is about to make a grounded claim"
  - Evidence grounds the system's confidence
  - User captures link to specific tensions

Current implementation does:
  - EvidenceSpan: general, message-position based, captured via chat button
  - ContradictionEvidence: tension-specific, added via tension detail page
  - Chat capture creates EvidenceSpan with no tension link (D-05)
  - Neither type is queried or injected into the model prompt

Gap:
  - Evidence has zero influence on the model's cognition
  - Capture flow is broken (orphaned spans)

Stabilization action:
  - D-05: Add tension-linking step to evidence capture
  - Defer: unified evidence retrieval injection (Layer D)
```

---

### Tension (ContradictionNode)

```
Architecture says:
  - Detection creates candidate status
  - User confirms → open
  - User confirmation required before injection into prompt

Current implementation does:
  - Detection creates open (D-01)
  - Import detection also creates open (D-09)
  - All open/escalated tensions injected every turn (D-08)
  - No candidate status in schema

Gap:
  - Most fundamental architecture rule violated
  - No candidate → open promotion flow exists

Stabilization action:
  - D-01: Add candidate to ContradictionStatus, change detection writes
  - D-09: Fix import to write candidate
  - D-12: Build candidate review surface
  - D-08: Add relevance gate to injection
```

---

### Forecast (Projection)

```
Architecture says:
  - Layer E: retrieved on planning/future-oriented turns
  - Has status lifecycle (candidate | active | archived)
  - User captures go directly to active

Current implementation does:
  - No status field on Projection model (D-03)
  - Never injected into model prompt (D-04)
  - No delete/archive from UI (D-15)
  - Projections page still says "projection" in empty state (D-13)

Gap:
  - Forecasts have zero cognitive influence
  - No lifecycle management
  - UI is a misleading placeholder

Stabilization action:
  - D-03: Add status field to Projection
  - D-04: Add forecast injection on planning turns
  - D-15: Add delete/archive actions
  - D-13: Fix terminology
```

---

### Review (WeeklyAudit)

```
Architecture says:
  - Layer F: retrieved on explicit reflection; almost never injected
  - Trailing indicator, not real-time state
  - Locked reviews are immutable

Current implementation does:
  - Not injected (correct)
  - Draft/locked lifecycle implemented (correct)
  - Backfill, compare, explain all complete (correct)

Gap:
  - None significant. This is one of the most complete entities.

Stabilization action:
  - None required
```

---

### Candidate Lifecycle

```
Architecture says:
  - All detection output → candidate
  - User confirms → active/open
  - Candidates never injected into prompt
  - Candidate surfacing UI shows pending items

Current implementation does:
  - ReferenceItem: partial (conflict path only)
  - ContradictionNode: none
  - Projection: none
  - ProfileArtifact: full on backend, zero UI surfacing
  - No candidate review surface for any entity type

Gap:
  - Fundamental architecture property does not exist in product

Stabilization action:
  - D-01, D-02, D-03, D-09, D-12 together constitute the candidate lifecycle
```

---

### Retrieval / Surfacing

```
Architecture says:
  - Memory: relevance-filtered, capped
  - Tensions: relevance-gated, selective
  - Forecasts: planning turns only
  - Reviews: rare, on demand only
  - Candidates: never injected

Current implementation does:
  - Memory: all 50, always (D-07)
  - Tensions: top 3, always (D-08)
  - Forecasts: never
  - Reviews: never (correct)
  - Candidates: technically not injected but only because candidate doesn't exist

Gap:
  - Two active injection rules violated
  - One layer (Forecasts) has zero connection to the model

Stabilization action:
  - D-07, D-08, D-04 (in order of importance after schema fixes)
```

---

### Import

```
Architecture says:
  - Sessions and messages always created
  - Detected tensions and memories → candidate status
  - Surfaced in next chat for user review

Current implementation does:
  - Sessions and messages always created (correct)
  - Detected tensions → open (D-09)
  - Detected memories → active for simple cases (follows from D-02)
  - No post-import candidate review

Gap:
  - Import is the highest-noise entry point with the least user confirmation

Stabilization action:
  - D-09 (follows from D-01)
  - Post-import guidance pointing to candidate review (D-12)
```

---

### Chat Capture Surfaces

```
Architecture says:
  - "Save memory" → creates active ReferenceItem (correct for explicit capture)
  - "Mark as evidence" → creates EvidenceSpan + links to tension
  - "Save forecast" → creates active Projection (correct for explicit capture)

Current implementation does:
  - "Save memory" → creates active ReferenceItem (correct)
  - "Save evidence" → creates EvidenceSpan with no tension link (D-05)
  - "Save reference" → creates ReferenceItem as type "pattern" (D-06)
  - "Save forecast" → creates Projection with no status (D-03)

Gap:
  - Evidence and reference capture flows are both wrong
  - Forecast capture creates a dead-end entity

Stabilization action:
  - D-05, D-06, D-03 (minimum)
```

---

## 6. Minimum Stabilization Boundary

The following is the smallest set of fixes that would make the product's foundation coherent — not perfect, but no longer structurally self-contradictory.

### The Minimum Set

1. **D-01 + D-09 + D-12 (together):** Add `candidate` to `ContradictionStatus`, change detection writes, and build the candidate review surface. These three are inseparable — adding candidate status without surfacing it is meaningless.

2. **D-03 + D-15:** Add `status` field to `Projection` and add delete action to Forecast detail page. Forecasts are currently a misleading product surface.

3. **D-06:** Add `source` to `ReferenceType` and filter sources from the memory injection block. URLs stored as cognitive patterns is a correctness bug.

4. **D-14:** Move memory governance confirmation out of the chat stream. This is the most user-visible structural problem.

5. **D-05:** Add tension-linking step to evidence capture. "Save evidence" currently does nothing useful.

### What this achieves:
- Tensions detected by the system require user confirmation before they become active cognitive state
- The assistant is not silently accumulating unconfirmed tensions in the prompt
- Forecasts can be managed and (after D-04) influence the assistant
- Evidence capture creates useful, linked data
- External sources are not mistakenly treated as user beliefs
- Memory confirmation does not interrupt the conversation

### What this explicitly does NOT require (yet):
- Relevance filtering for memory/tension injection (D-07, D-08) — valuable but not structurally misleading
- Forecast injection (D-04) — depends on D-03 and is a quality improvement, not a correctness fix
- ProfileArtifact wiring or removal (D-11) — can stay deferred
- Full OD-1 Memory/Source split — D-06 interim fix is sufficient

---

## 7. Prioritized Phases

### Phase 1 — Critical Structural Fixes
_These are the items that make the foundation actively wrong. Fix these first._

| ID | Item | Dependency |
|---|---|---|
| D-01 | Add `candidate` to ContradictionStatus; change detection writes | None |
| D-12 | Build candidate review surface (tension + memory candidates) | D-01 |
| D-09 | Import creates tensions at `candidate` | D-01, D-12 |
| D-06 | Add `source` type to ReferenceType; filter from memory injection | None |
| D-14 | Move memory governance confirmation out of chat stream | D-12 |

### Phase 2 — Candidate / Lifecycle Completion
_Makes the architecture real in product behavior._

| ID | Item | Dependency |
|---|---|---|
| D-02 | Non-conflicting memory detection creates `candidate` | D-12 |
| D-03 | Add `status` field to Projection | None |
| D-05 | Add tension-linking step to evidence capture | D-01 |
| D-15 | Add delete/archive actions to Forecast detail page | D-03 |
| D-13 | Fix "projection" terminology in empty state | None |

### Phase 3 — Legibility and Product Truthfulness Fixes
_Reduces the gap between what the product implies and what it can do._

| ID | Item | Dependency |
|---|---|---|
| D-04 | Inject forecasts on planning-oriented turns | D-03 |
| D-07 | Add relevance filter to memory injection | None |
| D-08 | Add relevance gate to tension injection | None |
| D-10 | Replace internal rung names in prompt with human-readable guidance | None |
| D-11 | Decide: wire ProfileArtifact to injection or remove | D-12 optional |

### Phase 4 — Deferred Items
_These require the deeper philosophical/product re-evaluation to resolve properly._

| ID | Item | Why deferred |
|---|---|---|
| OD-1 | Full Memory/Source schema split | Interim D-06 fix is sufficient; full split requires UX design |
| OD-2 | Unified evidence model | Complex schema migration; functional with D-05 interim |
| D-11 (if wiring) | Full ProfileArtifact surfacing UI | Requires UX design decisions |
| Onboarding flow | Guided first experience | Requires stable foundation + design work |
| Chat communication style | How assistant references memory/tensions | Philosophical/UX re-evaluation phase |
| Probe ladder UX | Surface rung guidance meaningfully | Requires user-visible escalation design |
| Forecast retrospective | "Was this right?" evaluation | Future product feature |
| Standard/Deep semantics | Full retrieval mode design | Build on stable retrieval foundation |

---

## 8. What Should Explicitly Wait

Do not do any of the following during the stabilization pass:

- **Deep philosophical re-evaluation of the cognitive model.** Passes 1–4 are the architecture. Implement them. Re-evaluate after implementation.
- **Major UX redesign.** Fix D-14 (move confirmation out of stream) structurally. Do not redesign the whole chat experience.
- **Final chat communication style design.** How the assistant references memories, how it surfaces tensions in responses, how it communicates uncertainty — all of this requires a stable foundation and design iteration.
- **Full onboarding flow.** Post-import guidance (D-12 dependency) is part of Phase 1. A full first-use experience is Phase 4+.
- **Performance optimization.** Retrieval latency, prompt token costs, query optimization — wait until the retrieval logic is correct before optimizing it.
- **Standard/Deep mode final semantics.** The current implementation works. Do not redesign the mode system during stabilization.
- **Advanced forecasting engine.** Horizon tracking, retrospective evaluation, prediction accuracy metrics — all future product features.
- **Autonomous reasoning features.** The system should not make new decisions autonomously. Stabilize the human-in-the-loop model first.
- **Full OD-1 Memory/Source schema split.** The D-06 interim fix is sufficient. The full split is design-heavy.
- **Evidence model unification.** D-05 interim fix (add linking step) is sufficient for Phase 1/2.

---

## 9. Recommended First Implementation Packet

**Recommended: Candidate Lifecycle Foundation (D-01 + D-12 + D-09)**

This is the single best first packet because:

1. It fixes the most fundamental architectural violation (D-01 — tensions go directly to `open`).
2. It builds the candidate review surface (D-12) that is required for D-01 to be user-accessible.
3. It fixes import (D-09) which is the highest-impact entry point for bad data.
4. It unblocks D-02, D-05, and D-14 — all of which require a candidate surfacing destination.
5. It completes the single most important property of the architecture: "no silent promotion."

**Concrete scope for this packet:**

- **Schema:** Add `candidate` to `ContradictionStatus` enum. Migration required.
- **Backend:** Change `contradictionNode.create` in message route from `status: "open"` to `status: "candidate"`.
- **Backend:** Change import-created tensions from `status: "open"` to `status: "candidate"`.
- **Backend:** Add `PATCH /api/contradiction/[id]` transition: `candidate → open` (promote). Add `DELETE /api/contradiction/[id]` for candidates (dismiss).
- **UI:** Build a candidate review panel in the chat sidebar (or as a standalone page at `/tensions/candidates`). Lists `candidate` tensions with title, sideA/sideB summary, Confirm and Dismiss buttons.
- **UI:** After import completes, show a count of pending candidate tensions with a link to the candidate review panel.

**Rough scope:** 1–2 sessions. Backend is ~3 files. UI is 1 new component + 1 minor API change.

**Alternative first packet if candidate lifecycle feels too large:** `D-06 + D-03 + D-15` — the "honest product" trio. This fixes the URL-as-pattern bug, adds a status field to Forecasts, and adds delete/archive to the Forecast UI. Lower architectural impact but visibly corrects misleading product surfaces. Recommended only if the team wants quick wins before tackling the candidate lifecycle.

---

## 10. No Broad Code Changes

This pass is documentation and analysis only. No files were modified. No migrations were run.

---

## 11. Deliverable Summary

### File Created

`docs/foundation-stabilization-pass.md`

---

### Stabilization Categories

| Category | Description |
|---|---|
| A — Schema | Missing lifecycle fields (Tension candidate, Forecast status, Source type) |
| B — Backend flow | Wrong status writes (detection → `open` not `candidate`; import same) |
| C — Retrieval/surfacing | Memory injected without relevance filter; tensions always injected; forecasts never injected |
| D — UI/product behavior | Missing actions (Forecast delete), broken flows (evidence orphaned), invisible systems (ProfileArtifact) |
| E — UX/legibility | Memory dialog hijacks chat stream; internal rung names in prompt |
| F — Terminology | "projection" in empty state copy |

---

### Top Critical Debt Items

| ID | Title | Priority |
|---|---|---|
| D-01 | Tension detection writes `open` instead of `candidate` | Critical |
| D-09 | Import creates tensions at `open`, bypassing candidate model | Critical |
| D-12 | No candidate surfacing UI for tensions | Critical |
| D-14 | Memory governance hijacks chat stream with inline dialogs | High |
| D-06 | URLs stored as type `pattern`, injected as cognitive memories | High |
| D-05 | Evidence capture creates orphaned spans with no tension link | High |
| D-02 | Non-conflicting memory auto-creation skips confirmation | High |
| D-03 | Forecast has no status lifecycle | High |

---

### Minimum Stabilization Boundary

Five items: D-01 + D-09 + D-12 (together) · D-06 · D-14 · D-03 + D-15 · D-05.
After these, the product no longer actively violates its own architecture or misleads users about its capabilities.

---

### Recommended First Implementation Packet

**Candidate Lifecycle Foundation: D-01 + D-12 + D-09**

Schema change (add `candidate` to `ContradictionStatus`) + detection writes changed + import writes changed + candidate review UI panel + post-import link to candidates.

This completes the architecture's most fundamental property — no silent promotion — and unblocks all subsequent candidate lifecycle work.

---

### Code Changes

None. Documentation-only pass.
