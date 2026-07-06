# 00 Explore Remaining Surfaces — Production Data Parity Audit

## Branch context

- Branch audited: `desktop-explore-remaining-production-data-parity-audit-001`
- Base: `staging` after #89 merge (Experiment / Fieldwork Bridge bridge complete)
- Root workbench path: `OrvekWorkbenchShell` → `useOrvekHybridWorkbenchDataApi` → `Workbench` → `ExplorePage`
- **Already bridged inside Explore:** Fieldwork Bridge (`exploreFieldworkIds`, watch-for fetch, readiness gate, tab alignment)
- **Still reference/mock at root:** Free Explore chat, Investigations tab, Active Questions tab

## Product rule (non-negotiable)

**Reference visual/runtime parity beats production data visibility.**  
If production data is thin, raw, duplicated, missing status/reason, or fails readiness, each surface must stay on reference/mock — not partially leak production rows.

---

## Active root Explore component path

```
app/(root)/layout.tsx
  → OrvekWorkbenchShell
  → useOrvekHybridWorkbenchDataApi()
  → Workbench (components/orvek-v0/workbench.tsx)
  → OrvekDataProvider
  → PageContent case "explore"
  → ExplorePage (components/orvek-v0/pages/explore.tsx)
  → EvidencePanel (components/orvek-v0/evidence-panel.tsx)
```

Parallel legacy route (quarantined from root sidebar; chat wired here only):

```
app/(root)/(routes)/explore/page.tsx
  → OrvekExplorePage
  → OrvekV0PageShell + buildExploreProductionDataApi + useOrvekExploreChat
  → ExplorePage (same reference component)
```

Do **not** restore `V0ExploreView`, route-first `/watch-for` / `/active-questions` navigation, or global `displayContract: production` on the hybrid root API.

---

## Audit answers

### 1. What components render Explore chat, Investigations, and Active Questions?

| Surface | Component | File | Root workbench today |
|---------|-----------|------|----------------------|
| **Free Explore chat** | `FreeExplore` | `components/orvek-v0/pages/explore.tsx` | Reference messages + disabled Ask (no page handlers at root) |
| **Investigations** | `Investigations` | same | Hardcoded `inv-1`, `inv-2`, `inv-3` + zip `getObject` |
| **Active Questions** | `Questions` | same | Hardcoded `aq-1` … `aq-4` + zip `getObject` |
| **Fieldwork Bridge** | `FieldworkBridge` | same | **Bridged** — `exploreFieldworkIds` when hybrid gate passes |

Parent shell: `ExplorePage` sets `setExploreActive(true)` on mount (Inspector movement rail).

Production chat hook (legacy route only): `useOrvekExploreChat` in `components/orvek-workbench/useOrvekExploreChat.ts`, wired by `OrvekExplorePage`.

Root hybrid hook (`useOrvekHybridWorkbenchDataApi`) does **not** fetch Explore chat, investigations, or active questions.

---

### 2. Reference/mock data shapes each surface expects

#### Free Explore chat

| Field / behaviour | Source today (root) |
|-------------------|---------------------|
| `exploreMessages` | Inline reference pair when `!isProductionDisplay(data)` |
| `exploreGrounding` | `EXPLORE_GROUNDING` zip ids when reference |
| `exploreLiveDetectionCopy` | Mock string from `createMockOrvekDataApi` |
| `exploreView.composerDraft` | Local React state (handlers absent at root) |
| `exploreView.isBooting/isSending/errorMessage` | Unused at root |
| Quick prompts | Static defaults in component |
| Movement CTA | Hardcoded “4 places” copy → `setInspectorTab("movement")` |

Production-shaped contract (via `buildExploreProductionDataApi`):

- `exploreMessages[]`: `{ id, role: user|orvek, content }`
- `explore` view props: composer, boot/send flags, error, quick prompts, empty copy slots
- `exploreGrounding: []` in builder (grounding chips disabled placeholders)
- Sets `displayContract: production` (**must not leak to hybrid root**)

