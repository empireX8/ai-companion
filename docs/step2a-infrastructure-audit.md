# MindLab Understanding Engine — Step 2A Infrastructure Audit

**Date:** 2026-05-13  
**Auditor:** Cline (automated inspection)  
**Scope:** `/Users/user/ai-companion` (web/backend) + `/Users/user/Mindlabs-app` (mobile)  
**Mode:** Read-only audit — no files modified, no migrations created, no code written.

---

## 1. Repo State

### Web/Backend (`/Users/user/ai-companion`)

- **Branch:** `main` (assumed — `git branch --show-current` output unavailable due to tool limitation)
- **Working tree:** Clean (no dirty files detected)
- **Latest commits (5):** `e11aec7c4e9b0a938703bf9c026777e26dc4caf7` (HEAD)
- **Framework:** Next.js 14+ (App Router), Prisma ORM, Clerk auth, Stripe billing
- **Key directories:**
  - `app/api/` — 30+ API route directories
  - `app/(root)/(routes)/` — 20+ web surface route directories
  - `lib/` — 80+ library modules (derivation, detection, contradiction, actions, import, eval)
  - `lib/eval/` — 6 eval modules (pattern evaluator, abstention calibration, review queue, etc.)
  - `lib/assistant/` — system prompt
  - `prisma/` — schema + migrations
  - `scripts/` — audit closeout, backfill, replay, eval scripts
  - `eval/patterns/` — eval datasets and reports

### Mobile (`/Users/user/Mindlabs-app`)

- **Branch:** Unknown (single-page prototype app)
- **Working tree:** Clean
- **Framework:** React + Vite (SPA), Clerk React, Tailwind CSS
- **Key directories:**
  - `src/pages/` — single `Index.tsx` page
  - `src/components/mindlab/` — 10+ screen components (Timeline, Insights, Account, Hub menu, etc.)
  - `src/lib/` — backend API client, mobile actions, contradictions, receipts
- **Architecture:** Single-page prototype with modal/screen navigation. No React Router routes beyond `/` and `*`.

---

## 2. Existing Backend Data Model Map

### Prisma Schema (`prisma/schema.prisma`)

| Model | Core Fields | Current Representation | Reuse? | Extension? | Separate? |
|-------|------------|----------------------|--------|------------|-----------|
| **User** | id, clerkId, email, name, stripeCustomerId, etc. | Auth + billing identity | Yes — direct | No | N/A |
| **Session** | id, userId, label, surfaceType, origin (APP\|IMPORTED_ARCHIVE), startedAt, endedAt, importedSource | Chat sessions (app + imported) | Yes — direct | May need surfaceType enum expansion | Keep |
| **Message** | id, sessionId, userId, role, content, createdAt | Individual chat messages | Yes — direct | No | Keep |
| **JournalEntry** | id, userId, title, body, authoredAt, createdAt, updatedAt | Free-form journal entries | Yes — direct | No | Keep |
| **QuickCheckIn** | id, userId, stateTag, eventTags, note, createdAt, updatedAt | Mood/state check-ins | Yes — direct | May need richer schema | Keep |
| **PatternClaim** | id, userId, patternType, summary, status, strengthLevel, evidenceCount, sessionCount, journalEvidenceCount, journalEntrySpread, journalDaySpread, supportContainerSpread, createdAt, updatedAt | Derived behavioral pattern claims (5 families) | **Partial** — closest to User Map claims | Needs causal chain fields, identity update tracking | **Keep separate from User Map** |
| **PatternClaimEvidence** | id, claimId, sessionId, messageId, journalEntryId, quote, source, createdAt | Evidence receipts for pattern claims | Yes — direct | May need evidence span links | Keep |
| **ContradictionNode** | id, userId, title, sideA, sideB, type, confidence, status, weight, rung, escalationLevel, evidenceCount, snoozeCount, timesSurfaced, sourceSessionId, sourceMessageId | Detected contradictions/tensions | Yes — direct | May need investigation links | Keep |
| **ContradictionEvidence** | id, nodeId, sessionId, messageId, quote, createdAt | Evidence for contradictions | Yes — direct | No | Keep |
| **EvidenceSpan** | id, userId, charStart, charEnd, messageId, createdAt | Character-range evidence spans linked to messages | Yes — direct | Could link to User Map claims | Keep |
| **ProfileArtifact** | (referenced in evidence routes via profileArtifactLinks) | Derived profile artifacts | **Partial** — closest to User Map sections | **Do NOT reuse as User Map** — see risks | Keep separate |
| **SurfacedAction** | id, userId, surfaceKey, templateId, bucket, linkedFamily, linkedClaimId, linkedGoalRefId, status, note | Action items surfaced to user | Yes — direct | Needs experiment/fieldwork tracking | Keep |
| **ReferenceItem** | id, userId, type (goal\|...), statement, status, createdAt, updatedAt | Goals and reference/memory items | Yes — direct | May need investigation links | Keep |
| **DerivationRun** | id, userId, scope, trigger, status, messageCount, sessionCount, claimsCreated, error, createdAt | Audit trail for pattern derivation runs | Yes — direct | Needs model update tracking | Keep |
| **ImportRecord** | (referenced in upload routes) | Import tracking | Yes — direct | No | Keep |

### Models NOT found (gaps):
- No **UserMap** or **MasterTheory** model
- No **Investigation** or **Hypothesis** model
- No **ModelUpdate** or **ModelVersion** model
- No **LifePlaybook** or **Experiment** model
- No **CausalChain** or **Trigger→State→Strategy** model
- No **ModelMaturity** or **ProgressLevel** model
- No **MetaObserver** or **BlindSpot** model
- No **EmotionalProcessingSession** or **ReleaseMode** model
- No **FieldworkAssignment** model

