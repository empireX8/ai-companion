# Canonical Ticket List

## Ticket 1
Contradiction nodes as first-class infrastructure (DB + APIs + tests + verification).

## Ticket 2
Contradiction salience queue v1 (Top-3 surfacing + avoidance weighting).

## Ticket 3
Escalation ladder v1 (backend-only, automatic recommended rung alongside manual rung).

## Ticket 4
Automatic contradiction detection in `/api/message` using deterministic heuristics.

## Ticket 5
Inject Top-3 contradictions into `/api/message` system prompt context.

## Ticket 6
Weekly audit + metrics v1 (backend-only snapshot model + API).

## Ticket 7
Weekly audit trend + deltas endpoint (last N rows and week-over-week deltas).

## Ticket 8
Auto-generate weekly audit on safe trigger (`POST /api/message` user messages only).

## Ticket 9
Weekly audit backfill v1 (create missing weekly rows for past N weeks).

## Ticket 10
Contradiction resolution protocol v1 (explicit actions + deterministic transitions).

## Ticket 11
Unify Top-3 selection and surfacing side-effects with a single shared engine.

## Ticket 12
Chat UI tray rework (Nodes/Tools, Now, Memory, Sessions) + read-only surfaces.

## Ticket 13
Dedicated read-only node list pages (`/contradictions`, `/references`).

## Ticket 14
Import external chat exports (v1): user uploads ChatGPT export JSON, Double ingests into Sessions/Messages, runs contradiction detection, and returns a summary.
Scope: add `/import` page + `POST /api/import/chatgpt`, multipart `file`, JSON-only (zip rejected), size guard (`<=15MB`), best-effort per-conversation ingestion with summary `{ sessionsCreated, messagesCreated, contradictionsCreated, errors: [] }`.
After import: run contradiction detection for user messages (`>=15` chars) and create/update nodes/evidence using existing pipeline rules.

## Ticket 15
TBD (needs owner spec).

## Ticket 16
TBD (needs owner spec).

## Ticket 17
TBD (needs owner spec).

## Ticket 18
TBD (needs owner spec).

## Ticket 19
TBD (needs owner spec).

## Ticket 20
TBD (needs owner spec).

## Ticket 21
TBD (needs owner spec).

## Ticket 22
TBD (needs owner spec).

## Ticket 23
TBD (needs owner spec).

## Ticket 24
TBD (needs owner spec).

## Ticket 25
TBD (needs owner spec).
