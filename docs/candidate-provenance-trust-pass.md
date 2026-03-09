# Candidate Provenance and Trust Pass

*Written 2026-03-09. Planning only — no code changes.*

---

## 1. Scope and Framing

This document assesses the current candidate review experience — how well a user can understand *why* a candidate memory or tension appeared, whether it feels earned, and what trust signals are present or absent. The candidate lifecycle itself is stable and is not under review here.

**The core trust question is:** when a user lands on a candidate card, can they tell why the system proposed it — and can they make an informed confirm/dismiss decision without navigating elsewhere?

---

## 2. Current State Audit

### 2a. What candidate memory cards currently show

Source: `app/(root)/(routes)/references/candidates/page.tsx`

Each card renders:
- The statement text
- `"Detected on [createdAt date]"` — date-only provenance
- Type badge (Goal, Preference, Constraint, etc.)
- Confidence badge (Low / Medium / High)
- Confirm / Dismiss action buttons

**What the page does NOT show** (exists in DB but not fetched by this page):
- `sourceSessionId` — which session generated this candidate
- `sourceMessageId` — which specific message triggered it
- `supersedesId` — whether this candidate would *replace* an existing active memory and what that memory says

This omission is architectural: the page calls `fetchReferences()` which maps to `GET /api/reference` returning `ReferenceListItem[]`. `ReferenceListItem` does not include `sourceSessionId`, `sourceMessageId`, or `supersedesId` — those are only in `ReferenceDetailItem`. The candidates page is using a list-mode type that was designed for browsing, not decision-making.

### 2b. What candidate tension cards currently show

Source: `app/(root)/(routes)/contradictions/candidates/page.tsx`

Each card renders:
- The title
- Type label + `"Detected on [lastTouchedAt]"` — date-only provenance
- Side A / Side B in a 2-column grid
- Confirm / Dismiss action buttons

**What the page does NOT show** (exists in DB but not fetched):
- `sourceSessionId` / `sourceMessageId` — not included in `ContradictionListItem`
- The specific message quote that triggered detection (stored in `ContradictionEvidence`)
- Detection confidence (stored on the `ContradictionNode` record but not surfaced in list)

### 2c. Entry points to candidate review — current state

| Surface | Candidate memories | Candidate tensions |
|---|---|---|
| GlobalRail | Badge count on References nav | Badge count on Tensions nav |
| ChatContextDrawer | "Review candidate memories →" link (only if count > 0) | "Review candidate tensions →" link (only if count > 0) |
| Import result page | "Confirm or dismiss candidate memories" link | "Confirm or dismiss detected tensions (N waiting)" link |
| CommandPalette | "Candidate Memories" nav entry | "Candidate Tensions" nav entry |
| Help page | Yes (Candidates section) | Yes (Candidates section) |

Entry points are comprehensive. This is well-covered.

### 2d. Action labels — current state

Both pages use **Confirm** and **Dismiss**. These are clear and consistent.
The import page result links use "Confirm or dismiss" — consistent with page-level labels.
The ChatContextDrawer uses "Review candidate memories / tensions" — directionally consistent.

### 2e. Page-level framing copy

**Memory candidates page:**
> "Candidate memories are proposed durable memories — they do not affect future chats until you confirm them."

This is clear on the *consequence* of confirming. It does not explain the *origin* (what generated the proposal).

**Tension candidates page:**
> "Candidate tensions were detected by the system and need confirmation before becoming active."

Passive voice, no attribution of mechanism. Correct but low-trust: "the system" is vague.

### 2f. What the import pipeline generates

The import `resultSummary` returns a `contradictionsCreated` count but no `memoriesCreated` count. The import result page links to the memories candidates page unconditionally even if zero memories were proposed, because there is no count returned for that. The tension link is conditional on `contradictionsCreated > 0`.

---

## 3. Trust Strengths — What Already Works

**Side A / Side B on tension candidates** is the single most trust-building element in the entire candidate experience. The user can immediately see the specific contradiction being claimed. This is genuinely good — no changes needed.

**Type classification visible on both** — users can at least see what kind of thing is being proposed, which enables the simplest sanity check ("Does this actually look like a preference? Yes/No").

**Confirm/Dismiss labeling** — now consistent across all surfaces. No confusion about what the buttons do.

**GlobalRail badge counts** — persistent, visible, refreshed on mount. The user is not missing candidates passively.

**"Pending review" in ChatContextDrawer** — only surfaces when candidates actually exist; does not create noise when the queue is empty.