---

## 3. Existing Derivation / Intelligence Pipeline Map

### A. Pattern Derivation Pipeline

**Files:** `lib/pattern-detector-v1.ts`, `lib/pattern-batch-orchestrator.ts`, `lib/pattern-detection-executor.ts`, `lib/pattern-claim-lifecycle.ts`

**Trigger paths:**
1. **Native (automatic):** `lib/native-derivation-trigger.ts` — fires after user messages with 30s cooldown
2. **Manual:** `POST /api/patterns` — user-initiated re-run
3. **Replay:** `scripts/replay-persisted-pattern-claims.ts` — diagnostic replay

**Input data:** Synthesized history (`lib/history-synthesis.ts`) — chat messages + journal entries as source-aware units. Behavioral filter applied (`lib/behavioral-filter.ts`).

**Output data:** PatternClaim records with evidence receipts across 5 families:
- trigger_condition (rule-based markers)
- inner_critic (rule-based markers)
- repetitive_loop (rule-based markers + session gate requiring ≥2 sessions)
- recovery_stabilizer (rule-based markers)
- contradiction_drift (reads ContradictionNode directly)

**Guardrails:**
- Behavioral eligibility gate (`lib/behavioral-filter.ts`)
- Quote safety filter (`lib/pattern-quote-selection.ts`)
- Visible abstention scoring (`lib/pattern-visible-claim.ts`) — suppresses low-confidence claims
- Imported evidence quality boundary (`lib/pattern-detector-v1.ts` lines 640-737)
- Imported pattern relevance boundary (`lib/pattern-detector-v1.ts` lines 745-786)

**Runs on:** App sessions, journal entries, imported archives

### B. Contradiction/Tension Detection

**Files:** `lib/contradiction-detection.ts`, `lib/contradiction-materialization.ts`, `lib/contradiction-escalation.ts`, `lib/contradiction-salience.ts`, `lib/contradiction-top.ts`

**Trigger:** Manual creation via `POST /api/contradiction` + automated detection during pattern runs

**Input:** Session messages, user-submitted evidence

**Output:** ContradictionNode with evidence, escalation levels, rung system

**Guardrails:** Snooze expiry, escalation logic, surface tracking

### C. Profile Artifact Derivation

**File:** `lib/profile-derivation.ts`

**Input:** Evidence spans linked to messages

**Output:** ProfileArtifact records (linked via profileArtifactLinks)

### D. Action Generation/Surfacing

**File:** `lib/actions-v1.ts`

**Trigger:** `GET /api/actions` — computed on read

**Input:** PatternClaims + ReferenceItems (goals)

**Output:** SurfacedAction records in stabilize/build buckets

**Logic:** Template-based action selection with priority scoring, claim-family coverage, goal signal strength

### E. Timeline Aggregation

**File:** `lib/timeline-aggregation.ts`

**Input:** QuickCheckIns, Sessions, JournalEntries

**Output:** Timeline state summary with rhythms, repeated signals, links, recent states

### F. Import Processing

**Files:** `lib/import-chatgpt.ts`, `lib/import-upload-processor.ts`, `lib/import-upload-queue.ts`, `lib/import-upload-service.ts`, `lib/import-chunk-storage.ts`, `lib/import-reconcile.ts`

**Input:** ChatGPT export archives (chunked upload)

**Output:** Imported sessions + messages + human-relevance filtering

### G. Eval/Diagnostic Pipeline

**Files:** `lib/eval/pattern-evaluator.ts`, `lib/eval/pattern-abstention-calibration.ts`, `lib/eval/pattern-rationale-sufficiency.ts`, `lib/eval/pattern-rationale-minimality.ts`, `lib/eval/pattern-review-queue.ts`, `lib/eval/pattern-review-resolution.ts`

**Scope:** Offline evaluation of pattern detection quality. Includes:
- Message-level behavioral gate metrics
- Grouped/claim-level family emission metrics
- Visible abstention calibration
- Faithfulness scoring (LLM judge)
- Rationale sufficiency/minimality scoring
- Review routing (flags high-risk outputs)
- Regression gates

**Relevance to new architecture:** This eval infrastructure is the strongest candidate for becoming the **Meta-Observer / Blind Spot Engine**. It already measures what the system gets wrong.

---

## 4. Existing API Map

