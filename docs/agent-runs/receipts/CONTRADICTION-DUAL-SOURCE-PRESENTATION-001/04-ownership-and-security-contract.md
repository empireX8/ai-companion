# 04 — Ownership and security contract

## Checks

- Node lookup already scoped by authenticated `userId`
- Span ownership rechecked: `span.userId === userId`
- Message ownership rechecked: `message.userId === userId`
- Session provenance included only when `session.userId === userId`

## Exposure limits

- Only verified exact quote slice is exposed (not neighbouring text, not full message)
- Unauthorized routes remain 401
- Shared Inspector keep `candidate` excluded (404)
- Cross-user span IDs fail closed as `span_wrong_user` and never return foreign message content

## UI

Normal copy never prints IDs, hashes, or internal reason enums.
