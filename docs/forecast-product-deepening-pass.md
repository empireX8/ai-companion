# Forecast Product Deepening Pass

*Written 2026-03-09. Planning only — no code changes.*

---

## 1. What Is Already Done

### Schema (`prisma/schema.prisma`)
- `Projection` model: `id`, `userId`, `premise`, `drivers String[]`, `outcomes String[]`, `confidence Float`, `status ProjectionStatus`, `sourceSessionId`, `sourceMessageId`, `createdAt`
- `ProjectionStatus` enum: `active | archived`
- Indexes on `[userId, createdAt]` and `[userId, status]`

### API layer
| Route | Capability |
|---|---|
| `POST /api/projection/create` | Create from chat capture; validates premise, drivers[], outcomes[], confidence (0–1), source provenance |
| `GET /api/projection/list` | Returns `status=active` forecasts for user, ordered by `createdAt desc` |
| `GET /api/projection/[id]` | Single record fetch (any status) |
| `PATCH /api/projection/[id]` | Only supports `action: "archive"` — idempotent |
| `DELETE /api/projection/[id]` | Hard delete with confirmation |

### Context injection (`lib/forecast-memory.ts`)
- Fetches up to 30 active forecasts; scores each by token overlap (premise + drivers + outcomes vs. current turn)
- Minimum overlap threshold of 1; sorts by score; caps at `maxItems` (2 standard / 4 deep)
- System prompt prefix: `"Active forecasts (user's stated predictions — treat as informative context)"`
- Injects premise + drivers + outcomes + confidence% per item

### UI surfaces
- `ProjectionListPanel`: search by premise, confidence badge (colored by tier), creation date; active-only; empty state pointing to chat capture
- Detail page (`/projections/[id]`): premise, drivers, outcomes, confidence badge, archive icon button, delete icon button, "View source conversation" link
- Chat capture form: 5 fields — premise (pre-filled from message), drivers textarea, outcomes textarea, confidence slider; wired to `POST /api/projection/create`
- Capture success label: "Saved as forecast" ephemeral inline message

### Housekeeping done
- Terminology cleaned: "projection" → "forecast" in all user-facing text
- `ProjectionStatus` migration in place

---

## 2. Current State Categorized

### Foundationally complete
- Data model captures the core semantic structure of a forecast (condition + supporting factors + expected results + subjective confidence)
- Full provenance: created from a specific message in a specific session
- Context injection is live, relevance-gated, and mode-scaled (standard vs. deep)
- The creation path (chat capture) works end-to-end