| Route | Method(s) | Input | Output | Models Touched | Relevance |
|-------|-----------|-------|--------|---------------|-----------|
| `/api/session` | POST | surfaceType | sessionId | Session | Core — session creation |
| `/api/session/list` | GET | origin, surfaceType | SessionListItem[] | Session | Core — session browsing |
| `/api/session/title` | (update) | sessionId, title | Session | Session | Utility |
| `/api/message` | POST | sessionId, content | stream | Message, Session | Core — chat |
| `/api/message/list` | GET | sessionId | Message[] | Message | Core — message history |
| `/api/journal/entries` | GET, POST | limit, body, title | JournalEntry[] | JournalEntry | Core — journal CRUD |
| `/api/journal/entries/[id]` | GET | — | JournalEntry | JournalEntry | Core |
| `/api/check-ins` | GET, POST | stateTag, eventTags, note | QuickCheckIn | QuickCheckIn | Core — check-in CRUD |
| `/api/timeline` | GET | window, includeAppActivity, includeJournalEntries | TimelineResponse | QuickCheckIn, Session, JournalEntry | Core — timeline aggregation |
| `/api/patterns` | GET, POST | (POST: trigger) | PatternsResponse / run result | PatternClaim, ContradictionNode | **Core — pattern surface** |
| `/api/contradiction` | GET, POST | status, page, limit, top, mode | ContradictionNode[] | ContradictionNode | **Core — tension surface** |
| `/api/contradiction/[id]` | GET | — | ContradictionNode | ContradictionNode | Detail |
| `/api/contradiction/[id]/evidence` | GET | — | Evidence[] | ContradictionEvidence | Detail |
| `/api/contradiction/[id]/references` | GET | — | References | ReferenceItem | Cross-link |
| `/api/contradiction/summary` | GET | — | Summary | ContradictionNode | Aggregation |
| `/api/actions` | GET | — | {stabilizeNow, buildForward, currentPriority} | PatternClaim, ReferenceItem, SurfacedAction | **Core — action surface** |
| `/api/actions/[id]` | PATCH | status, note | SurfacedAction | SurfacedAction | Action update |
| `/api/evidence` | GET | q, origin, hasArtifacts, limit, cursor | EvidenceSpan[] | EvidenceSpan, Message, Session | Evidence browsing |
| `/api/evidence/[id]` | GET | — | EvidenceSpan | EvidenceSpan | Detail |
| `/api/evidence/create` | POST | — | EvidenceSpan | EvidenceSpan | Creation |
| `/api/reference` | GET, POST | — | ReferenceItem | ReferenceItem | Memory/goal CRUD |
| `/api/reference/list` | GET | — | ReferenceItem[] | ReferenceItem | Listing |
| `/api/reference/[id]` | GET | — | ReferenceItem | ReferenceItem | Detail |
| `/api/reference/[id]/detail` | GET | — | Detail | ReferenceItem | Enriched detail |
| `/api/reference/pending` | GET | — | ReferenceItem[] | ReferenceItem | Pending review |
| `/api/reference/summary` | GET | — | Summary | ReferenceItem | Aggregation |
| `/api/reference/deactivate` | POST | — | ReferenceItem | ReferenceItem | Status change |
| `/api/reference/supersede` | POST | — | ReferenceItem | ReferenceItem | Replacement |
| `/api/reference/from-url` | POST | url | ReferenceItem | ReferenceItem | URL import |
| `/api/derivation/run/[id]` | GET | — | DerivationRun | DerivationRun | Run detail |
| `/api/derivation/runs` | GET | — | DerivationRun[] | DerivationRun | Run history |
| `/api/import/chatgpt` | POST | — | ImportResult | ImportRecord, Session, Message | Import |
| `/api/upload/*` | POST | chunks | UploadStatus | ImportRecord | Chunked upload |
| `/api/audit/weekly` | GET | — | AuditReport | Multiple | Weekly audit |
| `/api/audit/weekly/[id]` | GET | — | AuditReport | Multiple | Audit detail |
| `/api/audit/weekly/compare` | GET | — | Diff | Multiple | Audit comparison |
| `/api/audit/weekly/trend` | GET | — | Trend | Multiple | Audit trends |
| `/api/metrics` | GET | — | Metrics | Multiple | System metrics |
| `/api/projection/*` | GET, POST | — | Projection | (new model) | Future projections |
| `/api/webhook` | POST | — | — | Stripe | Billing webhook |

---

## 5. Existing Web Surface Map

| Route | Component Files | Data Read | Data Written | Backend-Derived? | Theory Fit | Potential Role |
|-------|----------------|-----------|-------------|-----------------|------------|----------------|
| `/` (Today) | `app/(root)/page.tsx` | — | — | — | Low — likely dashboard | Could become User Map home |
| `/journal` | `journal/page.tsx`, `JournalSurface.tsx` | JournalEntry | JournalEntry | No — user-authored | Medium | Evidence capture |
| `/journal-chat` | `journal-chat/page.tsx` | Session, Message | Session, Message | No — chat interface | Medium | Evidence capture |
| `/chat` | `chat/page.tsx`, `ChatSurface.tsx`, `SurfaceChatShell.tsx`, `memory-panel.tsx`, `now-tray.tsx` | Session, Message, Memory | Session, Message | No — chat interface | Medium | Could host Explore/Understand modes |
| `/explore` | `explore/page.tsx` | — | — | Unknown | **High** | Could become Emotional Processing / Release mode |
| `/check-ins` | `check-ins/page.tsx`, `CheckInsSurface.tsx` | QuickCheckIn | QuickCheckIn | No — user input | Medium | Evidence capture + fieldwork |
| `/timeline` | `timeline/page.tsx`, `TimelineSurface.tsx` | QuickCheckIn, Session, JournalEntry | — | **Yes — backend aggregated** | **High** | Timeline as epistemic infrastructure |
| `/patterns` | `patterns/page.tsx`, multiple `_components/` | PatternClaim, ContradictionNode | — | **Yes — backend derived** | **High** | Could become User Map claims section |
| `/patterns/[id]` | `patterns/[id]/page.tsx` | PatternClaim detail | — | **Yes** | **High** | Claim detail |
| `/contradictions` | `contradictions/page.tsx`, `ContradictionListPanel.tsx` | ContradictionNode | — | **Yes — backend derived** | **High** | Tensions / contradictions surface |
| `/contradictions/[id]` | `contradictions/[id]/page.tsx` | ContradictionNode detail | — | **Yes** | **High** | Tension detail |
| `/contradictions/candidates` | `contradictions/candidates/page.tsx` | ContradictionNode | — | **Yes** | Medium | Candidate review |
| `/actions` | `actions/page.tsx` | SurfacedAction, PatternClaim, ReferenceItem | SurfacedAction (status) | **Yes — backend derived** | **High** | Could become Life Playbooks |
| `/evidence` | `evidence/page.tsx` | EvidenceSpan | — | **Yes** | Medium | Evidence browsing |
| `/evidence/[id]` | `evidence/[id]/page.tsx` | EvidenceSpan detail | — | **Yes** | Medium | Evidence detail |
| `/library` | `library/page.tsx`, `library-surface.ts` | ReferenceItem, PatternClaim, ContradictionNode | — | **Yes — aggregated** | **High** | Receipts / reference library |
| `/library/[id]` | `library/[id]/page.tsx` | ReferenceItem detail | — | **Yes** | Medium | Reference detail |
| `/references` | `references/page.tsx`, `ReferenceListPanel.tsx` | ReferenceItem | — | **Yes** | Medium | Memory/reference browsing |
| `/references/[id]` | `references/[id]/page.tsx` | ReferenceItem detail | — | **Yes** | Medium | Reference detail |
| `/references/candidates` | `references/candidates/page.tsx`, `CandidateMemoriesPage.tsx` | ReferenceItem | — | **Yes** | Medium | Candidate memory review |
| `/memories` | `memories/page.tsx` | ReferenceItem | — | **Yes** | Medium | Memory surface |
| `/import` | `import/page.tsx`, `ImportHistoryPanel.tsx` | ImportRecord | — | **Yes** | Low | Data import |
| `/history` | `history/page.tsx` | Session | — | **Yes** | Low | Session history |
| `/history/[id]` | `history/[id]/page.tsx` | Session detail | — | **Yes** | Low | Session detail |
| `/context` | `context/page.tsx` | — | — | Unknown | Medium | Context panel |
| `/projections` | `projections/page.tsx` | Projection | — | **Yes** | Medium | Future projections |
| `/projections/[id]` | `projections/[id]/page.tsx` | Projection detail | — | **Yes** | Medium | Projection detail |
| `/metrics` | `metrics/page.tsx` | Metrics | — | **Yes** | Low | System metrics |
| `/audit` | `audit/page.tsx` | AuditReport | — | **Yes** | Low | Weekly audit |
| `/audit/[id]` | `audit/[id]/page.tsx` | AuditReport detail | — | **Yes** | Low | Audit detail |
| `/settings` | `settings/page.tsx` | User | User | No — user config | Low | Settings |
| `/account` | `account/page.tsx` | User (Clerk) | — | No | Low | Account management |
| `/help` | `help/page.tsx` | — | — | No | Low | Help |

