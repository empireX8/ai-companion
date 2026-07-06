# 00 Post-Send Side-Effect Audit — Free Explore

**Slice:** `DESKTOP-FREE-EXPLORE-POST-SEND-SIDE-EFFECT-AUDIT-001`  
**Branch:** `desktop-free-explore-post-send-side-effect-audit-001`  
**Baseline:** `staging` @ `4ab3e4d` (after PR #96 — Wire Free Explore send draft stream gate)  
**Classification:** **PASS WITH NARROW PATCH**  
**Production-ready:** **NO**

---

## What was audited

Post-send UI honesty and side-effect boundaries for root hard-swapped Free Explore after E2/E3 send enablement:

- `components/orvek-v0/pages/explore.tsx` (FreeExplore transcript, grounding, movement CTA, live detection)
- `components/orvek-workbench/useOrvekExploreChat.ts` (POST send, reconcile, error paths)
- `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts` (handler wiring, overlay merge)
- `components/orvek-workbench/OrvekWorkbenchShell.tsx` (root shell path)
- `lib/orvek-v0/production/free-explore-chat-api.ts`
- `lib/orvek-v0/production/free-explore-chat-presentation.ts`
- `lib/orvek-v0/production/hybrid-workbench-api.ts`
- `components/orvek-v0/workbench.tsx`, reference route, legacy `/explore` quarantine
- Existing send/draft/stream tests

---

## Audit questions — findings

### 1. False side-effect claims after send?

| Claim | Finding |
|-------|---------|
| Model changed | **No false claim.** Movement CTA copy is hedged: “Review **possible** model movement in the inspector.” Does not assert change occurred. |
| Evidence saved / receipts created | **One leak found (patched).** Live chat path with empty `exploreGrounding` previously fell back to reference `EXPLORE_GROUNDING` mock chips — falsely implying linked evidence. Patched to use reference grounding **only** when `!hasLiveExploreChat`. |
| Map / timeline / decisions / fieldwork / investigations updated | **No leak.** `useOrvekExploreChat` send path only POSTs `/api/message`, streams/reconciles messages, optionally POSTs `/api/session/title`. Hybrid hook does not pass `onConversationUpdated` or map/timeline/decision adapters on send. |
| Live detection | **Honest when live.** Uses `V0_EXPLORE_LIVE_DETECTION_COPY` (“No live model signal detected yet.”). Reference mock receipt copy only when not live. |

### 2. Raw stream artifacts / tmp IDs / empty assistant rows?

| Check | Finding |
|-------|---------|
| Raw stream chunks in UI | **Blocked.** `bubbleMessages` content-only filter; presentation normalizers reject raw JSON/error blobs. |
| tmp-* IDs in normalized transcript | **Stripped** on reconcile via `normalizeFreeExploreChatMessage`; in-flight tmp-user allowed only during send gate. |
| Empty assistant bubbles | **Not rendered.** Empty streaming assistant excluded from `bubbleMessages`; inline `Thinking…` row used instead. |
| `pending-user-local` | Local optimistic ID only; reconciled when provider user message appears. |

### 3. Old route / shell / legacy `/explore`?

**No leak.** Root `AppShell` → `OrvekWorkbenchShell` → hybrid `Workbench`. Legacy `/explore` route still mounts `OrvekExplorePage` but is shadowed (shell voids children). Old `RouteTopBar` / production shell not restored.

### 4. Root `/` hard-swapped Workbench?

**Yes.** `components/layout/AppShell.tsx` mounts `OrvekWorkbenchShell` with hybrid data API + handlers.

### 5. `/dev/orvek-v0-reference` mock-only, send-disabled?

**Yes.** `<Workbench />` only — default mock API, no hybrid hook, no handlers prop.

### 6. Free Explore remains honest as chat/exploration?

**Yes after patch.** Live path shows empty grounding intro when no backed evidence; honest live-detection copy; hedged movement review CTA. No fake movement/receipt fields in production chat overlay (`exploreGrounding: []`, `exploreMovement: []`).

### 7. Misleading labels/badges/links after send?

| Element | Finding |
|---------|---------|
| Grounding chips (live) | **Was misleading — patched.** |
| Inspector Model Movement “From this conversation” | **Was misleading — patched.** Mock `EXPLORE_MOVEMENT` cards gated to reference-only; live chat shows empty copy. |
| Movement center CTA button | Hedged “possible” — acceptable. **Not changed.** |
| Live detection line | Honest when live. |
| Page intro copy | Aspirational (“turn conversation into model movement”) — page-level, not post-send receipt claim. **Not changed.** |

---

## Code changed?

**Yes — narrow patches.**

| File | Change |
|------|--------|
| `components/orvek-v0/pages/explore.tsx` | `useReferenceGrounding = !hasLiveExploreChat` (no reference chip fallback during live send) |
| `lib/orvek-v0/production/hybrid-workbench-api.ts` | `mergeFreeExploreChatOverlay` passes through empty `exploreGrounding` / `exploreMovement` / stripped live-detection from chat overlay (prevents base mock bleed) |
| `components/orvek-v0/evidence-panel.tsx` | Inspector Model Movement: reference mock proposals only when `!hasLiveExploreChat`; live chat shows honest empty copy |
| `lib/explore-surface.ts` | Added `EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY` |

**Tests added/updated:**

| File | Change |
|------|--------|
| `lib/__tests__/free-explore-post-send-side-effect-audit.test.ts` | **Added** — 9 audit tests |
| `lib/__tests__/free-explore-chat-tab-alignment.test.ts` | Updated grounding honesty assertion |
| `lib/__tests__/hybrid-workbench-api.test.ts` | Updated merge expectations for cleared grounding/movement |

---

## Preserved E2/E3 send behavior (unchanged)

- Send handler wiring
- Draft sync / pending user message
- Transcript preservation
- Ordering: user bubble → Thinking… → assistant response
- Duplicate-send guard
- Reference route send-disabled
- Shell / legacy quarantine

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| Vitest (6 files, 75 tests) | PASS |

---

## Runtime check required before commit

PO must verify after grounding + inspector movement patches:

1. Root → Explore → Free Explore → send a message.
2. After send, **Grounded in** shows empty-state copy (not reference mock chips) when no backed grounding exists.
3. Live detection shows “No live model signal detected yet.” (no fake receipt line).
4. Movement CTA still says “Review possible model movement…” (hedged).
5. Inspector → **Model Movement**: shows honest empty copy — **not** mock “From this conversation” proposal cards (Receipt extracted, Context Profile update, etc.).
6. Reference route (`/dev/orvek-v0-reference`) → Explore → Inspector → Model Movement may still show reference proposal cards.
7. Send ordering unchanged: user → Thinking… → assistant.
8. Reference route Ask still disabled.
9. No raw chunks / tmp IDs visible in transcript.

---

## Production-ready

**NO** — chat send path is enabled but post-send model/evidence/receipt side effects are not implemented; audit confirms UI must not imply they occurred.
