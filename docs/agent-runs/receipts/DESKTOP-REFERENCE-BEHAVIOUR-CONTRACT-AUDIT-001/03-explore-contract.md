# Explore Behaviour Contract

**Baseline:** `8938091`  
**Surfaces:** `components/orvek-v0/pages/explore.tsx`, `components/orvek-v0/evidence-panel.tsx` (Movement tab when Explore active)

---

## Explore page structure

| Tab | Accepted role |
|-----|---------------|
| Free Explore | Model-aware chat + grounding + movement review CTA |
| Investigations | Investigation list (live-gated when hybrid merges) |
| Active Questions | Question list (live-gated when hybrid merges) |
| Fieldwork Bridge | Watch-for / fieldwork rows |

Explore sets `exploreActive = true` on mount — Inspector shows Live badge and Explore-specific Movement layers.

---

## Free Explore — reference path (no live chat session)

**Gate:** `!hasLiveExploreChatFromProvider(data)`

| Element | Accepted behaviour |
|---------|-------------------|
| Messages | `REFERENCE_FREE_EXPLORE_MESSAGES` (fixed user/orvek exchange) |
| Grounded in | Reference chips from `EXPLORE_GROUNDING` (`d1`, `m-claim-1`, `r6`, etc.) — clickable → `select` |
| Live detection line | Reference copy: "Orvek is reading the model · 1 receipt extracted · 1 question detected" (animated pulse) |
| Movement CTA | "This may update your model in **4 places**. Review and confirm in the inspector." + **Open** |
| CTA click | `setInspectorTab("movement")` only — does not auto-select unrelated Today object |
| Composer | Local draft; send disabled unless `freeExploreSendHandlerAvailable` (false on reference route) |
| Inspector Movement | Shows **From this conversation** mock proposals + reference Grounded in |

---

## Free Explore — live root path (hybrid workbench)

**Gate:** `hasLiveExploreChatFromProvider(data)` (session ready, send handler explicit, no fake leak)

| Element | Accepted behaviour |
|---------|-------------------|
| Messages | Live `exploreMessages` from provider (normalized; no tmp IDs) |
| Grounded in | **Empty** with honest copy: "Grounding chips appear when linked evidence is available." — **no** `EXPLORE_GROUNDING` mock chips |
| Live detection | `V0_EXPLORE_LIVE_DETECTION_COPY` = "No live model signal detected yet." |
| Movement CTA (text) | "Review possible model movement in the inspector." + **Open** |
| CTA click | `setInspectorTab("movement")` |
| Inspector Movement | **No** reference "From this conversation" block |
| Inspector Movement | Shows `EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY` when no `exploreMovement` |
| Inspector Movement | **Still shows** global Recent model movement (`mu-1`–`mu-3`) + report button (accepted staging) |
| Send | Wired via `useOrvekHybridWorkbenchDataApi` → `POST /api/message` (not modified in this audit) |
| Thinking row | Shows while sending until assistant content arrives |

### PR #97/#99 honesty guarantees (must-not-regress)

1. **No mock Grounded In chips** in live root chat (`useReferenceGrounding = !hasLiveExploreChat`).
2. **No fake FROM THIS CONVERSATION** movement proposals when live chat active.
3. **No fake** `exploreMovement`, `exploreGrounding`, or `exploreLiveDetectionCopy` leaked from production chat overlay merge (`normalizeFreeExploreChatProductionDataApi` strips them).
4. **No** raw stream/tmp message artifacts in UI.
5. Send ordering: pending user bubble → thinking → assistant reply.

---

## Current-conversation movement CTA contract

| State | Accepted CTA behaviour |
|-------|------------------------|
| Reference Explore | Opens Inspector Movement → reference conversation proposals (clearly labelled "From this conversation") |
| Live Explore, no movement | Opens Inspector Movement → honest empty copy for this conversation |
| Live Explore, with movement | (Not present in accepted staging — `exploreMovement` stripped at overlay; future slice must wire real proposals before CTA claims movement) |

**Anti-regression (failed slice lesson):** Live CTA must **not** route users to unrelated Today/global movement **as if** it came from the current chat. In accepted staging, global recent movement appears **below** the conversation-empty note — labelling/separation must remain clear.

**Future requirement:** If CTA remains actionable in live mode with no conversation movement, it must open only the honest empty state — not a panel dominated by unrelated fixtures without context.

---

## Reference route contract (`/dev/orvek-v0-reference`)

| Rule | Accepted state |
|------|----------------|
| Data | `createMockOrvekDataApi()` only — no hybrid hook |
| Handlers | None — no `freeExploreSendHandlerAvailable` |
| Send | Disabled (`canSend` false) |
| Explore | Full reference transcript + mock grounding + mock movement CTA |
| Purpose | Visual/behaviour reference for v0 workbench — mock-only |

**Must-not-regress:** Reference route must never gain live send or hybrid provider wiring without explicit new phase.

---

## Explore sub-tabs (accepted staging smoke)

| Tab | Reference fallback | Live merge when ready |
|-----|-------------------|----------------------|
| Investigations | Reference investigation rows | Hybrid merges `exploreInvestigationIds` when readiness passes |
| Active Questions | Reference questions | Hybrid merges when readiness passes |
| Fieldwork Bridge | Reference fieldwork (`f2` fallback id) | Hybrid merges experiment/watch-for when readiness passes |

Sub-tab live parity is **P1** (not blocking reference contract). Reference fallback copy and deferred actions remain acceptable until live lists ready.

---

## Must-not-regress list (Explore)

1. Live chat: no reference `EXPLORE_GROUNDING` chips.
2. Live chat: no reference `EXPLORE_MOVEMENT` "From this conversation" block in Inspector.
3. Live chat: honest empty copy when no conversation movement.
4. Reference route: mock-only, send disabled.
5. Grounding chips (when shown) open Inspector via `select(id)`.
6. Movement CTA always uses `setInspectorTab("movement")` — never `router.push`.
7. Free Explore tab strip and composer disabled states preserved during boot/send.
8. Hybrid overlay must not re-introduce fake grounding/movement/live-detection fields.

---

## Cross-links

- Today → Explore: Inspector "Ask in Explore" button; Today does not embed Explore movement.
- Explore → Inspector: Movement CTA and grounding chips.
- Explore → Today global movement: Inspector recent list is shared chrome — separation copy must stay honest.

**Production-ready: NO**
