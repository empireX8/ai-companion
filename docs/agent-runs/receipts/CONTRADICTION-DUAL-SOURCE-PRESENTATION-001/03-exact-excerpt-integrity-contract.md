# 03 — Exact excerpt integrity contract

For an available side:

1. Resolve `EvidenceSpan` by stored span ID
2. Require `span.userId === authenticated userId`
3. Resolve message by `span.messageId`
4. Require `message.userId === authenticated userId`
5. Require `message.id === span.messageId`
6. Require valid integer offsets within message content
7. Derive `exactQuote = message.content.slice(charStart, charEnd)`
8. Recompute SHA-256 via `hashExactQuoteSlice(exactQuote)`
9. Require recomputed hash === `span.contentHash`
10. Expose verified `exactQuote` only

Failures return typed unavailable reasons without substituting proposition text or complete message content.
