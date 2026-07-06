# 00 Free Explore Chat — Production / Runtime Parity Audit

## Branch context

- Branch audited: `desktop-free-explore-chat-production-parity-audit-001`
- Base: `staging` after Investigations tab alignment (#91)
- **Already bridged at root (do not change):** Today, Map, Timeline, Decisions, Experiment / Fieldwork Bridge, Active Questions, Investigations, EvidencePanel provider lookup
- **Remaining Explore surface:** Free Explore chat only

## Product rule (non-negotiable)

**Reference visual/runtime parity beats production data visibility.**  
If chat/session data is unauthenticated, booting, empty, streaming-incomplete, ungrounded, or would leak fake movement counts, Free Explore must stay on reference/mock — not partially wire production.

---

## Active root Free Explore component path

```
app/(root)/layout.tsx
  → AppShell (components/layout/AppShell.tsx)
  → OrvekWorkbenchShell (voids route children — hard swap)
  → useOrvekHybridWorkbenchDataApi()
  → Workbench (components/orvek-v0/workbench.tsx)
  → OrvekDataProvider (no OrvekPageHandlersProvider)
  → PageContent case "explore"
  → ExplorePage (components/orvek-v0/pages/explore.tsx)
  → FreeExplore (same file)
  → EvidencePanel movement rail (components/orvek-v0/evidence-panel.tsx)
```

**Important:** Sidebar `setPage("explore")` is the live Explore entry. The route `app/(root)/(routes)/explore/page.tsx` mounts `OrvekExplorePage`, but `OrvekWorkbenchShell` ignores `{children}`, so that route page is **not rendered** under the current hard swap.

Parallel legacy wiring (exists in repo, **shadowed at root**):

```
app/(root)/(routes)/explore/page.tsx
  → OrvekExplorePage
  → useOrvekExploreChat + buildExploreProductionDataApi
  → OrvekV0PageShell (OrvekDataProvider + OrvekPageHandlersProvider + ProductionInspectorBridge)
  → ExplorePage (same reference component)
```

Do **not** restore `V0ExploreView`, route-first old production shell, or global `displayContract: production` on the hybrid root API.

---

## Audit answers

### 1. What component renders Free Explore chat in the hard-swapped workbench?

| Layer | Component | File |
|-------|-----------|------|
| Page shell | `ExplorePage` | `components/orvek-v0/pages/explore.tsx` |
| Chat UI | `FreeExplore` | same |
| Transcript bubble | `Bubble` | same |
| Inspector rail | `EvidencePanel` → `MovementView` | `components/orvek-v0/evidence-panel.tsx` |

Parent sets `setExploreActive(true)` on Explore mount (enables “Live” inspector badge + movement section).

---

### 2. What reference/mock chat contract does it currently use?

| Field / behaviour | Root today |
|-------------------|------------|
| `exploreMessages` | **Not set** on hybrid API → inline reference pair hardcoded in `FreeExplore` when `!isProductionDisplay(data)` |
| `exploreGrounding` | `EXPLORE_GROUNDING` zip ids from `createMockOrvekDataApi` (`["d1","m-claim-1","r6","aq-2","ctx-values"]`) |
| `exploreLiveDetectionCopy` | Mock string: `"Orvek is reading the model · 1 receipt extracted · 1 question detected"` |
| `exploreView.composerDraft` | Local React `localDraft` (no handlers at root) |
| `exploreView.isBooting/isSending/errorMessage` | Unused at root (`explore` view props absent on hybrid API) |
| Quick prompts | Static defaults in component |
| Movement CTA (in chat) | Hardcoded “4 places” copy → `setInspectorTab("movement")` |
| Reference transcript | Fixed user/orvek pair about architecture visual uncertainty |

Production-shaped contract (legacy `buildExploreProductionDataApi` only):

- `exploreMessages[]`: `{ id, role: user\|orvek, content }`
- `explore` view props: composer draft, boot/send flags, error, quick prompts, empty copy slots
- `exploreGrounding: []` in builder (disabled placeholder chips in adapter)
- Sets `displayContract: production` via `withProductionContract` (**must not leak to hybrid root**)

---

### 3. What grounding chips / ids / movement rail / inspector interactions does reference chat expect?

#### Grounding chips

- Ids from `EXPLORE_GROUNDING` resolve through `getObjects` → zip `OrvekObject` titles
- Click: `select(chipId)` → workbench selection → EvidencePanel object detail
- Production builder supplies **empty** `exploreGrounding` and disabled placeholder chips in adapter — no live grounding at legacy route either

#### Movement rail (Inspector)

- Triggered from chat: movement note button → `setInspectorTab("movement")`
- When `exploreActive`: `MovementView` shows zip `EXPLORE_MOVEMENT` (4 items: receipt, context, active question, fieldwork proposals)
- Extraction confirm/reject uses workbench `extractions` state (reference UX only)
- **Not** wired to `fetchExploreSessionModelUpdates` or `ExploreModelMovementStrip` in root `FreeExplore`

#### Inspector interactions

| Action | Mechanism |
|--------|-----------|
| Grounding chip | `select(id)` |
| Movement note in chat | `setInspectorTab("movement")` |
| Movement row link | `select(linkId)` |
| Ask / quick prompts | `exploreHandlers.onSend` / `onQuickPrompt` — **absent at root** |

Root `Workbench` does **not** mount `ProductionInspectorBridge` (legacy `OrvekV0PageShell` does).

---

### 4. What production chat/session APIs and hooks already exist?

| Asset | Path | Role |
|-------|------|------|
| Chat hook | `components/orvek-workbench/useOrvekExploreChat.ts` | Session boot, message list, streaming send, localStorage session id |
| Legacy page wrapper | `components/orvek-workbench/OrvekExplorePage.tsx` | Wires hook → `buildExploreProductionDataApi` + explore handlers |
| Production builder | `lib/orvek-v0/production/explore-api.ts` | Maps messages + composer state into `OrvekDataApi` |
| Adapter | `lib/orvek-adapters/explore.ts` | `mapExploreDataToV0Props`, quick prompts, empty copy |
| Session bridge (module) | `lib/explore-session-bridge.ts` | `sessionId` + refresh token for movement/review strips — **not called from `useOrvekExploreChat` today** |
| Model updates fetch | `lib/explore-session-model-updates.ts` | `GET /api/explore/sessions/[id]/model-updates` |
| Conversation review | `lib/explore-conversation-review.ts` + review strip components | Draft/proposed updates from session |
| Surface copy | `lib/explore-surface.ts` | Governed product language |
| Chat routing helpers | `lib/chat-surface-routing.ts` | `explore_chat` surface type, session list/create URLs |
| Storage key | `mindlabs:explore:session-id` | Session persistence in hook |

**HTTP surface used by hook:**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/session/list?origin=app&surfaceType=explore_chat` | List sessions |
| `POST /api/session` `{ surfaceType: "explore_chat" }` | Create session |
| `GET /api/message/list?sessionId=` | Load transcript |
| `POST /api/message` | Stream assistant reply (`responseMode: "standard"`, model `gpt-4o-mini`) |
| `POST /api/session/title` | Auto-title after send |

**Side effects on send (server):** profile derivation, contradiction detection, app-message candidate bridge for `explore_chat`, pattern batch orchestration, native derivation triggers — real engine writes behind auth.

**Alternate UI (quarantined from root):** `components/orvek-workbench/views/V0ExploreView.tsx` — includes `ExploreModelMovementStrip` + `ExploreConversationReviewStrip`; not mounted in hard-swapped path.

---

### 5. What does legacy `/explore` route currently wire?

File: `app/(root)/(routes)/explore/page.tsx` → `OrvekExplorePage`

- Boots `useOrvekExploreChat`
- Builds `buildExploreProductionDataApi` with live messages, composer, boot/send/error flags
- Passes explore handlers: `onDraftChange`, `onSend`, `onQuickPrompt`, `onComposerFocus`, stub `onOpenInspector`
- Zeros investigations/questions/fieldwork lists (empty production tab arrays)
- Wraps in `OrvekV0PageShell` with `displayContract: production`

**Runtime note:** Under hard swap, this page is **not displayed** — `OrvekWorkbenchShell` renders `Workbench` only.

---

### 6. What does root hard-swapped `/` currently wire or not wire?

| Wired at root | Not wired at root |
|---------------|-------------------|
| `useOrvekHybridWorkbenchDataApi` for Today/Map/Timeline/Decisions/Experiment/Active Questions/Investigations | `useOrvekExploreChat` |
| Reference `ExplorePage` / `FreeExplore` UI | `OrvekPageHandlersProvider` |
| Zip grounding + reference transcript | `exploreMessages`, `explore` composer props on hybrid API |
| Zip `EXPLORE_MOVEMENT` inspector rail | Session model updates / conversation review strips |
| `createMockOrvekDataApi` baseline | `buildExploreProductionDataApi` / explore hybrid overlay |
| EvidencePanel provider-first object lookup | `ProductionInspectorBridge` |
| | `setExploreSessionBridgeSessionId` (bridge module unused) |

Hybrid hook (`useOrvekHybridWorkbenchDataApi`) has **no** explore chat fetch, message state, or handler wiring.

---

### 7. What handlers are missing at root?

`OrvekPageHandlers.explore` (from `lib/orvek-v0/page-handlers.tsx`):

| Handler | Legacy `/explore` | Root workbench |
|---------|-------------------|----------------|
| `onDraftChange` | ✅ | ❌ |
| `onSend` | ✅ | ❌ |
| `onQuickPrompt` | ✅ | ❌ |
| `onComposerFocus` | ✅ (stub) | ❌ |
| `onOpenInspector` | ✅ (stub) | ❌ |
| `onTabChange` | ✅ (no-op) | ❌ |

Root `Workbench` does not mount `OrvekPageHandlersProvider`.

---

### 8. Is sending a message currently disabled, stubbed, or wired?

**At root (hard-swapped workbench): effectively disabled.**

```ts
const canSend = Boolean(exploreHandlers?.onSend) && !composerDisabled && composerDraft.trim().length > 0
```

- No `exploreHandlers` → Ask button always disabled
- User can type into composer via `localDraft` fallback
- Quick prompts fall back to `setLocalDraft(q)` only (no send)

**On legacy `OrvekExplorePage` (if reachable): fully wired** — streaming send via `useOrvekExploreChat.sendMessage`.

---

### 9. Risks: streaming, session, persistence, auth, grounding, inspector

| Risk | Detail |
|------|--------|
| **Auth** | Session list/create/message return 401 without sign-in; hook surfaces error string |
| **Session boot failure** | Empty/error state; must fall back to reference transcript, not blank production shell |
| **Auto session creation** | Hook creates session on first boot if none exist — side effect before user sends |
| **Streaming partial state** | Optimistic user + empty assistant bubble during stream; reconciles via `loadMessages` after |
| **Abort mid-stream** | `AbortController` supported; partial assistant text may remain until reconcile |
| **localStorage session id** | Stale id if session deleted → 404 on message load |
| **Fake movement signal** | Reference live detection copy claims “1 receipt extracted · 1 question detected” without evidence — must not copy to production without real session review data |
| **Zip movement rail** | Inspector shows reference `EXPLORE_MOVEMENT` even if real session has no published updates |
| **Grounding empty in production builder** | Live chat would show honest empty grounding — visual regression vs reference unless separate grounding slice |
| **`displayContract` leak** | Would hide reference transcript and disable reference-only CTAs on other Explore tabs |
| **Engine side effects** | Real sends trigger candidate bridge, contradictions, profile derivation — not cosmetic |
| **Session bridge unwired** | Movement/review strips cannot refresh without `setExploreSessionBridgeSessionId` |
| **Dual Explore entry confusion** | `/explore` route shadowed; chat wiring in `OrvekExplorePage` unreachable at root |
| **Inspector bridge gap** | Root lacks `ProductionInspectorBridge`; production object types may not sync to global InspectorContext |

---

### 10. What would break if legacy chat was dropped directly into root Free Explore?

| Breakage | Cause |
|----------|--------|
| Blank transcript | `isProductionDisplay` true + empty `exploreMessages` → empty state, reference pair hidden |
| Other Explore tabs regress | Global `displayContract: production` from `buildExploreProductionDataApi` affects Investigations/Questions/Fieldwork fallback logic still using `isProductionDisplay` in **FreeExplore only** today — but contract on hybrid API would confuse any `isProductionDisplay` checks |
| Investigations/Questions empty in OrvekExplorePage | Legacy wrapper passes empty tab arrays — tab bridges at root would be overwritten if naively merged |
| Movement mismatch | Chat sends real messages but inspector still shows zip extractions |
| Grounding regression | Production builder clears grounding → empty chips vs reference chip row |
| Ask enabled without movement/review | User can chat but “4 places” / live detection copy still reference-fake |
| Handler provider scope | Handlers needed only on Explore page — mounting globally in Workbench affects all pages if not scoped |
| Unauthenticated UX | Boot errors must not replace reference demo transcript on signed-out dev viewing |

**Do not** copy `OrvekExplorePage` wholesale into shell — need hybrid overlay + handler gate + reference fallback pattern used by other bridges.

---

### 11. What production fields are display-ready?

| Field | Source | Safe for UI |
|-------|--------|-------------|
| Message `id` | `/api/message/list` | ✅ |
| Message `role` | API (`user` / `assistant` → map to `orvek`) | ✅ |
| Message `content` | API (post-stream reconcile) | ✅ |
| Message `createdAt` | API | ✅ (not shown in v0 bubble today) |
| Session `id` | Session APIs | ✅ (internal) |
| Composer draft | Hook state | ✅ |
| `isBooting` / `isSending` | Hook state | ✅ |
| `errorMessage` | Hook state | ✅ |
| Quick prompts | Adapter constants | ✅ |
| Empty copy slots | `explore-surface` / adapter | ✅ |

---

### 12. What production fields are unsafe, raw, stale, or insufficiently grounded?

| Field / behaviour | Issue |
|-------------------|--------|
| Partial streaming assistant content | Mid-stream empty/thin bubbles — gate or “thinking” state needed |
| `exploreLiveDetectionCopy` from mock | Reference string implies detections not backed by session review API |
| Movement count “4 places” in chat CTA | Hardcoded; not tied to session model updates |
| `EXPLORE_MOVEMENT` zip rail | Stale vs real conversation |
| Grounding chips | No production grounding projection in builder; linking receipts/map objects needs evidence-backed slice |
| Review items / draft proposals | Raw engine kinds — only safe via `explore-conversation-review` normalization |
| Session model updates | Safe list items via public slice — separate from chat transcript gate |
| `displayContract: production` | Unsafe on hybrid root — disables reference fallbacks globally |
| Fake “thinking” without stream | Must not invent assistant text |

---

### 13. Does chat need a readiness gate like list surfaces, or a separate handler/session gate?

**Separate handler/session gate — not a list-row readiness gate.**

List surfaces (Map, Active Questions, Investigations) gate **merged ids + normalized objects**.

Chat gates on **session lifecycle + handler wiring + normalized transcript**:

Proposed shape:

```ts
shouldMergeExploreChatProductionApi(api): boolean
  - not api.exploreIsLoading (or explore?.isBooting)
  - session boot succeeded OR message list loaded without fatal error
  - no fatal exploreView.errorMessage blocking display
  - normalized messages pass presentation rules (roles, trimmed content, no duplicate temp ids after reconcile)

hasLiveExploreChat = (exploreMessages?.length ?? 0) > 0 || sessionReady
```

Use **`hasLiveExploreChat` pattern in `FreeExplore`** (mirror Fieldwork/Active Questions/Investigations) — **not** global `isProductionDisplay`.

Handlers (`onSend`, etc.) are a **parallel requirement**: merge can expose transcript while send stays disabled if handlers absent — but product intent is to wire both together.

Movement/review/grounding: **separate gates** — do not block transcript on movement readiness.

---

### 14. Should Free Explore chat bridge before or after dedicated Explore session route cleanup?

**Bridge chat at root first; route cleanup second.**

Rationale:

1. Hard swap already makes `/explore` route shadowed — users never see `OrvekExplorePage` today
2. Chat wiring belongs in `OrvekWorkbenchShell` / hybrid hook + scoped handlers, not the orphaned route page
3. Route cleanup (remove or redirect `/explore`, consolidate `OrvekExplorePage`) reduces confusion **after** root path works
4. Session APIs are shared (`explore_chat`) — no new route required for minimal bridge

Do **not** block chat bridge on full `V0ExploreView` retirement or movement strip port.

---

### 15. Smallest safe implementation slice after this audit

#### Slice A — Explore chat presentation gate (lib only)

- `lib/orvek-v0/production/explore-chat-presentation.ts`
- `normalizeExploreChatMessages()`, `shouldMergeExploreChatProductionApi()`
- Strip `displayContract`; map assistant → orvek; reject unsafe empty assistant rows post-boot
- Tests: `explore-chat-presentation-readiness.test.ts`

#### Slice B — Hybrid explore chat overlay (no UI change)

- `buildExploreChatProductionDataApi()` or extend hybrid builder with `mergeExploreChatOverlay()`
- Fields: `exploreMessages`, `exploreIsLoading`, `explore` composer props, honest `emptyCopyBySlot`
- **Do not** set global `displayContract`
- **Do not** clear hybrid Active Questions / Investigations / Fieldwork merges

#### Slice C — Root hook + handler wiring (bounded)

- `useOrvekExploreChat` in `OrvekWorkbenchShell` or explore-scoped wrapper
- Mount `OrvekPageHandlersProvider` explore handlers when on Explore page (or lightweight provider in `ExplorePage`)
- Pass overlay as additional argument to hybrid builder OR merge inside `useOrvekHybridWorkbenchDataApi`
- Call `setExploreSessionBridgeSessionId` on session change (prep for movement slice)

#### Slice D — Free Explore tab alignment

- `FreeExplore`: `hasLiveExploreChat` pattern; reference transcript fallback when gate fails
- Remove `isProductionDisplay` from chat path only
- Keep movement CTA + live detection on reference until movement slice

#### Explicitly later slices

- Session-grounded movement rail (replace zip `EXPLORE_MOVEMENT` when session updates exist)
- Conversation review strip in v0 inspector or chat footer
- Production grounding chips from receipts/map selection
- Retire shadowed `/explore` route page

---

## Recommended gate / contract shape

| Concern | Contract |
|---------|----------|
| Transcript | `exploreMessages?: { id, role: user\|orvek, content }[]` |
| Loading | `exploreIsLoading?: boolean`; `explore.isBooting`, `explore.isSending` |
| Composer | `explore.composerDraft`, `explore.errorMessage`, `emptyCopyBySlot.exploreChatEmpty` |
| Live detection | Omit mock copy when live; use honest empty from adapter until review API wired |
| Grounding | Keep reference `EXPLORE_GROUNDING` until evidence-backed grounding slice |
| Handlers | Required for send; optional for read-only live transcript |
| Global contract | **Never** set `displayContract` on hybrid root |

---

## Tests required before implementation

| Test file | Asserts |
|-----------|---------|
| `explore-chat-presentation-readiness.test.ts` | Gate, normalization, no `displayContract`, streaming/thin message rejection |
| `explore-chat-hybrid-fetch.test.ts` | Hook wiring, hybrid overlay merge, reference fallback, handlers passed |
| `explore-composer-wireup.test.ts` | Extend: root handler provider, `hasLiveExploreChat`, no movement misroute on send |
| `hybrid-workbench-api.test.ts` | Explore overlay does not clobber question/investigation/fieldwork ids |
| `shell-quarantine.test.ts` | No `V0ExploreView` restore; hybrid hook remains |
| `explore-surface.test.ts` | Copy/trust boundaries unchanged |
| Parity regression suite | Active Questions, Investigations, Fieldwork, Today, Map, Timeline, Decisions unchanged |

---

## Product-owner visual check

**Required before commit** when implementation lands.

Verify:

1. Reference transcript + grounding chips when session/auth fails
2. Live transcript replaces reference when session boots
3. Ask + quick prompts send and stream without layout drift
4. Investigations / Active Questions / Fieldwork tabs unchanged
5. Inspector movement rail behaviour acceptable (reference vs live) for the slice scope
6. No fake detection copy presented as real when session has no review items

---

## Parity preserved (audit scope)

| Surface | Status |
|---------|--------|
| Fieldwork Bridge | Unchanged — audit only |
| Active Questions | Unchanged |
| Investigations | Unchanged |
| Today / Map / Timeline / Decisions / Experiment | Unchanged |
| `createMockOrvekDataApi` | Remains baseline for unwired chat fields |

---

## Production readiness

**Not production-ready.** Free Explore chat at root is reference-only with disabled send. Legacy chat wiring exists but is shadowed by hard swap.

---

## Recommended next step

Implement **Slice A → B → C → D** in order (gate, hybrid overlay, root hook/handlers, tab alignment). Defer movement/review/grounding until transcript + send path is verified with visual check.