#### Investigations tab

Reference id list: `["inv-1", "inv-2", "inv-3"]` when `!isProductionDisplay(data)`.

Per-object (`type: "investigation"`) fields used by list + detail:

- `title`, `status`, `evidenceCount` (list meta)
- `whyItMatters`, `hypotheses[]`, `missingEvidence[]` (detail blocks)
- `relatedIds[]` (linked chips → `select(id)`)
- `receiptIds`, `contextIds` (Inspector evidence path via provider graph)

Production path in component: `exploreInvestigationIds ?? []` when `isProductionDisplay(data)` — **never true on hybrid root today**.

#### Active Questions tab

Reference id list: `["aq-1", "aq-2", "aq-3", "aq-4"]`.

Per-object (`type: "active-question"`) fields:

- `title`, `status`, `evidenceCount` (list)
- `whyItMatters`, `supporting[]`, `conflicting[]` (yes/no resolution panels)
- `relatedIds[]` (linked chips)
- “See evidence” → `select(activeId)` + `setInspectorTab("evidence")`

Production path: `exploreQuestionIds ?? []` when `isProductionDisplay(data)` — **never true on hybrid root today**.

---

### 3. Interactions with Inspector, selection, reports, overlays, page state

| Surface | Interaction | Mechanism |
|---------|-------------|-----------|
| **Chat** | Grounding chips | `select(chipId)` |
| **Chat** | Movement note | `setInspectorTab("movement")` |
| **Chat** | Ask / quick prompts | `exploreHandlers.onSend` / `onQuickPrompt` (wired only on legacy `OrvekExplorePage`) |
| **Chat** | Explore active | `setExploreActive(true)` → Inspector shows “From this conversation” movement rail using **zip** `EXPLORE_MOVEMENT` |
| **Investigations** | Thread select | `select(id)` |
| **Investigations** | Linked objects | `select(relatedId)` |
| **Investigations** | Secondary CTAs | Deferred when `isProductionDisplay` |
| **Active Questions** | Question select | `select(id)` |
| **Active Questions** | See evidence | `select(activeId)` + evidence tab |
| **Active Questions** | Secondary CTAs | Deferred when `isProductionDisplay` |
| **All** | EvidencePanel | `useOrvekObjectGraph()` — provider first, zip fallback |
| **All** | Reports | No direct report open from these tabs (investigations copy mentions “Possible report” — reference-only button) |
| **All** | Overlays | `Overlays` in Workbench; Explore tabs do not open route overlays |

**Page handlers:** Root `Workbench` does **not** mount `OrvekPageHandlersProvider`. Only legacy `OrvekV0PageShell` / `ReferencePageHandlersProvider` supply handlers.

---

### 4. Available production APIs / data sources

| Domain | API / helper | Used by today |
|--------|--------------|---------------|
| **Explore chat sessions** | `GET` session list (`buildAppSessionListUrl("explore_chat")`), `POST /api/session`, `GET /api/message/list`, `POST /api/message` (stream), `POST /api/session/title` | `useOrvekExploreChat` on legacy `/explore` only |
| **Explore conversation review** | Server helpers in `lib/explore-conversation-review.ts`, review strips in `components/explore/` | Legacy explore surfaces / inspector wiring tests — **not** in root `FreeExplore` |
| **Explore session model updates** | `lib/explore-session-model-updates.ts`, movement strip components | Same — not in root movement rail |
| **Active questions (public)** | `GET /api/active-questions`, `GET /api/active-questions/[id]`, `GET /api/active-questions/[id]/evidence` | Today reentry, Map open-questions preview, legacy `/active-questions` pages |
| **Investigations (engine)** | `GET/POST /api/investigations`, `GET/PATCH /api/investigations/[id]` | Understanding-engine clients; **no** Explore tab mapper |
| **Investigation public visibility** | `buildPublicActiveInvestigationWhere` | Active Questions API only |
| **Explore production builder** | `buildExploreProductionDataApi` + `mapExploreDataToV0Props` | Legacy `OrvekExplorePage`; zeros investigation/question lists |
| **Hybrid root** | `useOrvekHybridWorkbenchDataApi` | Today, Map, Timeline, Decisions, **Fieldwork** only |