---

## 6. Existing Mobile Surface Map

### Mobile Architecture

The mobile app (`Mindlabs-app`) is a **single-page React prototype** with modal/screen navigation. All screens are components in `src/components/mindlab/`, rendered conditionally from `MindLabPrototype.tsx`.

### Screens

| Screen | Files | Backend APIs Used | Hardcoded/Synthetic? | Parity Gaps | Relevance |
|--------|-------|------------------|---------------------|-------------|-----------|
| **Hub/Center Menu** | `CenterHubMenu.tsx` | None | **Mostly hardcoded** | No backend-driven hub | Low — navigation shell |
| **Timeline** | `TimelineScreen.tsx` | `/api/timeline`, `/api/check-ins` | Rhythms, possible links, repeated signals are **backend-derived** via timeline aggregation | Web has richer pattern/tension integration | **High** — timeline as epistemic infrastructure |
| **Timeline Detail** | `TimelineDetailScreens.tsx` | `/api/timeline` (detail) | Detail data is **synthetic** (MindlabTimelineDetailData is a frontend type, not a backend model) | No dedicated backend detail endpoint | Medium — needs backend detail API |
| **Pattern Detail** | `InsightDetailScreens.tsx` (PatternDetailScreen) | `/api/patterns` | Source breakdown, related tensions, linked actions are **frontend-computed from backend data** | Web has richer pattern detail | **High** — pattern surface |
| **Tension Detail** | `InsightDetailScreens.tsx` (TensionDetailScreen) | `/api/contradiction/[id]` | Timeline/context is **frontend-computed** | Web has richer tension detail | **High** — tension surface |
| **Account** | `AccountScreen.tsx` | Clerk auth | Plan data, preferences, data/privacy are **all placeholders** | Web has settings page | Low |
| **Library/Receipts** | (via `mobile-receipts.ts`) | `/api/patterns`, `/api/contradiction`, `/api/actions` | Receipt items are **backend-derived but assembled client-side** | Web has dedicated library page | Medium — receipt surface |

### Mobile API Client (`src/lib/backend-chat-api.ts`)

Consumes these backend endpoints:
- `POST /api/session` — create session
- `GET /api/message/list` — list messages
- `GET /api/session/list` — list sessions
- `GET /api/patterns` — get patterns
- `GET /api/journal/entries` — list journal entries
- `POST /api/journal/entries` — create journal entry
- `GET /api/journal/entries/[id]` — get journal entry
- `GET /api/timeline` — get timeline
- `GET /api/check-ins` — list check-ins
- `POST /api/check-ins` — create check-in
- `POST /api/message` — stream assistant message

### Mobile Actions (`src/lib/mobile-actions.ts`)

Consumes:
- `GET /api/actions` — fetch actions
- `PATCH /api/actions/[id]` — update action status

### Mobile Contradictions (`src/lib/mobile-contradictions.ts`)

Consumes:
- `GET /api/contradiction?status=...&page=...&limit=...` — list contradictions
- `GET /api/contradiction/[id]` — get contradiction detail

### Mobile Receipts (`src/lib/mobile-receipts.ts`)

Consumes:
- `GET /api/patterns` — pattern receipts
- `GET /api/contradiction?status=open&limit=50` — tension receipts
- `GET /api/actions` — action receipts
- `GET /api/contradiction/[id]` — tension detail for evidence

