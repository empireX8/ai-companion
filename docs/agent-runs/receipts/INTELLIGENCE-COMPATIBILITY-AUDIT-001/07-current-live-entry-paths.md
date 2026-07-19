# 07 — Current live-entry paths

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Method:** code trace + isolated contract knowledge only. **No buttons pressed; no test entries on Kay.**

---

## Entry matrix

| Intent | Route / API | Raw record | Interpretation | Objects | Evidence? | ModelUpdate? | Surface | Status |
|--------|-------------|------------|----------------|---------|-----------|--------------|---------|--------|
| Orvek Capture overlay | `CaptureOverlay` — no fetch | none | none | none | no | no | — | **Mock** |
| Capture Life Data | `/journal-chat` → `POST /api/message` (`journal_chat`) | Message | profile, contradiction, patterns, dark bridge | Message + optional PA/CN/PC/UM | yes | if dark publishes | Timeline/Map after | **Live** |
| Journal entries | `POST /api/journal/entries` | JournalEntry | pattern trigger (thinner) | JournalEntry + patterns | partial | rare | — | **Live / thin** |
| Free Explore | `POST /api/session` + `/api/message` (`explore_chat`) | Message | same after() + grounding / movement proposals | Message + proposals | yes | via publish | Explore | **Live** |
| Track Decision | Decisions composer disabled in production | — | — | SurfacedActions from sync only | claim links | no | Decisions read | **Dead entry / live read** |
| Log Conflict | No Orvek UI; auto detect on message; `POST /api/contradiction` unwired | Message / API | detect vs refs | ContradictionNode | quote | on import-review accept | Map after open | **Partial auto / orphaned UI** |
| Add Outcome | Header chip disabled; `DurableDecisionOutcomeControls` → `PATCH /api/actions/[id]` | SurfacedAction | status/note | SurfacedAction update | note | **no** | Decisions | **Live durable / dead chip** |
| Goal create/edit | Chat memory / `POST /api/reference`; no Orvek goal CRUD | ReferenceItem | intent/rules | RI goal; PA GOAL | source FKs | no | Map goals ≠ RI goals | **Partial** |
| Correction | `DurableCorrectionControls` → `PATCH /api/user-map/conclusions/[id]`; store chips mock | UM fields | labels only | correction fields | as fields | **no** | Map/Inspector | **Live durable / mock chips** |
| Today capture actions | route to journal-chat / commands | same as journal | same | same | same | same | Today | **Partial** |
| Map capture | selection + correction only | — | — | — | — | — | Map | **Partial** |
| Voice | `use-voice-input` on legacy chat shells | transcript→message | same as message | same | yes | same | legacy | **Legacy** |
| Attachment | no Orvek multipart path found | — | — | — | — | — | — | **Dead** |
| Import review | Import overlay → decide API | RI/CN status | accept/reject | status + optional MU/UEL | yes on CN | CN yes; RI no | Import + Map | **Live** (no mutations this audit) |

---

## Live vs mock cheat-sheet

| Live | Mock / dead / orphaned |
|------|------------------------|
| Free Explore send | Orvek Capture overlay |
| `/journal-chat` message path | Decisions “Talk it through” |
| Durable correction / decision outcome / fieldwork check-in | Header Add outcome chip |
| Import review decide (code) | Manual Log Conflict UI |
| Auto contradiction on message | ProfileArtifact → Map |
| Pattern trigger on journal/message | Pattern LLM LF (shadow) |

---

## Important implication

Natural-entry proof campaigns must use **journal-chat / Free Explore / durable controls**, not the Capture overlay or disabled Decisions composers — those would fake success.