**Fetch helpers already in repo:** `fetchWatchForItems`, `fetchMapOpenQuestionsPreview` (uses active-questions endpoint for Map preview — not Explore tab).

---

### 5. Display-ready production fields

| Surface | Ready today |
|---------|-------------|
| **Chat messages** | `id`, `role`, `content`, `createdAt` from message list API |
| **Chat session meta** | Session id, label, preview, timestamps |
| **Active question list** | `id`, `title`, `organizingQuestion`, `status`, `statusLabel`, timestamps (public-safe projection) |
| **Active question evidence** | Inspector continuity items via evidence route |
| **Investigation list (raw API)** | `id`, `title`, `organizingQuestion`, `status`, `updatedAt` — **but not public-filtered** |

---

### 6. Raw, missing, stale, duplicated, or unsafe fields

| Risk | Surface | Detail |
|------|---------|--------|
| **No root chat wiring** | Chat | Ask disabled; reference transcript only |
| **`displayContract` leak** | Chat / tabs | `buildExploreProductionDataApi` sets production contract → disables reference CTAs, forces empty skeletons |
| **Missing rich question fields** | Active Questions | API lacks `whyItMatters`, `supporting`, `conflicting`, `relatedIds`, `evidenceCount` — reference panels would empty or need honest `—` |
| **organizingQuestion ≠ whyItMatters** | Active Questions | Only safe mapping candidate for “Why this is open” |
| **No yes/no resolution from API** | Active Questions | `competingTheories` / resolution fields exist on Investigation model but **not** in public active-questions list/detail projection |
| **Investigations vs Active Questions collision** | Both | Same `Investigation` table; public active-questions filter overlaps reference split between `inv-*` and `aq-*` |
| **No bounded public Investigations list** | Investigations | `/api/investigations` returns all user rows + engine fields (`competingTheories`, `evidenceNeeded` JSON) without Explore presentation gate |
| **Internal JSON blobs** | Investigations | `competingTheories`, `evidenceNeeded` need normalization before hypotheses / missingEvidence display |
| **Missing visibility filter** | Investigations | Unlike active-questions, list route has no `buildPublicActiveInvestigationWhere` |
| **Inspector evidence gap** | Investigations | No `/api/investigations/[id]/evidence` public route found (active-questions has one) |
| **Movement rail still zip** | Chat | `EXPLORE_MOVEMENT` hardcoded even when Explore active; session model updates not merged |
| **Duplicate row risk** | Questions + Investigations | Same Investigation row could appear in both tabs if naively merged |
| **Stale reference ids** | All tabs | `inv-*`, `aq-*`, grounding ids resolve via zip fallback when provider misses |

---

### 7. Mock/reference ID dependency and EvidencePanel resolution

**Yes — all three remaining surfaces depend on zip objects today.**

| Surface | Reference ids | EvidencePanel |
|---------|---------------|---------------|
| Chat grounding | `EXPLORE_GROUNDING` zip ids | Chips resolve via `useOrvekObjectGraph` → zip |
| Investigations | `inv-1`, `inv-2`, `inv-3` + nested `relatedIds` | Investigation / evidence blocks use merged or zip objects |
| Active Questions | `aq-1` … `aq-4` + nested `relatedIds` | Active-question blocks + evidence tab |

Production UUIDs only resolve after hybrid merge registers `OrvekObject` projections (Fieldwork pattern). Until merge, `getObject(productionId)` falls through to zip miss → list rows render null.

---

### 8. What breaks if production IDs replace reference IDs without a bridge?

