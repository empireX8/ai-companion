# 01 — Landed chain call graph

```
persisted CurrentMessageSource (Side B)
+ SameSessionReferenceRow[] with sourceMessage (Side A)
  → selectSameSessionContradictionFromReferences
       ├─ assembleCurrentMessageSourceUnit
       ├─ assessReferenceSourceCompleteness
       └─ selectSameSessionContradictionPair
            └─ adjudicateContradiction
                 ├─ StructuredModelRunner.runStructured   [injected adjudicator]
                 ├─ qualifier / evidence deterministic gates
                 └─ runObjectivityRefereeSafely           [injected referee]
  → buildValidatedDualSideLineage(resolved Messages)
  → calibrateContradictionConfidence
  → buildContradictionPersistencePlan              [WeakSet mint; local only]
  → persistRepairedContradictionCandidate          [injected $transaction]
  → resolveContradictionDualSourcePresentation     [optional; post-write]
```

Orchestrator: `runControlledContradictionNaturalEntryProof` in
`lib/contradiction-controlled-natural-entry-proof.ts`

Public entry does **not** accept preassembled `KernelSourceUnit` / `SideACandidate[]`.
Authorised plans never leave the orchestration boundary.

Production message/import paths remain on quarantined legacy `detectContradictions` → `[]`.
