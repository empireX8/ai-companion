# 03 — Same-session query contract

## Policy

V1 is SAME-SESSION ONLY.

Side A and Side B must resolve to the same `sessionId`.

Cross-session candidate selection is prohibited even when token overlap is high, markers appear strong, a ReferenceItem is active, confidence is higher, the reference is newer, or a model might otherwise call the propositions contradictory.

## Query shape

`buildSameSessionReferenceQuery` / `buildLegacySameSessionReferenceQuery`:

```
where:
  userId = current user
  status in allowed statuses
  type in [goal, constraint]
  sourceSessionId = current Side B session
orderBy: confidence desc, updatedAt desc
take: 50
select:
  id, type, statement, status, confidence,
  sourceSessionId, sourceMessageId,
  sourceMessage { id, sessionId, userId, content }
```

## Guarantees

- No user-wide fallback
- No query path that omits `sourceSessionId`
- Cross-session references preferably never enter adjudication
- Query limit remains bounded

## Callers

| Path | Session boundary |
|------|------------------|
| Live `POST /api/message` | `session.id` + `userMessage.id` |
| Import | `created.sessionId` + `importedMessage.id` |
| Backfill | `message.sessionId` + `message.id` (still zero persistable detections) |