| Breakage | Cause |
|----------|--------|
| Empty list rows | `getObject(id)` returns undefined for unknown UUIDs |
| Blank detail panels | Missing `whyItMatters`, `supporting`, `conflicting`, `hypotheses` on thin API rows |
| Inspector evidence dead-end | Production question id without evidence route wiring / alias registration |
| Chat send still no-op | IDs present but handlers not wired at root |
| Movement rail mismatch | Session updates not tied to conversation |
| Dual-tab duplication | Same Investigation shown as question and thread |
| False “production mode” | Global `displayContract` disables reference fallback buttons |

---

### 9. One PR or separate bridges?

**Separate bridges — three tracks minimum:**

| Track | Rationale |
|-------|-----------|
| **A — Active Questions** | Bounded public API exists; closest to Fieldwork bridge pattern |
| **B — Investigations** | Different API contract, visibility rules, and field mapping; needs product filter definition |
| **C — Free Explore chat** | Session lifecycle, streaming, handlers, optional movement/review — largest surface area |

Do **not** combine Active Questions and Investigations into one merge function — shared DB entity but different tab contracts and filters.

Chat should remain its own PR series (presentation gate → hybrid overlay → handler wiring → movement/review optional slices).

---

### 10. Safety gates needed before production data enters each surface

#### Active Questions (proposed)

- `normalizeActiveQuestionsProductionDataApi()` — strip `displayContract`, cap text, reject raw overflow
- Row gate: non-empty `title`, `organizingQuestion`, known public status, safe id
- `shouldMergeActiveQuestionsProductionApi()` — normalize-then-check; fail closed on loading
- Dedupe `exploreQuestionIds`
- Do **not** set global `displayContract`
- Tab detects live rows via `exploreQuestionIds?.length > 0` (Fieldwork pattern), not `isProductionDisplay`
- Optional linked receipt aliases if evidence continuity resolves
- Empty/thin → reference `aq-*` fallback

#### Investigations (proposed)

- **Define public list source first** (new filtered endpoint or strict client filter mirroring visibility rules)
- `normalizeInvestigationsProductionDataApi()` — map `competingTheories` → `hypotheses`, `evidenceNeeded` → `missingEvidence`, cap strings
- Exclude rows already surfaced as Active Questions (status overlap)
- `shouldMergeInvestigationsProductionApi()` — min row count, duplicate rejection, unsafe JSON rejection
- Inspector target aliases for any linked receipts
- Fail closed → reference `inv-*`

#### Free Explore chat (proposed)

- `shouldMergeExploreChatProductionApi()` — session booted, messages normalized, no empty assistant leak mid-stream
- Hybrid overlay: `exploreMessages`, `exploreIsLoading`, `explore` composer props **without** global `displayContract`
- Wire `OrvekPageHandlersProvider` explore handlers at root (or explore-scoped provider in shell)
- Keep reference transcript fallback when session fails or message list empty
- Movement / review strips: separate gate; do not fake extraction counts

---

## Surface contracts (summary)

### Explore chat contract

- **UI:** Transcript, grounding chips, live detection line, movement CTA, composer, quick prompts
- **Provider fields:** `exploreMessages`, `exploreGrounding`, `exploreLiveDetectionCopy`, `explore`, `emptyCopyBySlot.exploreChatEmpty`, optional `exploreIsLoading`
- **Handlers:** `onSend`, `onDraftChange`, `onQuickPrompt`, `onComposerFocus`
- **Root status:** Reference-only; handlers absent

### Investigations tab contract

- **UI:** Thread list + detail (why it matters, hypotheses, missing evidence, linked objects)
- **Provider fields:** `exploreInvestigationIds`, `getObject` graph, `emptyCopyBySlot` investigation slots
- **Selection:** `select(id)`; related chips; no route navigation
- **Root status:** Reference `inv-*` only

### Active Questions tab contract

- **UI:** Question list + detail (why open, yes/no panels, linked objects, see evidence)
- **Provider fields:** `exploreQuestionIds`, `getObject` graph, `emptyCopyBySlot` question slots
- **Selection:** `select(id)` + evidence tab
- **Root status:** Reference `aq-*` only

---

## Interaction risks

