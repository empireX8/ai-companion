# 03 — Executable orchestrator

**File:** `lib/contradiction-controlled-natural-entry-proof.ts`
**Symbol:** `runControlledContradictionNaturalEntryProof`
**Version:** `contradiction-controlled-natural-entry-proof-v1`

## Behaviour

1. Validates persisted `currentMessage` against `sessionId`
2. Runs `selectSameSessionContradictionFromReferences` (landed source construction)
3. Resolves persisted messages for lineage (resolver exceptions → `failed_safely`, no writer)
4. Builds dual-side lineage
5. Applies confidence policy
6. Mints authorised persistence plan as a **local** WeakSet capability
7. Immediately invokes repaired writer with that local plan
8. Optionally resolves dual-source presentation; presentation failures after write keep `created`/`reused`

## Non-behaviour

- Does not accept preassembled KernelSourceUnits as the public boundary
- Does not egress authorised plans (`executePersistence` / `authorisedPlanForHarness` removed)
- Does not import `prismadb`, message route, import-chatgpt, or live AI SDK runners
- Does not auto-PASS a missing referee
- Does not put post-write presentation failures into `failureCode`