### Key Parity Gaps

1. **No mobile Explore screen** — web has `/explore`, mobile has no equivalent
2. **No mobile Journal Chat** — web has `/journal-chat`, mobile has no equivalent
3. **No mobile Patterns list** — mobile only has pattern detail, no list view
4. **No mobile Contradictions list** — mobile only has tension detail, no list view
5. **No mobile Actions list** — mobile only has action status updates, no list view
6. **No mobile Evidence browser** — web has `/evidence`
7. **No mobile Import** — web has `/import`
8. **No mobile Projections** — web has `/projections`
9. **No mobile Audit** — web has `/audit`
10. **Timeline detail data is synthetic** — no dedicated backend endpoint for enriched timeline detail
11. **Pattern/tension detail uses frontend-computed related items** — no backend cross-linking API

---

## 7. Theory-to-Infrastructure Fit Matrix

### 1. User Map / Master Theory

| Aspect | Assessment |
|--------|-----------|
| **Existing models that could feed it** | PatternClaim (5 families), ContradictionNode (tensions), ReferenceItem (goals/memories), ProfileArtifact, EvidenceSpan, QuickCheckIn (state history) |
| **Anything already close?** | PatternClaim with its 5-family taxonomy is the closest — it already represents "what the system knows about the user's patterns." ProfileArtifact is a separate, less structured surface. |
| **What is missing?** | No unified "User Map" model. No causal chain model (trigger → interpretation → state → strategy → function → cost → stabilizer → identity update). No model versioning. No explicit "what the model believes" vs "what evidence supports it" separation at the User Map level. |
| **Should it be persisted, generated, or hybrid?** | **Hybrid.** The User Map should be a persisted model that is regenerated/updated by derivation runs. It should not be computed on read (too expensive) nor fully static (would go stale). |
| **Risks of reusing ProfileArtifact too directly** | ProfileArtifact is a generic artifact container with no structured semantics. Using it as the User Map would: (1) lose the 5-family taxonomy, (2) lose evidence provenance, (3) lose confidence/strength levels, (4) make it impossible to track model updates over time, (5) create a dumping ground for unstructured "profile data." |

### 2. Generative Self-Model

| Aspect | Assessment |
|--------|-----------|
| **Existing evidence/claims that could support causal chains** | PatternClaim provides the "what" (pattern summaries). ContradictionNode provides tensions between beliefs/behaviors. QuickCheckIn provides state transitions. Timeline aggregation provides rhythms and repeated signals. |
| **Current models for trigger→interpretation→state→strategy→function→cost→stabilizer→identity update?** | **None.** The current system has no causal chain model. Pattern families are independent — there's no model of how trigger_condition leads to inner_critic leads to repetitive_loop leads to recovery_stabilizer. |
| **What would need to be new?** | A causal chain model linking pattern families. A "self-model" abstraction that synthesizes patterns into a coherent theory of how the user's inner system works. Identity update tracking. |

### 3. Open Investigations