1. **Shared Investigation entity** — Active Questions and Investigations tabs can duplicate or contradict if filters overlap.
2. **Thin list / rich detail mismatch** — Reference UI expects fields production list APIs do not provide.
3. **EvidencePanel provider vs zip** — Production ids without registered objects break linked chips and evidence tab.
4. **Chat without handlers** — Merging messages alone does not enable Ask; users may think chat is broken.
5. **Movement rail fiction** — “4 places” / `EXPLORE_MOVEMENT` remains reference unless session updates bridge lands.
6. **`isProductionDisplay` branch** — Questions/Investigations still gate on global contract; hybrid must use **presence of merged id arrays** (Fieldwork precedent).

---

## Proposed minimal bridge plan (post-audit)

### Phase 1 — Active Questions (smallest tab bridge)

1. Audit slice (this receipt) ✅  
2. `active-questions-presentation.ts` + `buildActiveQuestionsProductionDataApi`  
3. `mergeActiveQuestionsOverlay` in `hybrid-workbench-api.ts`  
4. `fetchActiveQuestionsItems` + hybrid hook wiring  
5. `Questions` tab alignment (`exploreQuestionIds` presence gate)  
6. Tests + visual check  

### Phase 2 — Investigations (after list-source decision)

1. Product/architect decision: public Investigations filter (statuses, visibility, exclusion of active-question rows)  
2. Presentation gate + API builder + hybrid merge + tab alignment  
3. Evidence path strategy (new route or reuse continuity helper)  

### Phase 3 — Free Explore chat (multi-slice)

1. Presentation normalization for messages/composer state  
2. Hybrid overlay for `exploreMessages` / loading flags (no global contract)  
3. Root handler wiring (`useOrvekExploreChat` + `OrvekPageHandlersProvider` scoped to Explore)  
4. Optional: grounding from session, movement/review strips  

**Do not start Phase 2 until Active Questions bridge proves the Explore tab alignment pattern.**

---

## Tests required before implementation

| Track | Tests |
|-------|--------|
| **Active Questions** | Presentation readiness, hybrid merge/fallback, hook fetch wiring, tab consumes `exploreQuestionIds`, reference fallback, no `/active-questions` navigation, Investigations/chat untouched, parity regression suite |
| **Investigations** | Same pattern + overlap exclusion with questions, JSON field normalization, unsafe row rejection |
| **Chat** | `explore-composer-wireup` extensions, hybrid message merge, handler wiring at root, reference fallback on boot failure, no fake streaming content, movement rail unchanged until explicit slice |

Reuse patterns from:

- `lib/__tests__/experiment-presentation-readiness.test.ts`
- `lib/__tests__/experiment-hybrid-fetch.test.ts`
- `lib/__tests__/fieldwork-bridge-alignment.test.ts`
- `lib/__tests__/hybrid-workbench-api.test.ts`

---

## Visual check for implementation

| Track | Visual check |
|-------|----------------|
| Active Questions | **Required** before commit — list, detail, evidence tab, reference fallback |
| Investigations | **Required** — thread list/detail, linked chips, no duplicate with Questions |
| Free Explore chat | **Required** — send/stream, empty/error states, reference fallback, movement CTA behaviour |

Audit-only slice: **visual check not required**.

---

## Explicit non-goals (this audit)

- No runtime code changes
- No implementation of Explore chat, Investigations, or Active Questions bridges
- Fieldwork Bridge, Today, Map, Timeline, Decisions untouched
- No old production shell restoration
- No commits in this slice

---

## Recommendation

Proceed with **three separate bridge tracks**. Start with **Active Questions** — bounded public API, clearest mapping to `exploreQuestionIds`, and proven Fieldwork alignment pattern. Defer **Investigations** until a public list contract is defined. Defer **Free Explore chat** until handlers and hybrid overlay strategy are sliced separately from tab bridges.

**Smallest safe next implementation slice:** Active Questions presentation readiness gate (`active-questions-presentation.ts`) — normalization and `shouldMerge*` only, no hook fetch, no tab changes.
