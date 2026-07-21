# 08 — Result honesty contract

## Discriminated success

### Created

- `ok: true`
- `writeExecuted: true`
- `contradictionNodeOutcome: "created"`
- `contradictionDeduplicationProven: true`

### Reused

- `ok: true`
- `writeExecuted: false`
- `contradictionNodeOutcome: "reused"`
- `contradictionDeduplicationProven: true`

Both return durable `contradictionNodeId`, both span ids, `status: "candidate"`, and recommended storage confidence.

## Honesty rules

- Do not label exact reuse as a new write.
- Do not set `contradictionDeduplicationProven: true` on failure.
- Do not update an existing contradiction node on reuse.