| Aspect | Assessment |
|--------|-----------|
| **Existing hypothesis/investigation-like model?** | **None.** No Investigation, Hypothesis, or Experiment model exists. |
| **What current concepts could seed investigations?** | ContradictionNode (tensions naturally suggest investigations), PatternClaim (patterns that need deeper exploration), ReferenceItem (goals that need action plans), QuickCheckIn state transitions (unexplained state changes) |
| **What new storage would likely be needed?** | An Investigation model with: hypothesis, status, linked claims/tensions/evidence, timeline of investigation steps, conclusion, confidence. |
| **How could investigations connect?** | User Map (what's being investigated), Timeline (when investigation steps occurred), Actions (fieldwork tasks for investigation), Explore (investigation conversation mode) |

### 4. Model Updates

| Aspect | Assessment |
|--------|-----------|
| **Existing derivation run / timeline event / activity feed?** | DerivationRun model exists with scope, trigger, status, counts. Timeline aggregation exists. Weekly audit exists. |
| **What would need to be tracked to say "your model changed"?** | A diff between consecutive User Map states. Which claims were added/removed/promoted/demoted. Which contradictions were resolved/emerged. Which evidence changed. |
| **What can v1 approximate?** | V1 can approximate model updates by comparing PatternClaim snapshots across derivation runs. The DerivationRun model already provides the temporal anchor. A "ModelUpdate" record could store: runId, changedClaimIds, newClaimIds, resolvedContradictionIds, summary of what changed. |

### 5. Generative Life Playbooks / Actions

| Aspect | Assessment |
|--------|-----------|
| **What exists in current Actions?** | SurfacedAction model with stabilize/build buckets, template-based action generation, linked to claims and goals. Action status tracking (not_started, done, helped, didnt_help). |
| **Are actions already linked to patterns/tensions/evidence?** | **Yes.** Actions have linkedFamily, linkedClaimId, linkedClaimSummary, linkedGoalId, linkedGoalStatement. This is the strongest existing cross-link in the system. |
| **What is missing for model-derived experiments and feedback loops?** | No experiment/fieldwork model. No hypothesis→action→outcome→learn cycle. Actions are template-based, not generated from the User Map. No feedback loop that updates the model based on action outcomes. |
| **V1 opportunity** | The existing action infrastructure is the strongest foundation for Life Playbooks. Add: (1) action→investigation linking, (2) outcome tracking that feeds back into pattern confidence, (3) model-derived action generation (vs. template-based). |

### 6. Visible Model Progress

| Aspect | Assessment |
|--------|-----------|
| **Existing confidence/evidence/status fields?** | PatternClaim has: status (candidate/active/paused/dismissed), strengthLevel (tentative/developing/established), evidenceCount, sessionCount, journalEvidenceCount, journalEntrySpread, journalDaySpread, supportContainerSpread. ContradictionNode has: weight, confidence, escalationLevel, rung. |
| **What new lifecycle/status concepts are needed?** | User Map-level progress (not just per-claim). Model maturity level. Investigation progress. Understanding completeness. Blind spot discovery rate. |
| **What should not be faked?** | Do NOT create fake "progress bars" or "completeness percentages" for understanding. Progress should be evidence-backed: "you have N established patterns across M domains" not "your understanding is 73% complete." |

### 7. Model Maturity Levels

| Aspect | Assessment |
|--------|-----------|
| **Existing counts/signals that could feed levels?** | Total messages, sessions, journal entries, check-ins. PatternClaim counts by status/strength. ContradictionNode counts. DerivationRun history. EvidenceSpan counts. |
| **What would be dangerous or misleading?** | Using message count as a proxy for understanding depth. Using pattern count as a proxy for model quality. Presenting maturity levels as a gamification mechanic. |
| **What is a responsible v1 approximation?** | Data volume thresholds (e.g., "enough data to detect patterns" = 100+ messages across 5+ sessions). Pattern coverage (e.g., "patterns detected in 3+ families"). Contradiction awareness (e.g., "tensions identified and tracked"). NOT "you are Level 3 of 5." |

### 8. Meta-Observer / Blind Spot Engine

| Aspect | Assessment |
|--------|-----------|
| **Existing diagnostics/evals that could become this?** | **Yes — this is the strongest fit in the entire audit.** The eval infrastructure (`lib/eval/`) already: measures behavioral gate precision/recall, tracks false positives/negatives per family, computes visible abstention rates, runs faithfulness scoring, flags review-worthy outputs, calibrates abstention thresholds. |
| **What does the system already measure?** | Behavioral eligibility accuracy, family signal accuracy, quote safety, abstention correctness, faithfulness, rationale sufficiency/minimality, review routing flags. |
| **What blind-spot signals could be derived from existing data?** | (1) Contradictions the system hasn't detected (from user behavior that contradicts detected patterns). (2) Pattern families with low evidence counts (potential blind spots). (3) Repeated signals in timeline that have no corresponding pattern claim. (4) State transitions that lack explanation. (5) User corrections/rejections of pattern claims. |
| **V1 opportunity** | The eval pipeline can be adapted to run in "shadow mode" on live user data, producing blind-spot signals without affecting product behavior. This is the safest path to a Meta-Observer. |

### 9. Model-Backed Emotional Processing

| Aspect | Assessment |
|--------|-----------|
| **How does Explore currently work?** | Explore (`/explore` route) exists as a web surface but its internal logic is unclear from file inspection. Mobile has no Explore screen. The system prompt (`lib/assistant/system-prompt.ts`) likely governs Explore behavior. |
| **Where would Release / Understand / Move mode fit?** | These modes would be surface types on the chat/explore surface. The existing `SessionSurfaceType` enum (`journal_chat`, `explore_chat`) could be extended with `release`, `understand`, `move`. |
| **What user model data could it use?** | Current state (from QuickCheckIn), active patterns, active contradictions, recent timeline signals, current investigation context. |
| **What safety/objectivity constraints are needed?** | The existing visible abstention policy, behavioral filter, and quote safety checks are a starting point. Emotional processing modes would need stronger guardrails: no therapeutic claims, no diagnostic language, clear "this is exploration not therapy" disclaimers, escalation paths for crisis content. |

### 10. Fieldwork Loop

| Aspect | Assessment |
|--------|-----------|
| **Existing actions/check-ins/journal prompts that could support fieldwork?** | SurfacedAction (stabilize/build tasks), QuickCheckIn (state tracking), JournalEntry (free-form reflection). |
| **What new lightweight object or UI state may be needed?** | A FieldworkAssignment model: linked to investigation, has hypothesis, action to take, observation prompt, outcome tracking. UI state: "fieldwork mode" on actions that shows hypothesis→action→observe→reflect cycle. |

---

## 8. Gaps / Risks / Anti-Patterns

### Critical Risks

1. **Forcing everything into PatternClaim.** PatternClaim is designed for 5 specific behavioral pattern families. Using it as a generic "User Map claim" container would: lose the family taxonomy semantics, create confusion between behavioral patterns and other model beliefs, make it impossible to distinguish "detected pattern" from "model hypothesis."

2. **Treating ProfileArtifact as User Map too directly.** ProfileArtifact is a generic artifact with no structured semantics. It has no confidence, no evidence provenance, no lifecycle, no family taxonomy. Using it as the User Map would create an unstructured dumping ground.

3. **Presenting hypotheses as conclusions.** The current system already has this risk — PatternClaims are presented as "patterns" not "hypotheses." The new architecture must clearly distinguish between "what the model suspects" (candidate/hypothesis) and "what the model has strong evidence for" (established claim).

4. **Overbuilding agents before storage/read models exist.** The Deliberative Agent Brain concept is tempting to build first, but without the User Map, Investigations, and Model Update storage models, agents would have nowhere to read from or write to.

5. **Creating fake progress indicators.** Model Maturity Levels and Visible Model Progress must be evidence-backed, not gamified. A "73% complete" understanding meter would be misleading and potentially harmful.

6. **Adding UI before data model support.** The web app has 30+ routes, many of which read from backend-derived data. Adding new surfaces (User Map, Investigations, Model Updates) without the corresponding data models would create brittle frontend code that fakes backend intelligence.

7. **Duplicating web/mobile logic.** The mobile app already duplicates some backend API client logic (e.g., receipts are assembled client-side in `mobile-receipts.ts`). New architecture should push intelligence to the backend and keep mobile as a thin client.

8. **Making mobile diverge from backend intelligence.** The mobile app's timeline detail data is synthetic (frontend types, not backend models). This pattern must not extend to User Map, Investigations, or Model Updates.

9. **Therapy/diagnosis language.** The current system uses "pattern," "contradiction," "recovery stabilizer" — clinical-adjacent language. The new architecture must be careful with "understanding engine," "self-model," "emotional processing" — these could imply therapeutic capability that doesn't exist.

10. **Stale derivations.** Pattern derivation runs are triggered on new messages with a 30s cooldown, but there's no periodic refresh. If the User Map is updated only on new messages, it will go stale during periods of inactivity.

11. **No direct derivation triggers from journal/check-ins.** The native derivation trigger (`lib/native-derivation-trigger.ts`) fires on chat messages. Journal entries and check-ins may not trigger re-derivation, meaning patterns derived from journal content could be stale.

12. **Missing receipts/confidence/history for model updates.** The current system has no way to show "your model changed because..." — no diff, no changelog, no confidence history at the User Map level.

### Additional Risks

- **Over-indexing on the 5-family taxonomy.** The current pattern system is built around exactly 5 families. The new Understanding Engine may need additional claim types (values, strengths, identity beliefs) that don't fit any existing family.
- **ContradictionNode as the only tension model.** Contradictions are currently modeled as binary tensions (sideA vs sideB). Real investigations may involve multi-faceted tensions, uncertainty, or competing hypotheses.
- **No user feedback loop on pattern quality.** Users can dismiss patterns, but there's no structured feedback mechanism ("this pattern is accurate," "this pattern misses context," "this pattern is harmful").
- **No export/portability.** The User Map and self-model should be exportable by the user. Current system has no data export beyond raw database access.

---

## 9. Recommended V1 Architecture Direction

### What to Reuse (Strongest Infrastructure)

1. **PatternClaim + lifecycle engine** — The 5-family pattern detection pipeline is the most mature derivation system. It should feed the User Map, not be replaced by it.

2. **ContradictionNode + escalation system** — Tensions are natural seeds for Investigations. The existing rung/escalation system can be extended to track investigation progress.

3. **SurfacedAction + action generation** — The strongest cross-link infrastructure. Actions already connect to patterns, claims, and goals. This is the foundation for Life Playbooks.

4. **Timeline aggregation** — The timeline is already the epistemic infrastructure the theory describes. It aggregates check-ins, sessions, and journal entries into rhythms, signals, and links.

5. **Eval pipeline** — The strongest candidate for the Meta-Observer / Blind Spot Engine. Already measures what the system gets wrong.

6. **DerivationRun** — Provides the temporal anchor for Model Updates. Each run is a snapshot of what the system derived.

7. **Behavioral filter + quote safety + visible abstention** — The existing safety/objectivity stack is a strong foundation. Extend, don't replace.

### What is Missing But Essential

1. **UserMap model** — A persisted model that synthesizes PatternClaims, Contradictions, ReferenceItems, and ProfileArtifacts into a coherent theory of the user. Must have: version, claims[], tensions[], evidence summary, confidence metrics, lastUpdatedAt.

2. **Investigation model** — hypothesis, status, linked claims/tensions/evidence, timeline of steps, conclusion, confidence. Must connect to User Map, Timeline, Actions, and Explore.

3. **ModelUpdate model** — runId, changedClaimIds, newClaimIds, resolvedContradictionIds, summary, diff. Must be derivable from comparing consecutive User Map states.

4. **CausalChain model** — Links pattern families into causal sequences (trigger → interpretation → state → strategy → function → cost → stabilizer → identity update). This is what makes the self-model "generative."

5. **FieldworkAssignment model** — linked to investigation, hypothesis, action to take, observation prompt, outcome tracking.

### What Should Be V1

1. **User Map (persisted, hybrid)** — Start with a model that aggregates existing PatternClaims + Contradictions + ReferenceItems into a unified view. Do NOT create new derivation logic yet — just surface what already exists in a structured way.

2. **Model Updates (approximated from DerivationRun)** — Create a lightweight ModelUpdate record that captures what changed between derivation runs. Use existing DerivationRun data.

3. **Investigations (seeded from Contradictions)** — Start with a simple Investigation model seeded from existing ContradictionNodes. Users can open an investigation on any tension.

4. **Life Playbooks (extend Actions)** — Add fieldwork tracking to existing SurfacedActions. Link actions to investigations. Add outcome feedback.

5. **Meta-Observer (shadow mode from eval pipeline)** — Run the eval pipeline in shadow mode on live user data. Produce blind-spot signals without affecting product behavior.

### What Should Be Deferred

1. **Generative Self-Model (causal chains)** — Requires understanding how pattern families interact causally. This is research, not implementation. Defer until User Map v1 is stable and we have data on how patterns co-occur.

2. **Model-Backed Emotional Processing (Release/Understand/Move modes)** — Requires the Generative Self-Model to be meaningful. Defer until causal chains exist.

3. **Deliberative Agent Brain** — Requires storage/read models (User Map, Investigations, Model Updates) to exist first. Defer until those are stable.

4. **Model Maturity Levels** — Risk of gamification/fakery. Defer until we have enough data to define meaningful, evidence-backed levels.

5. **Full mobile parity** — Mobile is a prototype. Don't build new architecture features on mobile until the backend models are stable.

---

## 10. Open Architectural Questions

1. **User Map: persisted table vs. computed view?** A persisted table allows versioning and diffs but requires a write path. A computed view is always fresh but expensive and has no history. **Recommendation:** Persisted table, updated by derivation runs, with a computed fallback for real-time reads.

2. **Investigations: backend model vs. frontend state?** Backend model ensures persistence and cross-device sync. Frontend state is faster but ephemeral. **Recommendation:** Backend model with lightweight frontend cache.

3. **Model Updates: event-sourced vs. snapshot-diff?** Event sourcing captures every change but is complex. Snapshot diff compares consecutive User Map states. **Recommendation:** Snapshot diff for v1. Event sourcing if we need granular change tracking.

4. **Causal chains: LLM-generated vs. rule-based?** LLM generation is flexible but expensive and non-deterministic. Rule-based is deterministic but limited. **Recommendation:** Rule-based for v1 (using existing pattern family markers), LLM augmentation deferred.

5. **Meta-Observer: online vs. offline?** Online runs on every derivation and could affect product behavior. Offline runs periodically and produces reports. **Recommendation:** Offline/shadow mode for v1. Online only after calibration.

6. **Mobile: shared API client vs. separate backend?** Currently mobile has its own API client. Should new architecture endpoints be shared? **Recommendation:** Yes — all new endpoints should serve both web and mobile from the same backend.

7. **Explore modes: new surface types vs. prompt engineering?** Release/Understand/Move modes could be new SessionSurfaceType values with different system prompts, or they could be prompt-level variations within a single surface. **Recommendation:** New surface types for v1 (clear separation of concerns), prompt engineering for iteration.

8. **Objectivity Referee: separate service vs. library module?** A separate service is scalable but adds deployment complexity. A library module is simpler but runs in-process. **Recommendation:** Library module for v1, extracted to service if needed.

---

## 11. Step 2B Handoff Summary

### Strongest Infrastructure to Reuse

| Infrastructure | File(s) | Reuse As |
|---------------|---------|----------|
| PatternClaim + lifecycle | `lib/pattern-claim-lifecycle.ts`, `lib/pattern-detector-v1.ts` | User Map claims foundation |
| ContradictionNode + escalation | `lib/contradiction-*.ts` | Investigation seeds |
| SurfacedAction + generation | `lib/actions-v1.ts` | Life Playbooks foundation |
| Timeline aggregation | `lib/timeline-aggregation.ts` | Epistemic infrastructure |
| Eval pipeline | `lib/eval/pattern-evaluator.ts` | Meta-Observer / Blind Spot Engine |
| DerivationRun | `prisma/schema.prisma` (DerivationRun model) | Model Update temporal anchor |
| Safety stack | `lib/behavioral-filter.ts`, `lib/pattern-quote-selection.ts`, `lib/pattern-visible-claim.ts` | Objectivity constraints |

### Missing But Essential (Must Build)

1. **UserMap model** — persisted, versioned, synthesized from existing claims/tensions/evidence
2. **Investigation model** — hypothesis, status, linked items, timeline, conclusion
3. **ModelUpdate model** — diff between User Map states, linked to DerivationRun
4. **CausalChain model** — links pattern families into causal sequences (deferred to v2)
5. **FieldworkAssignment model** — linked to investigation, action, outcome tracking

### V1 Scope

1. User Map (aggregate existing data into structured view)
2. Model Updates (approximate from DerivationRun diffs)
3. Investigations (seed from Contradictions)
4. Life Playbooks (extend Actions with fieldwork tracking)
5. Meta-Observer (shadow mode from eval pipeline)

### Deferred

1. Generative Self-Model (causal chains)
2. Model-Backed Emotional Processing (Release/Understand/Move)
3. Deliberative Agent Brain
4. Model Maturity Levels
5. Full mobile parity

### Needs UI/Product Surface Map Before Implementation

1. **User Map** — Where does it live? Is it a new route (`/user-map`) or does it replace Today (`/`)? What sections does it have? How does it relate to Patterns, Contradictions, and Timeline?
2. **Investigations** — Is it a new route (`/investigations`) or a mode within Contradictions? How does the user open/close an investigation?
3. **Model Updates** — Is it a notification, a timeline event, or a dedicated feed? How does the user see "what changed"?
4. **Life Playbooks** — Is it a new section within Actions, or a separate route? How does fieldwork tracking work in the UI?
5. **Meta-Observer** — Is it invisible to the user (shadow mode only) or does it have a visible surface (blind spot dashboard)?

### Needs Architectural Decisions Before Code

1. User Map: persisted table vs. computed view → **persisted table**
2. Investigations: backend model vs. frontend state → **backend model**
3. Model Updates: event-sourced vs. snapshot-diff → **snapshot diff for v1**
4. Causal chains: LLM-generated vs. rule-based → **rule-based for v1, LLM deferred**
5. Meta-Observer: online vs. offline → **offline/shadow mode for v1**
6. Mobile: shared API client vs. separate backend → **shared backend**
7. Explore modes: new surface types vs. prompt engineering → **new surface types for v1**
8. Objectivity Referee: separate service vs. library module → **library module for v1**

### Recommended Next Document

**`MindLab Understanding Engine — Architecture/Application Map v1`**

This document should:
1. Define the User Map model schema (fields, relationships, versioning strategy)
2. Define the Investigation model schema
3. Define the Model Update model schema
4. Map each new concept to existing infrastructure (from this audit)
5. Define the derivation pipeline for User Map updates
6. Define the API surface for new models
7. Define the UI surface map (routes, components, data flow)
8. Define the safety/objectivity constraints for each new surface
9. Define the v1/v2 boundary explicitly
10. Include a migration strategy (no data loss, backward-compatible APIs)