**Import result entry points** — actionable links with counts directly after import completes. The user is directed to review immediately at the highest-motivation moment.

**Candidates do not affect prompt injection** — stated explicitly on the memory candidates page. This is critical trust infrastructure — the user knows that inaction is safe.

---

## 4. Trust Gaps — What Is Missing or Weak

### Gap 1: Memory candidates have no source attribution (most significant)

When a candidate memory appears, the user cannot tell whether it came from:
- A live chat session (and if so, which one)
- An import batch
- A recently superseding statement vs. a brand-new observation

Without source attribution, the user must accept or reject based purely on the content of the proposed statement. For high-confidence, clearly-worded statements this is fine. For ambiguous statements like "I prefer to work early morning" (which might now be outdated), the user needs context to decide correctly.

The data *exists* (`sourceSessionId`, `sourceMessageId`, `supersedesId` are all stored), but none of it reaches the candidate review page because `ReferenceListItem` does not include these fields.

### Gap 2: Memory candidates with `supersedesId` give no hint of what they replace

A particularly high-trust failure: when a candidate memory is a proposed *replacement* for an existing active memory (i.e., `supersedesId` is set), the card looks identical to a brand-new memory proposal. The user cannot see what they would be replacing. Confirming a superseding candidate with no knowledge of the existing memory is a meaningful decision made blindly.

### Gap 3: Tension candidates have no source context

The Side A / Side B grid is informative, but the user still does not know *when* or *in what conversation* this tension was detected. For import-generated candidates especially, the user may not recognize the tensions at all — they come from conversations that happened months or years ago. Without any hook back to the source, the user has no recourse except to confirm or dismiss based on the title alone.

### Gap 4: No visual distinction between import-sourced and live-chat-sourced candidates

An import from ChatGPT history may generate 15 candidate tensions in a single batch. A live chat session generates 1–2 over several conversations. But both appear identically on the candidate review pages. The user cannot immediately tell which candidates are from the batch-import they just ran vs. which appeared organically from recent chatting. This distinction matters because:
- Import candidates are often from months-old conversations and may no longer be relevant
- Live-chat candidates are from today's session and the user likely remembers the context

### Gap 5: "Detected by the system" framing is too passive

The tension candidates page says "detected by the system." The memory candidates page says "proposed durable memories." Neither version names the *mechanism* clearly. Users who don't understand what generates proposals may be confused or mistrustful. A single sentence explaining "the assistant detected a potential tension while processing your conversation" would be more grounding.

### Gap 6: Import result page triggers memory candidate link unconditionally

The import result page always shows the "Confirm or dismiss candidate memories" link, even if the import produced zero memory candidates (since `resultSummary` does not return a memory count). This creates false urgency on a link that leads to an empty state. Compared to the tension link (which is conditional on `contradictionsCreated > 0`), this is inconsistent.

---

## 5. The Import vs. Live-Chat Asymmetry in Practice

Today a user who imports ChatGPT history and a user who has been chatting for two weeks arrive at the same candidate review pages with the same card layout. For the import user:

- The tensions were detected from conversations they may not remember
- The memories may describe preferences that have since changed
- They have no way to understand the age of the source material from the card
- The volume may be higher (10–20 candidates vs. 1–4 from live chat)

This asymmetry is not currently signaled at all. The user has no way to group, sort, or understand the provenance batch. The minimum useful signal would be a label showing whether the source was an import session vs. a live session, or at minimum the source date.

---

## 6. What Should Not Change

- **The confirm/dismiss flow itself** — it works and the labels are now correct
- **The side A/B grid on tension candidates** — this is the best trust element in the experience; do not flatten or replace it
- **The "does not affect future chats" framing** — keep this; it is the most important trust guarantee
- **Candidate lifecycle semantics** — stable; not under review
- **Global badge counts and entry points** — well-covered; no changes needed
- **Command palette entries** — present and functional

---

## 7. Recommended Next Implementation Packet

**Packet G — Candidate Source Attribution**

This is the smallest packet that materially improves trust. It does not require schema changes. It requires surfacing fields that already exist in the database but are not included in the list-mode responses.

### G-1 — Add source fields to the reference candidates fetch

The candidates page currently calls `fetchReferences()` which maps to the general list endpoint returning `ReferenceListItem`. `ReferenceListItem` does not include `sourceSessionId`, `sourceMessageId`, or `supersedesId`.

