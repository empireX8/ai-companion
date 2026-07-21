# 02 — Dual-source projection contract

## Modules

- Client-safe: `lib/contradiction-dual-source-presentation-contract.ts` (types + copy)
- Server resolver: `lib/contradiction-dual-source-presentation.ts`

## Reader signatures (user-scoped)

```ts
findSpansByIds(userId: string, ids: string[])
findMessagesByIds(userId: string, ids: string[])
findSessionsByIds(userId: string, ids: string[])
```

## Prisma where clauses

```ts
where: { id: { in: ids }, userId }
```

for EvidenceSpan, Message, and Session.

In-memory ownership checks remain as a second fail-closed boundary.
Only owned spans drive message ID collection; only owned messages drive session ID collection.