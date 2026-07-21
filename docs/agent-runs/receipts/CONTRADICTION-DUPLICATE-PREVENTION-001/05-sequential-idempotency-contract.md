# 05 — Sequential idempotency contract

## Behaviour

1. First valid invocation with an authorised plan:
   - ensures/reuses exact spans
   - finds no exact node
   - creates one candidate node
   - returns `contradictionNodeOutcome: "created"`, `writeExecuted: true`, `contradictionDeduplicationProven: true`
2. Second sequential invocation with the same exact span pair:
   - finds the existing exact node
   - does **not** call `contradictionNode.create` again
   - returns the same `contradictionNodeId`
   - returns `contradictionNodeOutcome: "reused"`, `writeExecuted: false`, `contradictionDeduplicationProven: true`
3. Existing node fields (title, propositions, type, status, confidence, escalation, timestamps) are **not** updated.

## Proof

Focused test: sequential second invocation reuses the same node without a second create.
