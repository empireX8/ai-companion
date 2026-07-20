# 02 — Source-completeness contract

## Side B (current message)

Represented as a `KernelSourceUnit` / `CurrentMessageSource` with:

- `sourceId`
- `sessionId`
- `messageId`
- `role`
- `sourceText` — exact stored Message content
- label/type

## Side A (reference)

A selectable reference must include:

- ReferenceItem id
- type / statement
- status/confidence for retrieval ordering only
- `sourceSessionId`
- `sourceMessageId`
- exact source Message content (`id`, `sessionId`, `userId`, `content`)

## Fail-closed incompleteness

| Condition | Reason |
|-----------|--------|
| `sourceSessionId` null/blank | `missing_source_session_id` |
| `sourceMessageId` null/blank | `missing_source_message_id` |
| source message unresolved | `source_message_unresolved` |
| source message user ≠ current user | `source_message_user_mismatch` |
| ReferenceItem session ≠ Message session | `source_session_disagreement` |
| ReferenceItem session ≠ current Side B session | `cross_session_excluded` |
| Message session ≠ current Side B session | `source_message_session_mismatch` |
| empty source content | `empty_source_text` |

Incomplete or inconsistent provenance never enters adjudication.

## Honesty note

Source completeness is never claimed from `ReferenceItem.statement` alone.