**Fix:** The candidates page should either:
- Call a dedicated `GET /api/reference?status=candidate&include=source` variant that adds these three fields to the response, or
- Use a separate candidates-specific endpoint `GET /api/reference/candidates` that returns a richer type

The type `ReferenceListItem` should not be modified — it is used by the general list panel which does not need these fields. A new `ReferenceCandidateItem` type (extending or parallel) is appropriate.

Fields to add to the candidates response:
- `sourceSessionId: string | null`
- `sourceMessageId: string | null`
- `supersedesId: string | null`
- `supersedesStatement: string | null` — a server-side join that fetches the statement of the superseded item in the same query, so the card can show "Replaces: [existing memory text]" without a second round-trip

### G-2 — Add source fields to the contradiction candidates fetch

The candidates page calls `GET /api/contradiction?status=candidate`. `ContradictionListItem` does not include `sourceSessionId`.

**Fix:** The contradiction list endpoint should include `sourceSessionId: string | null` when `status=candidate`. No new endpoint needed — just add the field to the response when a candidate query is made. The candidates page can use this field; the general list panel will ignore it.

Fields to add:
- `sourceSessionId: string | null`
- `sourceMessageId: string | null` (optional — less critical since the Side A/B already gives strong signal)

### G-3 — Render source attribution on candidate cards

**Memory candidates:** After the "Detected on [date]" line, add:
- If `sourceSessionId` is set and it's recognizable as an import session: `"From import"` (simple label)
- If `sourceSessionId` is set and it's a live session: `"From a session on [date]"` — link to `/chat?session=[id]`
- If `supersedesStatement` is set: a collapsible or inline "Replaces: [existing memory text]" — this is the most trust-critical piece

**Tension candidates:** After the type/date line, add:
- If `sourceSessionId` is set: `"Detected in a session on [date]"` — link to `/chat?session=[id]`
- If `sourceSessionId` indicates an import session: `"Detected during import"`

This does not require knowing whether a session is an "import" session vs. native — it can simply show the session date. The user will recognize whether that date corresponds to their import.

### G-4 — Fix import result: conditional memory candidates link

The import result section should suppress the "Confirm or dismiss candidate memories" link if zero memory candidates were created, consistent with how the tension link behaves. This requires the import result summary to include a `referenceCandidatesCreated: number` field. This is a small API change to the import processing flow (incrementing a count when `status: "candidate"` references are created).

This is a low-effort correctness fix with meaningful UX impact (avoids false urgency).

**Packet G does not include:**
- Detection confidence scores on candidate cards
- Full message quote surfacing
- Bulk confirm/dismiss
- Sorting or grouping by source/age
- Any explanation of *why* the type classification was assigned

---

## 8. Deferred Items

| Item | Reason for deferral |
|---|---|
| Detection confidence score on tension cards | Confidence is a system-internal signal; surfacing it may cause users to over-optimize for high-confidence dismissals and miss real low-confidence tensions |
| Full triggering message quote on tension cards | Requires a join to `ContradictionEvidence` — adds complexity; the Side A/B already gives strong signal for most cases |
| "Why was this type assigned?" explanation | Requires either storing a detection rationale field or a post-hoc explanation API call; high-complexity, low-urgency |
| Bulk confirm/dismiss | Useful at high volume (large imports), but the per-item confirm flow is important for building familiarity with the system; not needed yet |
| Sorting/grouping by source type or date | Useful once candidate volumes grow; premature at current scale |
| Import-vs-native session tagging in DB | The distinction can be inferred from session metadata (e.g., import sessions are marked via `importSessionId`); does not need a new enum |
| Confidence threshold filtering | Would suppress some candidates from review; too aggressive a change before trust is established |

---

## 9. Explicit Distinction: Provenance vs. Explanation vs. Traceability

This document focuses on **provenance** — "where did this come from" — which is the minimum needed for trust.

**Provenance** (this pass): source session link, import vs. live label, supersedes context. Small data additions, high leverage.

**Explanation** (deferred): "why this was classified as a preference / tension" — requires either stored rationale or on-demand LLM inference. High complexity, low urgency at this stage.

**Full traceability** (deferred): complete audit trail from detection event through candidate creation to confirm/dismiss action. This belongs in a later audit-and-accountability pass, not now.

The distinction matters because explanation and traceability are frequently requested but rarely needed for the core trust problem. A user who knows *which session* generated a candidate can make a good decision. A user who also knows *why the system classified it as a Preference* is better informed but rarely meaningfully different in their decision.
