# Independent review correction — CEQR-008/009

## Classification

`PASS_WITH_KNOWN_BASELINE_FAILURES` after applying the required narrow patch.

## Corrections applied

1. **User-scoped lookups** — reader methods take `(userId, ids)`; Prisma where includes both `id: { in }` and `userId`. Message IDs collected only from owned spans.
2. **Session ownership** — `sessionId` / `sessionOrigin` / `sessionLabel` only from owned resolved session; no `message.sessionId` fallback.
3. **Zero-length spans** — require `charEnd > charStart`; empty-string hash still fails closed as `invalid_offsets`.
4. **Client-safe contract split** — `lib/contradiction-dual-source-presentation-contract.ts` (types + copy); server resolver remains in `lib/contradiction-dual-source-presentation.ts`.
5. **Copy + timestamp** — plain partial copy; context-neutral legacy Inspector copy; candidate-specific copy only via `copySurface="candidate"`; `recordedAt` prefers `Message.createdAt`.

## Account

Before vs after-patch: unchanged (25 / 25 / 5941 / 0 complete / 0 partial / 25 legacy).
