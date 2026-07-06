# 00 Free Explore Chat Send Handler Audit

**Slice:** `DESKTOP-FREE-EXPLORE-CHAT-SEND-HANDLER-AUDIT-001`  
**Branch audited:** `desktop-free-explore-chat-send-handler-audit-001` (staging lineage through PR #93)  
**Mode:** Audit only — no runtime changes

---

## Executive summary

Free Explore **read path is wired** at the root hard swap; **write path is deliberately blocked** at three layers: hook destructuring omits `sendMessage`, hybrid merge **forces** `freeExploreSendHandlerAvailable: false`, and `Workbench` mounts **no** `OrvekPageHandlersProvider`. Legacy `/explore` route (`OrvekExplorePage`) already demonstrates the full send contract via `useOrvekExploreChat` + handlers — but that path is **shadowed** by `OrvekWorkbenchShell`.

Enabling Ask/send is a **bounded handler + flag + UI sync slice**, not a new API invention. Highest risks: auth/boot races, duplicate send, draft desync (local vs provider), streaming presentation, and accidental merge of fake grounding/movement.

---

## Current read-only Free Explore contract (root)

| Layer | State |
|-------|-------|
| Session/messages | `useOrvekExploreChat({})` inside `useOrvekHybridWorkbenchDataApi` |
| Provider build | `buildFreeExploreChatProductionDataApi({ …, sendHandlerAvailable: false })` |
| Hybrid merge | `mergeFreeExploreChatOverlay` → **`freeExploreSendHandlerAvailable: false` (forced)** |
| Handlers | **None** — `Workbench` has `OrvekDataProvider` only |
| UI gate | `canSend` requires `freeExploreSendHandlerAvailable === true` **and** `exploreHandlers?.onSend` |
| Transcript | `hasLiveExploreChatFromProvider` when session gate passes; else reference pair |
| Composer draft | **`localDraft` only** at UI (provider `composerDraft` ignored for display) |
| Grounding / movement / live-detection | Reference-safe when live; production fields withheld in merge |

---

## 1. Which hook/API currently sends Explore messages?

**Primary production send hook:** `components/orvek-workbench/useOrvekExploreChat.ts`

| API | Method | Purpose |
|-----|--------|---------|
| `GET /api/session?surfaceType=explore_chat` | via `buildAppSessionListUrl` | List sessions |
| `POST /api/session` | `createSession()` | Create `explore_chat` session |
| `GET /api/message/list?sessionId=` | `loadMessages()` | Hydrate transcript |
| **`POST /api/message`** | **`sendMessage()`** | Stream assistant reply |
| `POST /api/session/title` | fire-and-forget after send | Auto-title session |

`sendMessage(overrideContent?)`:
- Optimistic temp user + empty assistant rows (`tmp-*` ids)
- Streams response body chunks into assistant temp row
- Reconciles via `loadMessages(sessionId)` on success/failure
- Guards: no-op if empty content, no session, or `isSending`

**Root hybrid hook today:** calls `useOrvekExploreChat({})` but **does not destructure** `sendMessage`, `setDraft`, or `cancelSend`.

**Legacy path:** `OrvekExplorePage` → full hook + handlers → `void sendMessage()` / `void sendMessage(prompt)`.

---

## 2. Legacy `/explore` handler behavior

**Route:** `app/(root)/(routes)/explore/page.tsx` → `OrvekExplorePage`

```
useOrvekExploreChat({})
  → buildExploreProductionDataApi({ messages, draft, isBooting, isSending, errorMessage, … })
  → handlers.explore:
       onDraftChange: setDraft
       onSend: () => void sendMessage()
       onQuickPrompt: (prompt) => void sendMessage(prompt)
       onTabChange/onOpenInspector/onComposerFocus: no-ops
  → OrvekV0PageShell (OrvekDataProvider + OrvekPageHandlersProvider + ProductionInspectorBridge)
  → ExplorePage (same reference component as root)
```

| Concern | Legacy behavior |
|---------|-----------------|
| **Session creation** | Boot effect: list sessions → restore localStorage `mindlabs:explore:session-id` → create if none |
| **Draft** | Hook-owned `draft` / `setDraft`; passed as `composerDraft` in data API |
| **Send** | `sendMessage()` clears draft; `sendMessage(prompt)` sends without clearing draft first |
| **Quick prompt** | Calls `sendMessage(prompt)` directly (bypasses draft field) |
| **Streaming** | Raw text chunks appended in hook state; empty assistant row while streaming |
| **Errors** | `errorMessage` on hook; failed send reconciles or drops assistant temp row |
| **Cancel** | `cancelSend()` aborts fetch; **not wired** in OrvekExplorePage handlers |
| **displayContract** | `buildExploreProductionDataApi` — **not used** on root hybrid path (avoid) |

**Runtime note:** Under hard swap, this route is **not the live Explore entry** — sidebar `setPage("explore")` uses root shell.

---

## 3. Root hard-swapped path — missing handler wiring

**Active path:**

```
AppShell
  → OrvekWorkbenchShell
  → useOrvekHybridWorkbenchDataApi()   // read-only chat destructure
  → Workbench dataApi={hybridApi}      // NO handlers prop, NO OrvekPageHandlersProvider
  → ExplorePage → FreeExplore
```

**What must be added (implementation — not done here):**

| Location | Missing piece |
|----------|---------------|
| `OrvekWorkbenchShell` or `Workbench` | `OrvekPageHandlersProvider` wrapping layout (mirror `OrvekV0PageShell` pattern) |
| `useOrvekHybridWorkbenchDataApi` | Destructure `sendMessage`, `setDraft`; build `handlers.explore` |
| `buildFreeExploreChatProductionDataApi` call | `sendHandlerAvailable: true` when send gate passes |
| `mergeFreeExploreChatOverlay` | Stop forcing `false` when explicit send slice allows `true` |
| `FreeExplore` (follow-on UI slice) | Bind displayed draft to provider when handlers enabled; streaming row presentation |

**Recommended mount point:** Extend `Workbench` with optional `handlers?: OrvekPageHandlers` and wrap `Layout` in `OrvekPageHandlersProvider` — keeps reference route (`<Workbench />` mock-only) unchanged unless handlers passed.

---

## 4. What FreeExplore expects (composer / draft / send)

From `components/orvek-v0/pages/explore.tsx` — `FreeExplore()`:

| Input | Source | Send-disabled today |
|-------|--------|---------------------|
| `freeExploreSendHandlerAvailable` | `OrvekDataApi` | `false` (forced) |
| `exploreHandlers` | `useOrvekPageHandlers().explore` | `{}` (no provider) |
| `exploreView?.isBooting/isSending` | merged `explore` props | wired from hook |
| `exploreView?.composerDraft` | provider | **not used for display** |
| `composerDraft` | **`localDraft` state only** | local-only typing |
| `canSend` | `freeExploreSendHandlerAvailable === true && onSend && !boot/send && draft.trim()` | always false |
| `onDraftChange` | only when `freeExploreSendHandlerAvailable === true` | falls back to `setLocalDraft` |
| `onQuickPrompt` | only when handler flag true | sets local draft only |
| `onSend` | handler click | no-op (disabled) |

**Gap for send enablement:** When handlers mount, UI must display `exploreView?.composerDraft ?? localDraft` (or drop local draft) so `setDraft` from hook stays visible after send clears draft.

---

## 5. Session boot preconditions before send can enable

From `useOrvekExploreChat` boot + presentation gates:

| Precondition | Required for send |
|--------------|-------------------|
| Clerk auth (401-free fetches) | Yes |
| `selectedSessionId` non-null, safe id | Yes |
| `isBooting === false` | Yes |
| No auth/session boot error in `errorMessage` | Yes |
| `isFreeExploreSendHandlerExplicit(api)` | boolean present on API |
| `shouldMergeFreeExploreChatProductionApi` passes | Live transcript path (recommended before enabling send UX) |
| `isSending === false` | To accept new send |
| Non-empty trimmed draft or quick-prompt override | At click time |

Session bootstrap creates session automatically if list empty — **first send may race boot** if user clicks before boot completes (hook no-ops; UI should stay disabled via `isBooting`).

---

## 6. Risk matrix (auth, persistence, streaming, races)

| Risk | Severity | Notes |
|------|----------|-------|
| **401 unauthenticated** | High | Boot sets error; must keep Ask disabled + reference fallback |
| **Session 404 / deleted** | Medium | loadMessages throws; boot error state |
| **Duplicate send** | Medium | Hook guards `isSending`; UI disables composer — retest double-click Ask |
| **Boot vs send race** | Medium | `sendMessage` returns early if no session or boot incomplete |
| **Optimistic temp ids (`tmp-*`)** | Medium | Presentation gate rejects temps unless streaming; merge must allow streaming assistant empty when `isSending` |
| **Abort / navigation away** | Low | `cancelSend` exists but unwired; abort on unmount in hook |
| **localStorage session stickiness** | Low | Stale session id cleared if not in list |
| **POST failure after optimistic UI** | Medium | Reconcile or strip assistant temp; error banner |
| **Draft desync** | **High** | UI uses `localDraft` only — send would clear hook draft but input would still show local text |
| **Stream raw chunks in UI** | Medium | `FreeExplore` filters `content.trim().length > 0` — **hides streaming assistant entirely** until text arrives |
| **Reconcile overwrite during stream** | Low | `loadMessages` only after stream completes |
| **Background side effects** | High (product) | POST triggers profile derivation, contradiction detection, candidate bridge for `explore_chat` |

---

## 7. POST `/api/message` write path and side effects

**Auth:** Clerk `userId` required (401 if missing)

**Sync path (before stream):**
- Validate `sessionId`, `content`, optional `model`, `responseMode`
- Verify session belongs to user
- **Persist user message** to DB immediately
- Build system prompt from memory, references, contradictions, transcript
- Return **`streamText` → `toTextStreamResponse()`** (raw text stream)

**Async (`after()` background):**
- Session memory transcript + vector upsert
- Weekly audit
- **`processNativeUserMessageForProfile`** for `explore_chat` surface
- Contradiction detect + materialize (if content ≥ 15 chars)
- Native pattern derivation trigger
- **App-message candidate bridge** → internal user-map candidates (understanding dark engine)

**On stream finish:**
- Persist assistant message to DB + memory vectors

**Implication:** Enabling send on Free Explore is **real persistence**, not UI-only — evidence gates for grounding/movement still apply separately.

---

## 8. Ask/send disabled/enabled representation in hybrid provider

**Current contract (read-only):**

```typescript
// useOrvekHybridWorkbenchDataApi
sendHandlerAvailable: false  // always in builder

// mergeFreeExploreChatOverlay
freeExploreSendHandlerAvailable: false  // forced regardless of upstream
```

**Recommended enablement contract:**

| Field | Read-only | Send enabled |
|-------|-----------|--------------|
| `freeExploreSendHandlerAvailable` | `false` (explicit) | `true` (explicit only when handler slice active) |
| `exploreHandlers.onSend` | absent | bound to `() => void sendMessage()` |
| `exploreHandlers.onDraftChange` | absent | `setDraft` |
| `exploreHandlers.onQuickPrompt` | absent | `(p) => void sendMessage(p)` |
| Hybrid merge | forces false | passes normalized flag **only if** send gate function passes |

**Dual gate (recommended):**

1. **Provider flag:** `freeExploreSendHandlerAvailable === true`
2. **Handler presence:** `Boolean(exploreHandlers?.onSend)`

UI already requires both (`canSend` in `FreeExplore`). Keep both — prevents orphan handlers or orphan flags.

**Do not** use `displayContract: production` for send enablement.

---

## 9. Composer draft synchronization

| State | Owner today | On send |
|-------|-------------|---------|
| Hook `draft` | `useOrvekExploreChat` | Cleared on send (non-override) |
| Provider `explore.composerDraft` | built from hook draft | Updates with hook |
| UI `localDraft` | **FreeExplore display source** | **Not cleared** — **BUG if send enabled without UI fix** |

**Recommendation (implementation slice):**

When `freeExploreSendHandlerAvailable === true`:
- Display: `exploreView?.composerDraft ?? ""` (provider-owned)
- Remove parallel `localDraft` for composer OR sync `localDraft` from `exploreView.composerDraft` via `useEffect`
- Quick prompts: keep calling `onQuickPrompt` → `sendMessage(prompt)` (legacy pattern)

Reference route (`createMockOrvekDataApi`, no handlers): keep local draft behavior.

---

## 10. Streaming partial assistant without raw chunks

**Hook behavior:** Appends decoded stream strings to assistant temp message `content`.

**Presentation pipeline:**

- `buildFreeExploreChatProductionDataApi({ isSending: true })` → allows empty final assistant row in normalized messages
- `isFreeExploreChatMessagePresentationReady` → permits empty streaming assistant when `allowStreamingAssistantEmpty`
- **`FreeExplore` today:** `liveMessages.filter(m => m.content.trim().length > 0)` → **streaming bubble hidden**

**Recommendation (implementation slice — minimal):**

When `exploreView?.isSending` and last message is empty orvek:
- Show `Bubble` with thinking/typing indicator (reuse pattern from legacy `V0ExploreView` / `ThinkingIndicator`) — **not** raw chunk text
- Or show partial normalized content only after `normalizeFreeExploreChatContent` passes (no JSON/raw leak)

Never surface pre-normalization stream artifacts or temp ids in UI copy.

---

## 11. Grounding / movement / review / live-detection withholding

| Field | Merge policy today | Until real contract |
|-------|-------------------|---------------------|
| `exploreGrounding` | Not merged from chat overlay; FreeExplore uses reference zip when live grounding empty | Keep reference `EXPLORE_GROUNDING` |
| `exploreMovement` | Not merged | Reference movement CTA copy when !live |
| `exploreLiveDetectionCopy` | Stripped in normalize | `V0_EXPLORE_LIVE_DETECTION_COPY` when live |
| Fake “4 places” movement | Reference-only branch | Keep when !`hasLiveExploreChat` |
| `displayContract` | Rejected by gate | Never on hybrid root |

**Send enablement must not** auto-merge grounding/movement from POST side effects — separate evidence-backed slices required.

---

## 12. Tests required before enabling send

| Test file | Assertions |
|-----------|------------|
| `free-explore-chat-hybrid-fetch.test.ts` | Hook exposes handlers + `sendHandlerAvailable: true` only in send slice; `sendMessage` wired |
| `hybrid-workbench-api.test.ts` | Merge passes `freeExploreSendHandlerAvailable: true` when gate allows; still false when boot/auth fail |
| `free-explore-chat-presentation-readiness.test.ts` | Streaming assistant empty allowed when `isSending`; temp ids gated |
| `free-explore-chat-tab-alignment.test.ts` | Ask enabled only when flag + handler; disabled on auth error |
| **New:** `free-explore-chat-send-handler.test.ts` | Shell mounts `OrvekPageHandlersProvider`; handlers call hook; no send when `isBooting`/`isSending` |
| `explore-tab-visual-regression.test.ts` | Unaffected (tab strip) |
| `shell-quarantine.test.ts` | Root still reference shell; legacy route quarantined |
| Integration (optional) | Mock `POST /api/message` stream — optimistic UI + reconcile |

Existing test **must flip intentionally:** `"does not enable send from overlay even when upstream marks handler availability true"` → becomes conditional pass when send slice lands.

---

## 13. Smallest safe implementation slice (recommended order)

### Slice E1 — Handler mount (send still disabled)

**Files:** `components/orvek-v0/workbench.tsx`, `components/orvek-workbench/OrvekWorkbenchShell.tsx`  
**Allow:** Optional `handlers` prop; `OrvekPageHandlersProvider` wrap  
**Keep:** `sendHandlerAvailable: false`, merge force false  
**Verify:** Reference route unchanged; tests prove provider mounts at root with no-op handlers

### Slice E2 — Enable provider send flag + hook wiring

**Files:** `useOrvekHybridWorkbenchDataApi.ts`, `hybrid-workbench-api.ts` (`mergeFreeExploreChatOverlay`)  
**Allow:** Destructure `sendMessage`/`setDraft`; build explore handlers; `sendHandlerAvailable: true` when:
  - session boot complete
  - safe session id
  - no auth error
  - explicit send slice flag / gate function  
**Keep:** merge rejects true when boot/auth/malformed  
**Verify:** hybrid + fetch tests updated

### Slice E3 — FreeExplore draft + streaming presentation (minimal UI)

**Files:** `components/orvek-v0/pages/explore.tsx` — `FreeExplore` only  
**Allow:** Provider draft binding when flag true; thinking indicator during `isSending` empty assistant; do not show raw chunks  
**Forbidden:** Tab strip, other Explore tabs, bridges  
**Verify:** tab-alignment + new send-handler tests

### Slice E4 — Product-owner visual check + cancel send (optional)

Wire `cancelSend` if needed; manual QA on root only.

---

## Handler / provider contract recommendation

```typescript
// useOrvekHybridWorkbenchDataApi (conceptual)
const { draft, setDraft, sendMessage, isBooting, isSending, … } = useOrvekExploreChat({});

const sendEnabled =
  !isBooting &&
  !exploreChatErrorMessage?.match(/401|sign in/i) &&
  Boolean(exploreChatSessionId);

const freeExploreChatApi = buildFreeExploreChatProductionDataApi({
  …,
  composerDraft: draft,
  sendHandlerAvailable: sendEnabled && HANDlers_MOUNTED,
});

const handlers = useMemo(() => ({
  explore: sendEnabled ? {
    onDraftChange: setDraft,
    onSend: () => { void sendMessage(); },
    onQuickPrompt: (p) => { void sendMessage(p); },
    onComposerFocus: () => {},
  } : undefined,
}), [sendEnabled, setDraft, sendMessage]);
```

```typescript
// mergeFreeExploreChatOverlay — send slice only
freeExploreSendHandlerAvailable: normalized.freeExploreSendHandlerAvailable ?? false,
// never pass through true unless upstream gate explicitly set it
```

---

## Visual check required for implementation?

**Yes — mandatory before commit** when Slice E3 lands.

Verify on root (`/`) Free Explore only:

- [ ] Ask disabled during boot / auth error
- [ ] Ask enables when session ready + flag true
- [ ] Draft clears after send; text not stuck (provider sync)
- [ ] Quick prompt sends without duplicate
- [ ] Streaming shows thinking indicator, not raw chunks or temp ids
- [ ] Double-click Ask does not duplicate (disabled while `isSending`)
- [ ] Error banner on failure; transcript reconciles
- [ ] Grounding still reference-safe; no fake “4 places” when live
- [ ] Reference route `/dev/orvek-v0-reference` — Ask still disabled (no handlers / mock only)

---

## Audit answers (quick reference)

| # | Question | Answer |
|---|----------|--------|
| 1 | Send hook/API | `useOrvekExploreChat.sendMessage` → `POST /api/message` |
| 2 | Legacy `/explore` | Full hook + `OrvekV0PageShell` handlers (shadowed) |
| 3 | Root missing | `OrvekPageHandlersProvider`, handler wiring, merge flag pass-through |
| 4 | FreeExplore expects | Dual gate flag + handlers; local draft today |
| 5 | Boot preconditions | Auth, session id, !booting, !auth error |
| 6 | Risks | Auth, duplicate send, draft desync, streaming UI, real POST side effects |
| 7 | POST side effects | DB messages, memory, profile, contradictions, candidates, stream |
| 8 | Provider representation | `freeExploreSendHandlerAvailable` explicit boolean + handlers |
| 9 | Draft sync | Must bind provider draft when enabled — current local-only is insufficient |
| 10 | Streaming UI | Allow empty assistant in merge; UI needs thinking row, not chunk dump |
| 11 | Grounding/movement | Keep withheld / reference-safe |
| 12 | Tests | hybrid-fetch, hybrid-api, presentation, new send-handler test |
| 13 | Smallest slice | E1 handler mount → E2 flag+wiring → E3 draft/stream UI |

---

## Production readiness

**Not production-ready for send.** Read-only transcript path is gated and tested; write path exists in legacy hook but is blocked at root by design.

**Do not commit** send enablement until E1–E3 + PO visual check pass.
