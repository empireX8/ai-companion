# 02 Send / Draft / Stream Wiring (Slice E2/E3)

**Slice:** `DESKTOP-FREE-EXPLORE-CHAT-SEND-HANDLER-AUDIT-001` — E2/E3 send/draft/stream wiring  
**Branch:** `desktop-free-explore-send-draft-stream-001`  
**Mode:** First conservative production write path for root hard-swapped Free Explore only

---

## PO runtime outcome

| Pass | Detail |
|------|--------|
| CODE PASS | Typecheck, trust scripts, vitest |
| FUNCTIONAL SEND PASS | POST send works end-to-end |
| **UX-RUNTIME QUALITY FAIL (initial)** | Draft vanished, transcript blanked during send, user text reappeared late with response; thinking indicator too subtle |
| **UX refinement applied** | Pending user bubble, transcript preservation, clearer thinking indicator, error draft restore |

**Do not commit until PO re-runs visual/runtime check.**

---

## Summary

Root production shell passes real Free Explore handlers when session send readiness passes. Ask/send enables only behind the dual gate (`freeExploreSendHandlerAvailable === true` **and** `exploreHandlers.onSend`).

**UX refinement (post-PO feedback):** Send now shows an immediate pending user bubble, preserves the last stable transcript during in-flight send (no reference fallback flicker), displays a clearer **“Orvek is thinking…”** indicator, and restores draft text on failure.

---

## What changed

### Initial E2/E3 (functional send)

- `useOrvekHybridWorkbenchDataApi` — handler wiring, `exploreChatSendReady`, returns `{ dataApi, handlers }`
- `OrvekWorkbenchShell` — `handlers={handlers}`
- `hybrid-workbench-api` — pass-through `freeExploreSendHandlerAvailable`
- `free-explore-chat-presentation` — `isFreeExploreChatSessionSendReady`
- `FreeExplore` — draft sync, streaming indicator, Enter gate

### UX refinement (runtime quality)

#### `lib/orvek-v0/production/free-explore-chat-presentation.ts`

- `areFreeExploreChatMessagesLiveReady()` — allows pending tmp-user + streaming assistant during `isSending`
- `hasLiveExploreChatFromProvider` — uses in-flight message rules (fixes transcript fallback to reference during send)
- `isFreeExploreChatMessagePresentationReady` — explicit pending-user support

#### `lib/orvek-v0/production/free-explore-chat-api.ts`

- `mapInputMessagesToExploreMessages` — includes pending tmp-user messages during send

#### `components/orvek-v0/pages/explore.tsx` — **FreeExplore only**

- Local `pendingUserMessage` + `handleSend` — immediate optimistic user bubble before server reconcile
- `lastStableLiveMessagesRef` — preserves transcript when provider gate flickers
- Clearer `ThinkingIndicator`: **“Orvek is thinking…”** with `role="status"` / `aria-live="polite"`
- Fallback thinking bubble when assistant placeholder not yet in list
- Error effect restores draft via `onDraftChange` when send fails

#### `components/orvek-workbench/useOrvekExploreChat.ts`

- On send failure: restore `draft` from submitted content; remove both temp user/assistant rows if reconcile fails

---

## Policy confirmation

| Item | Status |
|------|--------|
| First E2/E3 functionally sent but failed UX runtime quality | **Acknowledged — refined** |
| Immediate pending user message on Ask | **Yes** |
| Transcript no longer blanks during send | **Yes** |
| Thinking indicator clear enough | **Yes** — “Orvek is thinking…” |
| Draft does not vanish into nowhere | **Yes** — pending bubble visible before/at draft clear |
| Duplicate sends blocked | **Yes** — `isSending` + `canSend` + hook guard |
| Failure preserves user text | **Yes** — hook draft restore + FreeExplore error effect |
| Reference route send-disabled | **Yes** |
| POST `/api/message` changed | **No** |
| Other surfaces changed | **No** |

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| Vitest (9 files, 155 tests) | PASS |

---

## Visual / runtime check required before commit

**PO must re-verify after UX refinement.**

1. Sign in → root workbench → **Explore → Free Explore**.
2. Type a question and press **Ask**.
3. **Immediately** see your message as a user bubble (no blank transcript gap).
4. Composer may clear, but your text must remain visible in the transcript.
5. **Thinking…** inline row (restrained `o-breathe` dot, no bubble chrome) appears **directly below** your user message — not above it.
6. Assistant response replaces/removes the thinking row cleanly — no raw chunks or empty assistant bubble.
7. Ask stays disabled while in-flight; repeated Enter/Ask does not duplicate.
8. On network failure (if testable): draft/text restored, error shown — not silently lost.
9. `/dev/orvek-v0-reference` → Ask remains disabled.
10. Fieldwork Bridge / Active Questions / Investigations unchanged.

---

### UX refinement — thinking row ordering + inline pending style (post-PO feedback)

PO found the thinking placeholder appeared **above** the just-sent user message and used full assistant bubble chrome. Fixed:

| Item | Status |
|------|--------|
| Thinking row ordering bug | **Fixed** — user bubble first, thinking row after latest user turn |
| Removed thinking speech-bubble/card chrome | **Yes** — inline row, not `Bubble` |
| Restrained inline Orvek pending-response style | **Yes** — `o-breathe` dot + muted “Thinking…” |
| Pending/send/transcript behavior preserved | **Yes** |

Render order: stable/live bubbles → pending user (if needed) → inline thinking row (while in-flight, no assistant content yet).

---

## Commit status

**Not committed** — awaiting PO visual/runtime re-check.
