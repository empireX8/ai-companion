# 01 — Landed persistence audit

## Prior merged capability (persistence wiring)

- `lib/contradiction-persistence-plan.ts` — WeakSet-authorised frozen plan
- `lib/contradiction-repaired-persistence.ts` — injected transactional writer
- Exact dual-side `EvidenceSpan` ensure/reuse
- One candidate `ContradictionNode` create per invocation
- No live route wiring
- Previously returned `contradictionDeduplicationProven: false`

## Gap closed by CEQR-007

Repeated valid invocations for the same ordered repaired span pair were not idempotent. Concurrent creates could commit sibling duplicates because schema had only per-column indexes, not compound uniqueness.

## Landed after this slice

| Capability | Status |
| ---------- | ------ |
| Exact ordered span-pair uniqueness (DB) | Implemented |
| Sequential reuse (`writeExecuted: false`) | Proven in focused tests |
| Concurrent P2002 → recovery reuse | Proven in focused harness |
| `contradictionDeduplicationProven: true` on success | Implemented |
| Live wiring | Not implemented |
| Fuzzy semantic dedup | Not implemented |