### Product-thin but acceptable for now
- **List panel** has no count badge, no status filter, no compound "+" button — matches minimum viable domain wiring, consistent with the rest of the layout
- **Confidence injection is flat** — a 10% forecast and a 90% forecast are injected identically; no per-confidence weighting in the prompt
- **Empty state** in the list panel is functional but minimal; does not explain what forecasts *do* for the user
- **GlobalRail** has no badge for forecasts — correct since there are no candidates yet
- **No `updatedAt`** in schema — no tracking of when a forecast was last edited (edit doesn't exist yet, so this is consistent)

### Genuinely missing / next-needed

#### A. No resolution flow (most critical gap)
The only terminal state is "archive" — which semantically means *abandoned*, not *concluded*. There is no way to mark a forecast as resolved and record what actually happened. A forecast surface without resolution is an append-only note list. The value of tracking predictions is that you can look back and assess accuracy. Without resolution, forecasts accumulate without closure. This is the single biggest product gap.

Required to fix:
- New status: `resolved` in `ProjectionStatus` enum
- New fields: `resolvedAt DateTime?`, `resolution String?` (free-text: what actually happened), `resolutionVerdict` enum (`correct | partially_correct | incorrect | inconclusive`)
- `PATCH` endpoint extended to support `action: "resolve"` with `{ resolution, verdict }` payload
- Detail page: "Mark resolved" button → inline form (resolution text + verdict selector)
- Resolved forecasts displayed distinctly in the list (muted, verdict badge)

#### B. Archived forecasts are invisible
`GET /api/projection/list` returns only `status=active`. Once archived, a forecast disappears from all UI surfaces — there is no way to view, unarchive, or review archived items. This is acceptable at very small scale but breaks at any real volume, and makes "archive" feel like deletion.

Required to fix:
- Add `?status=all|active|archived|resolved` query param to list endpoint
- List panel: status filter control (or at minimum a toggle between active and archived views)

#### C. No target date / evaluation horizon
Forecasts have no time axis. A forecast created 6 months ago about "what I expect will happen in Q3" has no way to signal that its evaluation window has passed or is approaching. Without a horizon, forecasts never become "due for review."

Required to fix:
- Optional `targetDate DateTime?` field on the model
- Create form: optional date picker (or natural-language text input)
- List panel: visual age indicator or "overdue for review" signal when `targetDate` is in the past

#### D. No edit capability
Once a forecast is created there is no way to update premise, drivers, outcomes, or confidence. Conditions change; drivers are refined; the user may want to update the confidence as evidence accumulates. Currently the only option is delete + recreate.

Required to fix:
- `PATCH` endpoint extended to support `action: "update"` with `{ premise?, drivers?, outcomes?, confidence? }` payload
- Detail page: inline edit fields or an edit button/modal

---

## 3. Trust and Usability Issues

**The capture form is high-friction.** Opening the forecast capture inline in a chat message exposes 5 fields simultaneously (premise, drivers, outcomes, confidence, plus the mode selector). Drivers and outcomes are optional, but the form renders them unconditionally. Most users will want to capture a premise and confidence quickly; the full form feels like a heavyweight interruption. This likely suppresses use.

**"Archive" is ambiguous.** In every other domain in this app, "archive" means "put away but don't lose." In a forecast context it can mean "I abandoned this prediction" or "I'm tidying up a resolved one." Without a resolution flow, users are using archive for both purposes. This muddies the semantics.

**Confidence is prominent in the list panel.** The confidence badge is the *first* visual element after the premise text (colored green/amber/gray at high prominence). Unlike the reference panel cleanup in Packet E, confidence was not quieted here. For a forecast there is reasonable justification (confidence is load-bearing: it affects injection weighting and is core to the prediction's meaning), but it warrants a deliberate choice.

**No feedback loop.** There is no path from "context injection surfaced a forecast" back to the forecast itself. If the assistant references a forecast during a conversation, the user cannot easily navigate to it, update it, or resolve it from that point.

---

## 4. Recommended Next Implementation Packet

**Packet F — Forecast Resolution and Visibility**

This is the smallest strong next packet. It delivers the one thing that makes the forecast feature conceptually complete: closure.

### F-1 — Resolution flow (blocking gap)
- Migration: add `resolvedAt DateTime?`, `resolution String?`, `resolutionVerdict` enum (`correct | partially_correct | incorrect | inconclusive`) to `Projection`
- Migration: add `resolved` to `ProjectionStatus` enum
- `PATCH /api/projection/[id]`: add `action: "resolve"` branch; accept `{ resolution, verdict }`; set status=resolved, resolvedAt=now
- Detail page: "Mark resolved" button (only when active); opens an inline form (verdict select + resolution textarea); on submit calls patch and updates local state
- Resolved forecasts: detail page shows resolution block (verdict badge + resolution text + resolvedAt date); list panel shows resolved items as muted with a verdict badge

### F-2 — Archived/resolved visibility in list
- `GET /api/projection/list`: add optional `?status=active|archived|resolved|all` param; default stays `active` for backward compat
- List panel: add a status filter control (3-way toggle or select: Active / Archived / Resolved); persist selection in component state
- No schema changes needed

### F-3 — Edit capability (unblocking quality-of-life)
- `PATCH /api/projection/[id]`: add `action: "update"` branch; accept partial `{ premise?, drivers?, outcomes?, confidence? }`; only allowed when status=active
- Detail page: "Edit" button/toggle; inline edit mode for premise + drivers + outcomes + confidence; Cancel / Save buttons; updates local state on success

### F-4 — Optional target date
- Migration: add `targetDate DateTime?`
- Create endpoint and form: add optional target date field (date input)
- List panel: show target date if set; highlight overdue items (past target date, still active)
- Detail page: show target date if set

**Packet F does not include:**
- Auto-detection from conversation
- Candidate flow
- Confidence weighting changes in injection
- Chat capture form redesign
- GlobalRail badge (no candidates exist)

---

## 5. Deferred Items

| Item | Reason for deferral |
|---|---|
| Auto-detection of forecasts from conversation | Requires reliable LLM classification of predictive intent; high false-positive risk; much more complex than the current resolution gap |
| Candidate / confirmation flow | Not needed until auto-detection is live; manually created forecasts should go straight to active |
| Confidence-weighted injection | Current flat injection works; weighting is a refinement, not a correctness issue |
| Chat capture form simplification | UX improvement; doesn't change data model; can be done as a standalone UI polish pass |
| Forecast aging / expiry reminders | Requires a target date field (F-4) first; reminder mechanism requires background jobs or polling |
| Forecast accuracy statistics / history view | Requires resolution data (F-1) first; statistics surface is meaningless without a corpus of resolved forecasts |
| GlobalRail candidate badge | No candidate flow exists; badge would always show 0 |
| `updatedAt` field in schema | Not needed until edit (F-3) is implemented; adds a migration with no current consumer |

---

## 6. Correctness Already Done vs. Product Depth Still Missing

| Layer | Correctness work done | Product depth still missing |
|---|---|---|
| Schema | Premise/drivers/outcomes/confidence/status/provenance — structurally sound | Resolution fields, target date, `updatedAt` |
| API | Create, read, archive, delete — all auth-gated and idempotent where appropriate | Edit, resolve, status-filtered list |
| Context injection | Relevance-gated, mode-scaled, correctly formatted for system prompt | Confidence weighting; no feedback loop to UI |
| List panel | Functional domain wiring, search, active-only | Status filter, count badge, empty-state depth |
| Detail page | Shows all current fields; archive and delete work | Resolution form, edit capability, verdict display |
| Chat capture | End-to-end creation path works | Form is heavy; no quick-capture shortcut |
| Lifecycle | Archive and delete are terminal states | Resolution as a distinct, meaningful terminal state |

The core correctness correctness story is in good shape. What the forecast surface lacks is not correctness — it is the **semantic completion** of the prediction lifecycle. A prediction that cannot be resolved or reviewed is a forecast in name only.
